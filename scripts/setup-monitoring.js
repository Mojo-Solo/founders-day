#!/usr/bin/env node

/**
 * Production Monitoring Setup Script
 * Configures monitoring tools for the Founders Day Frontend
 * 
 * This script sets up:
 * 1. New Relic APM for application performance monitoring
 * 2. Sentry for error tracking and alerting
 * 3. Custom monitoring dashboards
 * 4. Performance baseline establishment
 * 
 * Usage:
 *   node scripts/setup-monitoring.js
 *   npm run setup:monitoring
 */

const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

// Configuration templates
const configurations = {
  newRelic: {
    // New Relic configuration
    configFile: 'newrelic.js',
    content: `/**
 * New Relic configuration file for Founders Day Frontend
 * 
 * Environment Variables Required:
 * - NEW_RELIC_LICENSE_KEY: Your New Relic license key
 * - NEW_RELIC_APP_NAME: Application name (e.g., "Founders Day Frontend")
 */
'use strict'

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Founders Day Frontend'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info'
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  },
  // Browser monitoring
  browser_monitoring: {
    enable: true
  },
  // Distributed tracing
  distributed_tracing: {
    enabled: true
  },
  // Custom instrumentation
  custom_insights_events: {
    enabled: true
  },
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true
    }
  }
}
`
  },

  sentry: {
    // Sentry configuration
    configFile: 'lib/monitoring/sentry.ts',
    content: `import * as Sentry from '@sentry/nextjs'

/**
 * Sentry Error Tracking Configuration
 * 
 * Environment Variables Required:
 * - NEXT_PUBLIC_SENTRY_DSN: Your Sentry DSN
 * - SENTRY_ORG: Your Sentry organization
 * - SENTRY_PROJECT: Your Sentry project
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Performance monitoring
    profilesSampleRate: 0.1,
    
    // Custom configuration
    environment: process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out low-value errors
      const error = hint.originalException
      
      // Skip network errors that users can't control
      if (error && error.message) {
        if (error.message.includes('fetch')) {
          return null
        }
        if (error.message.includes('NetworkError')) {
          return null
        }
      }
      
      return event
    },
    
    // Custom tags
    initialScope: {
      tags: {
        component: 'frontend',
        project: 'founders-day'
      }
    },
    
    // Performance monitoring
    integrations: [
      new Sentry.BrowserTracing({
        // Capture interactions
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        )
      })
    ]
  })
}

// Utility functions for manual error reporting
export function captureError(error: Error, context?: Record<string, any>) {
  if (SENTRY_DSN) {
    Sentry.withScope(scope => {
      if (context) {
        Object.keys(context).forEach(key => {
          scope.setExtra(key, context[key])
        })
      }
      Sentry.captureException(error)
    })
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (SENTRY_DSN) {
    Sentry.captureMessage(message, level)
  }
}

export function setUserContext(user: { id: string; email?: string }) {
  if (SENTRY_DSN) {
    Sentry.setUser(user)
  }
}

export default Sentry
`
  },

  performanceMonitor: {
    // Performance monitoring utilities
    configFile: 'lib/monitoring/performance.ts',
    content: `/**
 * Performance Monitoring Utilities
 * Tracks Core Web Vitals and custom performance metrics
 */

import { captureMessage } from './sentry'

export interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  url?: string
  userId?: string
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private isClient = typeof window !== 'undefined'
  
  constructor() {
    if (this.isClient) {
      this.initializeWebVitals()
      this.initializeCustomMetrics()
    }
  }
  
  private initializeWebVitals() {
    // Core Web Vitals monitoring
    if ('web-vitals' in window || typeof window.webVitals !== 'undefined') {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(this.handleMetric.bind(this))
        getFID(this.handleMetric.bind(this))
        getFCP(this.handleMetric.bind(this))
        getLCP(this.handleMetric.bind(this))
        getTTFB(this.handleMetric.bind(this))
      }).catch(error => {
        console.warn('Web Vitals not available:', error)
      })
    }
  }
  
  private initializeCustomMetrics() {
    // API response time tracking
    this.interceptFetch()
    
    // Page load time tracking
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigation) {
        this.recordMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart)
      }
    })
  }
  
  private handleMetric(metric: any) {
    this.recordMetric(metric.name, metric.value, {
      url: window.location.href,
      timestamp: Date.now()
    })
    
    // Send to monitoring services
    this.sendToMonitoring(metric)
  }
  
  private interceptFetch() {
    const originalFetch = window.fetch
    
    window.fetch = async function(...args) {
      const startTime = performance.now()
      const url = typeof args[0] === 'string' ? args[0] : args[0].url
      
      try {
        const response = await originalFetch.apply(this, args)
        const endTime = performance.now()
        
        // Record API response time
        const monitor = (window as any).performanceMonitor
        if (monitor) {
          monitor.recordMetric('api_response_time', endTime - startTime, {
            url,
            status: response.status,
            method: args[1]?.method || 'GET'
          })
        }
        
        return response
      } catch (error) {
        const endTime = performance.now()
        
        // Record API error
        const monitor = (window as any).performanceMonitor
        if (monitor) {
          monitor.recordMetric('api_error', endTime - startTime, {
            url,
            error: error.message
          })
        }
        
        throw error
      }
    }
  }
  
  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      url: this.isClient ? window.location.href : undefined,
      ...metadata
    }
    
    this.metrics.push(metric)
    
    // Limit stored metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500)
    }
    
    // Console log for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Performance: \${name} = \${value.toFixed(2)}ms\`, metadata)
    }
  }
  
  private sendToMonitoring(metric: any) {
    // Send to New Relic
    if (typeof window !== 'undefined' && (window as any).newrelic) {
      (window as any).newrelic.addPageAction('performance_metric', {
        name: metric.name,
        value: metric.value,
        url: window.location.href
      })
    }
    
    // Send to Sentry
    captureMessage(\`Performance metric: \${metric.name} = \${metric.value}\`, 'info')
  }
  
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }
  
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name)
  }
  
  getAverageMetric(name: string): number {
    const metrics = this.getMetricsByName(name)
    if (metrics.length === 0) return 0
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  }
  
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      url: this.isClient ? window.location.href : 'server',
      metrics: this.metrics
    }, null, 2)
  }
}

// Global instance
const performanceMonitor = new PerformanceMonitor()

// Attach to window for global access
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor
}

export default performanceMonitor
export { PerformanceMonitor }
`
  },

  dashboardConfig: {
    // Monitoring dashboard configuration
    configFile: 'monitoring-dashboard.json',
    content: JSON.stringify({
      name: "Founders Day Frontend Monitoring",
      description: "Comprehensive monitoring dashboard for the Founders Day Frontend application",
      widgets: [
        {
          id: "core-web-vitals",
          type: "chart",
          title: "Core Web Vitals",
          metrics: [
            "LCP (Largest Contentful Paint)",
            "FID (First Input Delay)", 
            "CLS (Cumulative Layout Shift)",
            "FCP (First Contentful Paint)",
            "TTFB (Time to First Byte)"
          ],
          thresholds: {
            "LCP": { good: 2500, needsImprovement: 4000 },
            "FID": { good: 100, needsImprovement: 300 },
            "CLS": { good: 0.1, needsImprovement: 0.25 },
            "FCP": { good: 1800, needsImprovement: 3000 },
            "TTFB": { good: 800, needsImprovement: 1800 }
          }
        },
        {
          id: "api-performance",
          type: "chart",
          title: "API Performance",
          metrics: [
            "API Response Time (avg)",
            "API Error Rate",
            "API Success Rate",
            "Concurrent API Requests"
          ]
        },
        {
          id: "user-flows",
          type: "funnel",
          title: "User Conversion Funnel",
          steps: [
            "Page Load",
            "Registration Form View",
            "Registration Form Submit",
            "Payment Process",
            "Registration Complete"
          ]
        },
        {
          id: "error-tracking",
          type: "table",
          title: "Error Summary",
          columns: [
            "Error Type",
            "Count",
            "Last Seen",
            "Affected Users",
            "Resolution Status"
          ]
        },
        {
          id: "system-health",
          type: "status",
          title: "System Health",
          checks: [
            "Frontend Deployment Status",
            "Admin API Connectivity",
            "Payment Gateway Status",
            "CDN Performance",
            "Database Connectivity"
          ]
        }
      ],
      alerts: [
        {
          name: "High Error Rate",
          condition: "error_rate > 5%",
          notification: "slack",
          severity: "high"
        },
        {
          name: "Poor Core Web Vitals",
          condition: "LCP > 4000ms OR CLS > 0.25",
          notification: "email",
          severity: "medium"
        },
        {
          name: "API Response Time Degradation",
          condition: "api_response_time > 2000ms",
          notification: "slack",
          severity: "medium"
        },
        {
          name: "Low Conversion Rate",
          condition: "conversion_rate < 80%",
          notification: "email",
          severity: "low"
        }
      ]
    }, null, 2)
  }
}

// Installation functions
async function createMonitoringFiles() {
  log('\n🔧 Creating monitoring configuration files...', 'cyan')
  
  for (const [tool, config] of Object.entries(configurations)) {
    const filePath = path.join(process.cwd(), config.configFile)
    const dir = path.dirname(filePath)
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      log(`  📁 Created directory: ${dir}`, 'blue')
    }
    
    // Write configuration file
    fs.writeFileSync(filePath, config.content)
    log(`  ✅ Created: ${config.configFile}`, 'green')
  }
}

async function installDependencies() {
  log('\n📦 Installing monitoring dependencies...', 'cyan')
  
  const dependencies = [
    '@sentry/nextjs',
    'newrelic',
    'web-vitals'
  ]
  
  const devDependencies = [
    '@types/newrelic'
  ]
  
  // Check package.json
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    log('  ❌ package.json not found', 'red')
    return
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  
  // Add dependencies
  if (!packageJson.dependencies) packageJson.dependencies = {}
  if (!packageJson.devDependencies) packageJson.devDependencies = {}
  
  dependencies.forEach(dep => {
    if (!packageJson.dependencies[dep]) {
      packageJson.dependencies[dep] = 'latest'
      log(`  ➕ Added dependency: ${dep}`, 'blue')
    } else {
      log(`  ✓ Already installed: ${dep}`, 'green')
    }
  })
  
  devDependencies.forEach(dep => {
    if (!packageJson.devDependencies[dep]) {
      packageJson.devDependencies[dep] = 'latest'
      log(`  ➕ Added dev dependency: \${dep}\`, 'blue')
    } else {
      log(`  ✓ Already installed: \${dep}\`, 'green')
    }
  })
  
  // Add scripts
  if (!packageJson.scripts) packageJson.scripts = {}
  
  const newScripts = {
    'monitor:setup': 'node scripts/setup-monitoring.js',
    'monitor:test': 'node scripts/test-monitoring.js',
    'monitor:dashboard': 'node scripts/monitoring-dashboard.js'
  }
  
  Object.entries(newScripts).forEach(([script, command]) => {
    if (!packageJson.scripts[script]) {
      packageJson.scripts[script] = command
      log(`  ➕ Added script: \${script}\`, 'blue')
    }
  })
  
  // Write updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  log('  ✅ Updated package.json', 'green')
}

async function createEnvTemplate() {
  log('\n🔐 Creating environment template...', 'cyan')
  
  const envTemplate = \`# Monitoring Configuration
# Copy these to your .env.local file and fill in your actual values

# New Relic APM
NEW_RELIC_LICENSE_KEY=your-new-relic-license-key
NEW_RELIC_APP_NAME="Founders Day Frontend"

# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project

# Additional Monitoring
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_ERROR_TRACKING=true
MONITORING_SAMPLE_RATE=0.1

# Monitoring Service URLs (optional)
NEW_RELIC_DASHBOARD_URL=https://one.newrelic.com/
SENTRY_DASHBOARD_URL=https://sentry.io/
\`
  
  const envPath = path.join(process.cwd(), '.env.monitoring.template')
  fs.writeFileSync(envPath, envTemplate)
  log('  ✅ Created: .env.monitoring.template', 'green')
}

async function validateSetup() {
  log('\n🔍 Validating monitoring setup...', 'cyan')
  
  const checks = [
    {
      name: 'New Relic config',
      file: 'newrelic.js',
      required: true
    },
    {
      name: 'Sentry config',
      file: 'lib/monitoring/sentry.ts',
      required: true
    },
    {
      name: 'Performance monitor',
      file: 'lib/monitoring/performance.ts',
      required: true
    },
    {
      name: 'Dashboard config',
      file: 'monitoring-dashboard.json',
      required: true
    },
    {
      name: 'Environment template',
      file: '.env.monitoring.template',
      required: true
    }
  ]
  
  let allValid = true
  
  for (const check of checks) {
    const filePath = path.join(process.cwd(), check.file)
    const exists = fs.existsSync(filePath)
    
    if (exists) {
      log(`  ✅ \${check.name}\`, 'green')
    } else {
      log(`  ❌ \${check.name} - Missing: \${check.file}\`, 'red')
      if (check.required) allValid = false
    }
  }
  
  return allValid
}

async function showNextSteps() {
  log('\n🎯 Next Steps for Production Monitoring:', 'bold')
  log('')
  log('1. 📝 Configure Environment Variables:', 'yellow')
  log('   - Copy .env.monitoring.template to .env.local')
  log('   - Fill in your New Relic license key')
  log('   - Fill in your Sentry DSN')
  log('')
  log('2. 📦 Install Dependencies:', 'yellow')
  log('   npm install')
  log('')
  log('3. 🔧 Integration Setup:', 'yellow')
  log('   - Import Sentry in your _app.tsx or layout.tsx')
  log('   - Add New Relic to your next.config.js')
  log('   - Initialize performance monitoring')
  log('')
  log('4. 📊 Dashboard Configuration:', 'yellow')
  log('   - Set up New Relic dashboards')
  log('   - Configure Sentry alerts')
  log('   - Test monitoring endpoints')
  log('')
  log('5. 🚀 Deployment:', 'yellow')
  log('   - Add monitoring env vars to Vercel')
  log('   - Enable monitoring in production')
  log('   - Verify data collection')
  log('')
  log('📋 Useful Commands:', 'cyan')
  log('  npm run monitor:test    - Test monitoring setup')
  log('  npm run monitor:dashboard - Open monitoring dashboard')
  log('  npm run build && npm start - Test with monitoring enabled')
  log('')
}

// Main execution
async function main() {
  log('🚀 Founders Day Frontend - Production Monitoring Setup', 'bold')
  log('=====================================================', 'cyan')
  
  try {
    await createMonitoringFiles()
    await installDependencies()
    await createEnvTemplate()
    
    const isValid = await validateSetup()
    
    if (isValid) {
      log('\n✅ Monitoring setup completed successfully!', 'green')
      await showNextSteps()
    } else {
      log('\n❌ Monitoring setup completed with errors. Please check the logs above.', 'red')
      process.exit(1)
    }
    
  } catch (error) {
    log(`\n💥 Setup failed: \${error.message}\`, 'red')
    console.error(error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = {
  createMonitoringFiles,
  installDependencies,
  validateSetup
}