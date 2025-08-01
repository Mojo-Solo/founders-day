#!/usr/bin/env node

/**
 * Monitoring System Test Script
 * 
 * Tests all monitoring components to ensure they're working correctly
 */

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset)
}

const tests = [
  {
    name: 'Check Sentry Configuration',
    test: () => {
      const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
      if (!sentryDsn) {
        return { success: false, error: 'NEXT_PUBLIC_SENTRY_DSN not configured' }
      }
      
      if (!sentryDsn.includes('sentry.io')) {
        return { success: false, error: 'Invalid Sentry DSN format' }
      }
      
      return { success: true, data: { dsn: sentryDsn.substring(0, 50) + '...' } }
    }
  },
  
  {
    name: 'Check New Relic Configuration',
    test: () => {
      const newRelicKey = process.env.NEW_RELIC_LICENSE_KEY
      const newRelicApp = process.env.NEW_RELIC_APP_NAME
      
      if (!newRelicKey) {
        return { success: false, error: 'NEW_RELIC_LICENSE_KEY not configured' }
      }
      
      if (!newRelicApp) {
        return { success: false, error: 'NEW_RELIC_APP_NAME not configured' }
      }
      
      return { 
        success: true, 
        data: { 
          appName: newRelicApp,
          keyLength: newRelicKey.length 
        } 
      }
    }
  },
  
  {
    name: 'Check Monitoring Files',
    test: () => {
      const fs = require('fs')
      const path = require('path')
      
      const requiredFiles = [
        'lib/monitoring/sentry-config.ts',
        'lib/monitoring/performance-monitor.ts',
        'lib/monitoring/logger.ts',
        'lib/monitoring/monitoring-init.ts',
        'lib/monitoring/index.ts',
        'newrelic.js'
      ]
      
      const missing = []
      
      for (const file of requiredFiles) {
        const filePath = path.join(process.cwd(), file)
        if (!fs.existsSync(filePath)) {
          missing.push(file)
        }
      }
      
      if (missing.length > 0) {
        return { success: false, error: `Missing files: ${missing.join(', ')}` }
      }
      
      return { success: true, data: { filesChecked: requiredFiles.length } }
    }
  },
  
  {
    name: 'Check Package Dependencies',
    test: () => {
      const fs = require('fs')
      const path = require('path')
      
      const packageJsonPath = path.join(process.cwd(), 'package.json')
      if (!fs.existsSync(packageJsonPath)) {
        return { success: false, error: 'package.json not found' }
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies }
      
      const requiredDeps = [
        '@sentry/nextjs',
        'newrelic',
        'web-vitals'
      ]
      
      const missing = requiredDeps.filter(dep => !allDeps[dep])
      
      if (missing.length > 0) {
        return { success: false, error: `Missing dependencies: ${missing.join(', ')}` }
      }
      
      return { 
        success: true, 
        data: { 
          dependencies: requiredDeps.map(dep => `${dep}@${allDeps[dep]}`).join(', ')
        } 
      }
    }
  },
  
  {
    name: 'Test Monitoring Initialization',
    test: async () => {
      try {
        // Simulate browser environment
        global.window = {
          addEventListener: () => {},
          location: { href: 'http://localhost:3000' },
          performance: { now: () => Date.now() },
          navigator: { userAgent: 'Test Agent' }
        }
        
        global.document = {
          addEventListener: () => {},
          readyState: 'complete',
          hidden: false
        }
        
        // Try to load monitoring modules
        const monitoring = require('../lib/monitoring/index.ts')
        
        return { 
          success: true, 
          data: { 
            exports: Object.keys(monitoring).join(', ')
          } 
        }
      } catch (error) {
        return { success: false, error: error.message }
      }
    }
  },
  
  {
    name: 'Check Environment Configuration',
    test: () => {
      const config = {
        enableMonitoring: process.env.NEXT_PUBLIC_ENABLE_MONITORING,
        performanceMonitoring: process.env.NEXT_PUBLIC_PERFORMANCE_MONITORING,
        sampleRate: process.env.NEXT_PUBLIC_MONITORING_SAMPLE_RATE,
        adminApiUrl: process.env.NEXT_PUBLIC_ADMIN_API_URL
      }
      
      const warnings = []
      
      if (!config.enableMonitoring) {
        warnings.push('NEXT_PUBLIC_ENABLE_MONITORING not set')
      }
      
      if (!config.adminApiUrl) {
        warnings.push('NEXT_PUBLIC_ADMIN_API_URL not set')
      }
      
      return {
        success: warnings.length === 0,
        error: warnings.length > 0 ? warnings.join(', ') : undefined,
        data: config
      }
    }
  },
  
  {
    name: 'Simulate Performance Monitoring',
    test: () => {
      try {
        // Test performance metrics structure
        const sampleMetrics = [
          { name: 'api_response_time', value: 250, timestamp: Date.now() },
          { name: 'page_load_time', value: 1500, timestamp: Date.now() },
          { name: 'lcp', value: 2000, timestamp: Date.now() }
        ]
        
        // Test thresholds
        const thresholds = {
          LCP: { good: 2500, needsImprovement: 4000 },
          API_RESPONSE: { good: 1000, needsImprovement: 3000 }
        }
        
        const results = sampleMetrics.map(metric => {
          const threshold = thresholds[metric.name.toUpperCase()]
          if (threshold) {
            const status = metric.value <= threshold.good ? 'good' : 
                          metric.value <= threshold.needsImprovement ? 'needs-improvement' : 'poor'
            return { ...metric, status }
          }
          return metric
        })
        
        return { success: true, data: { metrics: results } }
      } catch (error) {
        return { success: false, error: error.message }
      }
    }
  }
]

async function runTests() {
  log('\n🧪 Running Monitoring System Tests\n', 'bold')
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      log(`  📝 ${test.name}`, 'cyan')
      const result = await test.test()
      
      if (result.success) {
        passed++
        log(`    ✅ PASSED`, 'green')
        if (result.data) {
          Object.entries(result.data).forEach(([key, value]) => {
            log(`      ${key}: ${value}`, 'blue')
          })
        }
      } else {
        failed++
        log(`    ❌ FAILED: ${result.error}`, 'red')
      }
    } catch (error) {
      failed++
      log(`    💥 ERROR: ${error.message}`, 'red')
    }
    
    log('') // Empty line for readability
  }
  
  // Summary
  log('='.repeat(60), 'cyan')
  log('📊 TEST SUMMARY', 'bold')
  log('='.repeat(60), 'cyan')
  log(`Total Tests: ${tests.length}`, 'blue')
  log(`Passed: ${passed}`, 'green')
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green')
  log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`, 'cyan')
  
  if (failed === 0) {
    log('\n🎉 All monitoring tests passed!', 'green')
    log('\n📋 Next Steps:', 'yellow')
    log('  1. Set up environment variables in .env.local')
    log('  2. Configure Sentry and New Relic accounts')
    log('  3. Test in development environment')
    log('  4. Deploy to staging with monitoring enabled')
  } else {
    log('\n⚠️ Some tests failed. Please fix the issues above before proceeding.', 'yellow')
  }
  
  return failed === 0
}

// Run tests if called directly
if (require.main === module) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      log(`\n💥 Test runner crashed: ${error.message}`, 'red')
      console.error(error)
      process.exit(1)
    })
}

module.exports = { runTests }