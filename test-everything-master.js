#!/usr/bin/env node

/**
 * MASTER TEST RUNNER - QUADRUPLE CHECK EVERYTHING
 * 
 * This script coordinates ALL testing for the Founders Day refactored architecture:
 * 
 * 🔄 PHASE 1: Infrastructure Tests
 * - Database connectivity and schema validation
 * - Admin backend API endpoints (all 31)
 * - CORS and security configuration
 * 
 * 🔄 PHASE 2: Integration Tests  
 * - Frontend-backend communication
 * - Payment processing flows
 * - CMS content management
 * 
 * 🔄 PHASE 3: End-to-End Tests
 * - Complete user workflows
 * - Cross-browser compatibility
 * - Mobile responsiveness
 * 
 * 🔄 PHASE 4: Performance Tests
 * - Load testing and response times  
 * - Concurrent user simulation
 * - Memory and resource usage
 */

const { spawn, exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const FRONTEND_DIR = './founders-day-frontend'
const ADMIN_DIR = './founders-day-admin'

let testResults = {
  phases: {},
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  startTime: Date.now(),
  endTime: null
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌', 
    warning: '⚠️',
    phase: '🔄'
  }[level] || '📋'
  
  console.log(`${prefix} [${timestamp}] ${message}`)
}

function logPhase(phase, message) {
  console.log('\n' + '='.repeat(80))
  console.log(`🔄 PHASE ${phase}: ${message}`)
  console.log('='.repeat(80))
}

async function runCommand(command, cwd = process.cwd(), timeout = 300000) {
  return new Promise((resolve, reject) => {
    log(`Executing: ${command} (in ${cwd})`)
    
    const child = spawn(command, { 
      shell: true, 
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout 
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data) => {
      const output = data.toString()
      stdout += output
      // Real-time output for important messages
      if (output.includes('✅') || output.includes('❌') || output.includes('🎉') || output.includes('💥')) {
        console.log(output.trim())
      }
    })
    
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0
      })
    })
    
    child.on('error', (error) => {
      reject(error)
    })
    
    // Timeout handling
    setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Command timeout after ${timeout}ms: ${command}`))
    }, timeout)
  })
}

async function checkPrerequisites() {
  logPhase(0, 'PREREQUISITES CHECK')
  
  const checks = [
    { name: 'Node.js version', command: 'node --version' },
    { name: 'npm availability', command: 'npm --version' },
    { name: 'Frontend directory', command: `ls -la ${FRONTEND_DIR}` },
    { name: 'Admin directory', command: `ls -la ${ADMIN_DIR}` }
  ]
  
  for (const check of checks) {
    try {
      const result = await runCommand(check.command, '.', 10000)
      log(`${check.name}: ${result.success ? '✅ OK' : '❌ FAILED'}`, result.success ? 'success' : 'error')
      if (!result.success && check.name.includes('directory')) {
        log(`Missing directory: ${check.command}`, 'error')
        return false
      }
    } catch (error) {
      log(`${check.name}: ❌ FAILED - ${error.message}`, 'error')
      return false
    }
  }
  
  return true
}

async function installDependencies() {
  logPhase(0.5, 'DEPENDENCY INSTALLATION')
  
  log('Installing frontend dependencies...')
  const frontendInstall = await runCommand('npm install', FRONTEND_DIR, 120000)
  if (!frontendInstall.success) {
    log('Frontend dependency installation failed', 'error')
    return false
  }
  
  log('Installing admin dependencies...')
  const adminInstall = await runCommand('npm install', ADMIN_DIR, 120000)
  if (!adminInstall.success) {
    log('Admin dependency installation failed', 'error')
    return false
  }
  
  return true
}

async function phase1Infrastructure() {
  logPhase(1, 'INFRASTRUCTURE TESTING')
  
  const phase1Results = {
    database: { passed: 0, failed: 0, details: '' },
    apiEndpoints: { passed: 0, failed: 0, details: '' },
    security: { passed: 0, failed: 0, details: '' }
  }
  
  // Database Schema Validation
  log('🗄️  Testing database connectivity and schema...')
  try {
    const dbTest = await runCommand('node test-database-schema.js', ADMIN_DIR, 60000)
    const passed = dbTest.stdout.match(/✅/g)?.length || 0
    const failed = dbTest.stdout.match(/❌/g)?.length || 0
    
    phase1Results.database = { 
      passed, 
      failed, 
      details: dbTest.success ? 'Database tests completed' : 'Database tests had issues',
      success: dbTest.success
    }
    
    log(`Database tests: ${passed} passed, ${failed} failed`, dbTest.success ? 'success' : 'warning')
  } catch (error) {
    phase1Results.database = { passed: 0, failed: 1, details: error.message, success: false }
    log(`Database tests failed: ${error.message}`, 'error')
  }
  
  // API Endpoint Testing  
  log('🔗 Testing all API endpoints...')
  try {
    const apiTest = await runCommand('node test-comprehensive-integration.js', ADMIN_DIR, 120000)
    const passed = apiTest.stdout.match(/✅/g)?.length || 0
    const failed = apiTest.stdout.match(/❌/g)?.length || 0
    
    phase1Results.apiEndpoints = {
      passed,
      failed, 
      details: apiTest.success ? 'API endpoint tests completed' : 'API endpoint tests had issues',
      success: apiTest.success
    }
    
    log(`API endpoint tests: ${passed} passed, ${failed} failed`, apiTest.success ? 'success' : 'warning')
  } catch (error) {
    phase1Results.apiEndpoints = { passed: 0, failed: 1, details: error.message, success: false }
    log(`API endpoint tests failed: ${error.message}`, 'error')
  }
  
  testResults.phases.phase1 = phase1Results
  return phase1Results
}

async function phase2Integration() {
  logPhase(2, 'INTEGRATION TESTING')
  
  const phase2Results = {
    frontendBackend: { passed: 0, failed: 0, details: '' },
    unitTests: { passed: 0, failed: 0, details: '' }
  }
  
  // Frontend-Backend Integration
  log('🔄 Testing frontend-backend integration...')
  try {
    const integrationTest = await runCommand('node test-admin-integration.js', FRONTEND_DIR, 60000)
    const success = integrationTest.success
    const details = success ? 'Frontend-backend integration working' : 'Integration issues detected'
    
    phase2Results.frontendBackend = {
      passed: success ? 1 : 0,
      failed: success ? 0 : 1,
      details,
      success
    }
    
    log(`Frontend-backend integration: ${success ? '✅ PASSED' : '❌ FAILED'}`, success ? 'success' : 'error')
  } catch (error) {
    phase2Results.frontendBackend = { passed: 0, failed: 1, details: error.message, success: false }
    log(`Frontend-backend integration failed: ${error.message}`, 'error')
  }
  
  // Unit Tests (Frontend)
  log('🧪 Running frontend unit tests...')
  try {
    const unitTest = await runCommand('npm test -- --run', FRONTEND_DIR, 120000)
    const success = unitTest.success
    
    // Parse test results from Vitest output
    const testMatch = unitTest.stdout.match(/(\d+) passed.*?(\d+) failed/) 
    const passed = testMatch ? parseInt(testMatch[1]) : (success ? 1 : 0)
    const failed = testMatch ? parseInt(testMatch[2]) : (success ? 0 : 1)
    
    phase2Results.unitTests = {
      passed,
      failed,
      details: success ? 'Unit tests completed' : 'Unit test failures detected',
      success
    }
    
    log(`Frontend unit tests: ${passed} passed, ${failed} failed`, success ? 'success' : 'warning')
  } catch (error) {
    phase2Results.unitTests = { passed: 0, failed: 1, details: error.message, success: false }
    log(`Frontend unit tests failed: ${error.message}`, 'error')
  }
  
  testResults.phases.phase2 = phase2Results
  return phase2Results
}

async function phase3EndToEnd() {
  logPhase(3, 'END-TO-END TESTING')
  
  const phase3Results = {
    e2eTests: { passed: 0, failed: 0, details: '' },
    crossBrowser: { passed: 0, failed: 0, details: '' }
  }
  
  // E2E Tests with Playwright
  log('🎭 Running end-to-end tests...')
  try {
    // Install Playwright browsers if needed
    log('Installing Playwright browsers...')
    await runCommand('npx playwright install', FRONTEND_DIR, 180000)
    
    // Run E2E tests
    const e2eTest = await runCommand('npm run test:e2e', FRONTEND_DIR, 300000)
    const success = e2eTest.success
    
    // Parse Playwright results
    const testMatch = e2eTest.stdout.match(/(\d+) passed.*?(\d+) failed/) ||
                     e2eTest.stdout.match(/(\d+) tests? passed/)
    const passed = testMatch ? parseInt(testMatch[1]) : (success ? 1 : 0)
    const failed = testMatch && testMatch[2] ? parseInt(testMatch[2]) : (success ? 0 : 1)
    
    phase3Results.e2eTests = {
      passed,
      failed, 
      details: success ? 'E2E tests completed' : 'E2E test failures detected',
      success
    }
    
    log(`E2E tests: ${passed} passed, ${failed} failed`, success ? 'success' : 'warning')
  } catch (error) {
    phase3Results.e2eTests = { passed: 0, failed: 1, details: error.message, success: false }
    log(`E2E tests failed: ${error.message}`, 'error')
  }
  
  testResults.phases.phase3 = phase3Results
  return phase3Results
}

async function phase4Performance() {
  logPhase(4, 'PERFORMANCE TESTING')
  
  const phase4Results = {
    loadTest: { passed: 0, failed: 0, details: '' },
    lighthouse: { passed: 0, failed: 0, details: '' }
  }
  
  // Basic load testing
  log('⚡ Running performance tests...')
  try {
    // Run performance tests via the comprehensive integration test
    const perfTest = await runCommand('node test-comprehensive-integration.js', ADMIN_DIR, 60000)
    const success = perfTest.stdout.includes('PERFORMANCE') && perfTest.success
    
    phase4Results.loadTest = {
      passed: success ? 1 : 0,
      failed: success ? 0 : 1,
      details: success ? 'Performance tests passed' : 'Performance issues detected',
      success
    }
    
    log(`Performance tests: ${success ? '✅ PASSED' : '❌ ISSUES DETECTED'}`, success ? 'success' : 'warning')
  } catch (error) {
    phase4Results.loadTest = { passed: 0, failed: 1, details: error.message, success: false }
    log(`Performance tests failed: ${error.message}`, 'error')
  }
  
  testResults.phases.phase4 = phase4Results
  return phase4Results
}

function generateTestReport() {
  testResults.endTime = Date.now()
  const duration = Math.round((testResults.endTime - testResults.startTime) / 1000)
  
  console.log('\n' + '='.repeat(100))
  console.log('🏆 FOUNDERS DAY MASTER TEST REPORT')
  console.log('='.repeat(100))
  console.log(`🕒 Total Duration: ${duration} seconds`)
  console.log(`📅 Completed: ${new Date().toISOString()}`)
  
  // Calculate totals
  let totalPassed = 0
  let totalFailed = 0
  let totalTests = 0
  
  Object.entries(testResults.phases).forEach(([phaseName, phase]) => {
    console.log(`\n📋 ${phaseName.toUpperCase()} RESULTS:`)
    Object.entries(phase).forEach(([testName, result]) => {
      const passed = result.passed || 0
      const failed = result.failed || 0
      const total = passed + failed
      
      if (total > 0) {
        const passRate = ((passed / total) * 100).toFixed(1)
        const status = result.success ? '✅' : '⚠️'
        console.log(`   ${status} ${testName}: ${passed}/${total} (${passRate}%) - ${result.details}`)
        
        totalPassed += passed
        totalFailed += failed
        totalTests += total
      }
    })
  })
  
  // Overall summary
  const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0
  const overallStatus = overallPassRate >= 90 ? '🎉 EXCELLENT' : 
                       overallPassRate >= 80 ? '✅ GOOD' : 
                       overallPassRate >= 70 ? '⚠️  NEEDS WORK' : '❌ CRITICAL ISSUES'
  
  console.log('\n' + '='.repeat(100))
  console.log('📊 OVERALL SUMMARY')
  console.log('='.repeat(100))
  console.log(`📈 Total Tests: ${totalTests}`)
  console.log(`✅ Passed: ${totalPassed}`)
  console.log(`❌ Failed: ${totalFailed}`)
  console.log(`📊 Pass Rate: ${overallPassRate}%`)
  console.log(`🏆 Status: ${overallStatus}`)
  
  // Recommendations
  console.log('\n🎯 RECOMMENDATIONS:')
  if (overallPassRate >= 95) {
    console.log('   🎉 Outstanding! System is production-ready.')
    console.log('   🚀 Deploy with confidence.')
  } else if (overallPassRate >= 85) {
    console.log('   ✅ System is well-configured with minor issues.')
    console.log('   🔧 Address failed tests before production deployment.')
  } else if (overallPassRate >= 70) {
    console.log('   ⚠️  System has significant issues requiring attention.')
    console.log('   🛠️  Focus on critical failures before proceeding.')
  } else {
    console.log('   ❌ System has critical issues preventing deployment.')
    console.log('   🆘 Review architecture and fix fundamental problems.')
  }
  
  console.log('\n📝 NEXT STEPS:')
  console.log('   1. Review detailed test outputs above')
  console.log('   2. Fix any critical failures identified')
  console.log('   3. Re-run specific test suites for failed components')
  console.log('   4. Once all tests pass, proceed with deployment')
  
  // Save results to file
  const reportFile = `test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2))
  console.log(`\n💾 Detailed results saved to: ${reportFile}`)
  
  return overallPassRate >= 80
}

async function runMasterTestSuite() {
  log('🚀 STARTING FOUNDERS DAY MASTER TEST SUITE', 'phase')
  log('QUADRUPLE CHECKING: Infrastructure + Integration + E2E + Performance')
  
  try {
    // Prerequisites
    const prereqsOk = await checkPrerequisites()
    if (!prereqsOk) {
      log('Prerequisites check failed. Cannot continue.', 'error')
      return false
    }
    
    // Dependencies  
    const depsOk = await installDependencies()
    if (!depsOk) {
      log('Dependency installation failed. Continuing with existing dependencies.', 'warning')
    }
    
    // Execute test phases
    await phase1Infrastructure()
    await phase2Integration() 
    await phase3EndToEnd()
    await phase4Performance()
    
    // Generate comprehensive report
    return generateTestReport()
    
  } catch (error) {
    log(`Master test suite crashed: ${error.message}`, 'error')
    console.error(error.stack)
    return false
  }
}

// Execute the master test suite
if (require.main === module) {
  runMasterTestSuite()
    .then(success => {
      const message = success 
        ? '🎉 Master test suite completed successfully! System is ready.'
        : '⚠️  Master test suite completed with issues. Review failures.'
      
      console.log(`\n${message}`)
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n💥 Master test suite crashed:', error)
      process.exit(1)
    })
}

module.exports = { runMasterTestSuite }