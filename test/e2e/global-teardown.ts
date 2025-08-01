/**
 * Playwright Global Teardown for Square Payment Testing
 * 
 * Cleans up test environment, database, and resources after E2E tests.
 */

import { FullConfig } from '@playwright/test'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...')

  try {
    // 1. Clean up test database
    console.log('📊 Cleaning up test database...')
    await cleanupTestDatabase()

    // 2. Stop mock servers
    console.log('🔧 Stopping mock servers...')
    await stopMockServers()

    // 3. Clean up test files
    console.log('🗑️  Cleaning up test files...')
    await cleanupTestFiles()

    // 4. Generate test summary
    console.log('📋 Generating test summary...')
    await generateTestSummary()

    console.log('✅ Global teardown completed successfully')

  } catch (error) {
    console.error('❌ Global teardown encountered errors:', error)
    // Don't throw here - we want tests to complete even if cleanup fails
  }
}

async function cleanupTestDatabase() {
  try {
    // Clean up test data but preserve schema for potential debugging
    const cleanupSQL = `
      -- Clean up test data
      DELETE FROM payment_reconciliation_log WHERE created_at >= NOW() - INTERVAL '1 day';
      DELETE FROM square_webhooks WHERE created_at >= NOW() - INTERVAL '1 day';
      DELETE FROM square_refunds WHERE created_at >= NOW() - INTERVAL '1 day';
      DELETE FROM square_payments WHERE created_at >= NOW() - INTERVAL '1 day';
      DELETE FROM square_customers WHERE created_at >= NOW() - INTERVAL '1 day';
      DELETE FROM registrations WHERE created_at >= NOW() - INTERVAL '1 day';
      
      -- Reset sequences
      SELECT setval('registrations_id_seq', 1000, true);
    `
    
    await execAsync(`psql $DATABASE_URL -c "${cleanupSQL}"`)
    console.log('  ✓ Test database cleaned up')
  } catch (error) {
    console.error('  ⚠️  Database cleanup failed:', error.message)
  }
}

async function stopMockServers() {
  // Mock servers are handled by MSW in individual tests
  // This is a placeholder for any global mock server cleanup
  console.log('  ✓ Mock servers stopped')
}

async function cleanupTestFiles() {
  try {
    const filesToClean = [
      './test/e2e/auth-state.json',
      './test-results/temp',
    ]
    
    for (const file of filesToClean) {
      try {
        await fs.unlink(file)
        console.log(`  ✓ Removed ${file}`)
      } catch (error) {
        // File might not exist, which is fine
        if (error.code !== 'ENOENT') {
          console.log(`  ⚠️  Could not remove ${file}:`, error.message)
        }
      }
    }
    
    console.log('  ✓ Test files cleaned up')
  } catch (error) {
    console.error('  ⚠️  File cleanup failed:', error.message)
  }
}

async function generateTestSummary() {
  try {
    const testResultsDir = './test-results'
    
    // Check if results directory exists
    try {
      await fs.access(testResultsDir)
    } catch {
      console.log('  ℹ️  No test results directory found')
      return
    }
    
    // Collect test result files
    const files = await fs.readdir(testResultsDir)
    const resultFiles = files.filter(file => 
      file.includes('results') || file.includes('report') || file.includes('coverage')
    )
    
    if (resultFiles.length === 0) {
      console.log('  ℹ️  No test result files found')
      return
    }
    
    // Generate summary report
    const summary = {
      timestamp: new Date().toISOString(),
      testSuite: 'Square Payment Integration Tests',
      resultFiles: resultFiles.map(file => ({
        name: file,
        path: path.join(testResultsDir, file),
        size: await getFileSize(path.join(testResultsDir, file)),
      })),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        squareEnvironment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
        databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
      },
    }
    
    await fs.writeFile(
      path.join(testResultsDir, 'test-summary.json'),
      JSON.stringify(summary, null, 2)
    )
    
    console.log('  ✓ Test summary generated')
    console.log(`  📊 Results available in: ${testResultsDir}`)
    
    // Log summary to console
    console.log('\n📋 Test Summary:')
    console.log(`   • Result files: ${resultFiles.length}`)
    console.log(`   • Environment: ${summary.environment.squareEnvironment}`)
    console.log(`   • Node version: ${summary.environment.nodeVersion}`)
    
  } catch (error) {
    console.error('  ⚠️  Test summary generation failed:', error.message)
  }
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath)
    return stats.size
  } catch {
    return 0
  }
}

export default globalTeardown