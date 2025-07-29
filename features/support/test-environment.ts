import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import * as path from 'path';

interface ServerConfig {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  url: string;
  healthEndpoint: string;
  env?: NodeJS.ProcessEnv;
}

export class TestEnvironment {
  private servers: Map<string, ChildProcess> = new Map();
  private readonly maxRetries = 15; // Reduced retries for faster startup
  private readonly retryDelay = 500; // Faster retry interval
  private serverStartPromises: Map<string, Promise<void>> = new Map();
  
  private readonly serverConfigs: ServerConfig[] = [
    {
      name: 'frontend',
      command: 'npm',
      args: ['run', 'dev'],
      cwd: path.join(process.cwd(), 'founders-day-frontend'),
      url: 'http://localhost:3000',
      healthEndpoint: '/',
      env: {
        ...process.env,
        PORT: '3000',
        NEXT_TELEMETRY_DISABLED: '1'
      }
    },
    {
      name: 'admin',
      command: 'npm',
      args: ['run', 'dev'],
      cwd: path.join(process.cwd(), 'founders-day-admin'),
      url: 'http://localhost:3001',
      healthEndpoint: '/',
      env: {
        ...process.env,
        PORT: '3001',
        NEXT_TELEMETRY_DISABLED: '1'
      }
    }
  ];

  async startServers(): Promise<void> {
    console.log('🚀 Starting test servers...');
    
    // Kill any existing processes on our ports first
    await this.killProcessesOnPorts();
    
    // For smoke tests, only start frontend server
    const configsToStart = process.env.CUCUMBER_PROFILE === 'smoke' 
      ? this.serverConfigs.filter(c => c.name === 'frontend')
      : this.serverConfigs;
    
    // Start servers in parallel for faster startup
    const startPromises = configsToStart.map(config => {
      if (!this.serverStartPromises.has(config.name)) {
        const promise = this.startServer(config);
        this.serverStartPromises.set(config.name, promise);
        return promise;
      }
      return this.serverStartPromises.get(config.name)!;
    });
    
    await Promise.all(startPromises);
    
    console.log('✅ All servers started successfully');
  }

  private async killProcessesOnPorts(): Promise<void> {
    console.log('Checking for existing processes on required ports...');
    
    for (const config of this.serverConfigs) {
      const port = new URL(config.url).port;
      try {
        // Use lsof to find process using the port
        const { execSync } = await import('child_process');
        const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8' })
          .trim()
          .split('\n')
          .filter(Boolean);
        
        if (pids.length > 0) {
          console.log(`Found process(es) on port ${port}, killing...`);
          pids.forEach(pid => {
            try {
              process.kill(parseInt(pid), 'SIGTERM');
            } catch (e) {
              // Process might have already exited
            }
          });
          
          // Wait a moment for processes to terminate
          await this.sleep(1000);
        }
      } catch (error) {
        // No process found on port, which is what we want
      }
    }
  }

  private async startServer(config: ServerConfig): Promise<void> {
    // Check if server is already running
    if (await this.isServerReady(config)) {
      console.log(`✓ ${config.name} server already running at ${config.url}`);
      return;
    }

    console.log(`Starting ${config.name} server...`);
    
    const server = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: config.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    // Log server output for debugging
    server.stdout?.on('data', (data) => {
      if (process.env.DEBUG) {
        console.log(`[${config.name}] ${data.toString().trim()}`);
      }
    });

    server.stderr?.on('data', (data) => {
      if (process.env.DEBUG) {
        console.error(`[${config.name}] ${data.toString().trim()}`);
      }
    });

    server.on('error', (error) => {
      console.error(`Failed to start ${config.name} server:`, error);
    });

    this.servers.set(config.name, server);

    // Wait for server to be ready
    await this.waitForServer(config);
  }

  private async waitForServer(config: ServerConfig): Promise<void> {
    console.log(`Waiting for ${config.name} server to be ready...`);
    
    for (let i = 0; i < this.maxRetries; i++) {
      if (await this.isServerReady(config)) {
        console.log(`✓ ${config.name} server is ready!`);
        return;
      }
      
      await this.sleep(this.retryDelay);
      
      if (i > 0 && i % 5 === 0) {
        console.log(`Still waiting for ${config.name} server... (${i}/${this.maxRetries})`);
      }
    }
    
    throw new Error(`${config.name} server failed to start after ${this.maxRetries} attempts`);
  }

  private async isServerReady(config: ServerConfig): Promise<boolean> {
    try {
      const response = await axios.get(config.url + config.healthEndpoint, {
        timeout: 1500, // Reduced timeout for faster checks
        validateStatus: () => true // Accept any status code - server is responding
      });
      
      // Only log status in debug mode to reduce noise
      if (process.env.DEBUG) {
        console.log(`Server ${config.name} responded with status ${response.status}`);
      }
      
      // Accept any response as "ready" - server is responding
      return true;
    } catch (error) {
      // Only log errors in debug mode
      if (process.env.DEBUG && axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          // Server not started yet
          return false;
        } else if (error.code === 'ETIMEDOUT') {
          console.warn(`⚠️  Timeout connecting to ${config.name} server`);
          return false;
        }
      }
      
      return false;
    }
  }

  async stopServers(): Promise<void> {
    console.log('🛑 Stopping test servers...');
    
    for (const [name, server] of this.servers) {
      if (server && !server.killed) {
        console.log(`Stopping ${name} server...`);
        
        // Try graceful shutdown first
        server.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (!server.killed) {
            server.kill('SIGKILL');
          }
        }, 5000);
      }
    }
    
    this.servers.clear();
    console.log('✅ All servers stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async ensureServersRunning(): Promise<void> {
    for (const config of this.serverConfigs) {
      if (!await this.isServerReady(config)) {
        console.log(`⚠️  ${config.name} server not responding, restarting...`);
        await this.startServer(config);
      }
    }
  }
}

// Singleton instance
export const testEnvironment = new TestEnvironment();