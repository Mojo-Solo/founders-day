import { Browser, BrowserContext, Page, chromium } from '@playwright/test';

interface PooledBrowser {
  browser: Browser;
  inUse: boolean;
  lastUsed: number;
  contexts: BrowserContext[];
}

interface BrowserPoolConfig {
  maxBrowsers: number;
  maxContextsPerBrowser: number;
  idleTimeout: number;
  launchOptions: any;
}

export class BrowserPool {
  private browsers: PooledBrowser[] = [];
  private config: BrowserPoolConfig;
  private static instance: BrowserPool;

  constructor(config: Partial<BrowserPoolConfig> = {}) {
    this.config = {
      maxBrowsers: 4, // Match parallel workers
      maxContextsPerBrowser: 3, // Multiple contexts per browser
      idleTimeout: 30000, // 30 seconds
      launchOptions: {
        headless: process.env.HEADLESS !== 'false',
        slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-background-timer-throttling',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--no-first-run'
        ]
      },
      ...config
    };
  }

  static getInstance(config?: Partial<BrowserPoolConfig>): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool(config);
    }
    return BrowserPool.instance;
  }

  async getBrowser(): Promise<Browser> {
    // Try to find an available browser
    let pooledBrowser = this.browsers.find(b => !b.inUse && b.contexts.length < this.config.maxContextsPerBrowser);
    
    if (!pooledBrowser && this.browsers.length < this.config.maxBrowsers) {
      // Create new browser if we haven't reached the limit
      const browser = await chromium.launch(this.config.launchOptions);
      pooledBrowser = {
        browser,
        inUse: false,
        lastUsed: Date.now(),
        contexts: []
      };
      this.browsers.push(pooledBrowser);
    }

    if (!pooledBrowser) {
      // Wait for a browser to become available
      pooledBrowser = await this.waitForAvailableBrowser();
    }

    pooledBrowser.inUse = true;
    pooledBrowser.lastUsed = Date.now();
    return pooledBrowser.browser;
  }

  async getContext(browser: Browser, options: any = {}): Promise<BrowserContext> {
    const pooledBrowser = this.browsers.find(b => b.browser === browser);
    if (!pooledBrowser) {
      throw new Error('Browser not found in pool');
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      // Performance optimizations
      bypassCSP: true,
      reducedMotion: 'reduce',
      ...options
    });

    pooledBrowser.contexts.push(context);
    return context;
  }

  async releaseContext(context: BrowserContext): Promise<void> {
    // Find the browser this context belongs to
    const pooledBrowser = this.browsers.find(b => b.contexts.includes(context));
    if (pooledBrowser) {
      // Remove context from tracking
      pooledBrowser.contexts = pooledBrowser.contexts.filter(c => c !== context);
      pooledBrowser.inUse = pooledBrowser.contexts.length > 0;
      pooledBrowser.lastUsed = Date.now();
    }

    // Close the context
    await context.close().catch(e => console.warn('Error closing context:', e.message));
  }

  async releaseBrowser(browser: Browser): Promise<void> {
    const pooledBrowser = this.browsers.find(b => b.browser === browser);
    if (pooledBrowser) {
      pooledBrowser.inUse = false;
      pooledBrowser.lastUsed = Date.now();
    }
  }

  private async waitForAvailableBrowser(): Promise<PooledBrowser> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const available = this.browsers.find(b => !b.inUse && b.contexts.length < this.config.maxContextsPerBrowser);
        if (available) {
          clearInterval(checkInterval);
          resolve(available);
        }
      }, 100);
    });
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up browser pool...');
    
    // Close all contexts first
    for (const pooledBrowser of this.browsers) {
      for (const context of pooledBrowser.contexts) {
        await context.close().catch(e => console.warn('Error closing context:', e.message));
      }
      pooledBrowser.contexts = [];
    }

    // Close all browsers
    await Promise.all(
      this.browsers.map(async (pooledBrowser) => {
        try {
          await pooledBrowser.browser.close();
        } catch (e) {
          console.warn('Error closing browser:', e instanceof Error ? e.message : String(e));
        }
      })
    );

    this.browsers = [];
    console.log('Browser pool cleaned up');
  }

  // Cleanup idle browsers
  async cleanupIdleBrowsers(): Promise<void> {
    const now = Date.now();
    const browsersToClose = this.browsers.filter(
      b => !b.inUse && (now - b.lastUsed) > this.config.idleTimeout
    );

    for (const pooledBrowser of browsersToClose) {
      try {
        // Close all contexts
        for (const context of pooledBrowser.contexts) {
          await context.close();
        }
        // Close browser
        await pooledBrowser.browser.close();
        // Remove from pool
        this.browsers = this.browsers.filter(b => b !== pooledBrowser);
      } catch (e) {
        console.warn('Error cleaning up idle browser:', e instanceof Error ? e.message : String(e));
      }
    }
  }

  getStats() {
    return {
      totalBrowsers: this.browsers.length,
      activeBrowsers: this.browsers.filter(b => b.inUse).length,
      totalContexts: this.browsers.reduce((sum, b) => sum + b.contexts.length, 0),
      maxBrowsers: this.config.maxBrowsers
    };
  }
}

// Export singleton instance
export const browserPool = BrowserPool.getInstance();