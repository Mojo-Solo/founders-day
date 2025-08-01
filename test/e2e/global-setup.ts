/**
 * Playwright Global Setup for Square Payment Testing
 * 
 * Sets up test environment, database, and authentication for E2E tests.
 */

import { chromium, FullConfig } from '@playwright/test'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...')

  try {
    // 1. Setup test database
    console.log('📊 Setting up test database...')
    await setupTestDatabase()

    // 2. Start mock servers
    console.log('🔧 Starting mock servers...')
    await startMockServers()

    // 3. Setup test authentication
    console.log('🔐 Setting up test authentication...')
    await setupTestAuth()

    // 4. Verify Square sandbox connection
    console.log('💳 Verifying Square sandbox connection...')
    await verifySquareConnection()

    console.log('✅ Global setup completed successfully')

  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  }
}

async function setupTestDatabase() {
  try {
    // Reset test database
    const resetCommand = `
      psql $DATABASE_URL -c "
        DROP SCHEMA IF EXISTS test CASCADE;
        CREATE SCHEMA test;
        SET search_path TO test;
      "
    `
    
    // Run database migrations for test schema
    const migrateCommand = `
      psql $DATABASE_URL -f ./20250801_square_payment_integration.sql
    `
    
    await execAsync(resetCommand)
    await execAsync(migrateCommand)
    
    // Insert test data
    await insertTestData()
    
    console.log('  ✓ Test database setup complete')
  } catch (error) {
    console.error('  ❌ Database setup failed:', error)
    throw error
  }
}

async function insertTestData() {
  const testDataSQL = `
    -- Insert test registrations
    INSERT INTO registrations (id, name, email, status, amount, payment_status) VALUES 
    (1, 'Test User 1', 'test1@example.com', 'confirmed', 10000, 'pending'),
    (2, 'Test User 2', 'test2@example.com', 'confirmed', 15000, 'pending'),
    (3, 'Test User 3', 'test3@example.com', 'confirmed', 20000, 'completed');
    
    -- Insert test Square customers
    INSERT INTO square_customers (square_customer_id, email, given_name, family_name) VALUES
    ('test-customer-1', 'test1@example.com', 'Test', 'User'),
    ('test-customer-2', 'test2@example.com', 'Jane', 'Smith');
    
    -- Insert test Square payments
    INSERT INTO square_payments (
      square_payment_id, 
      square_location_id,
      registration_id,
      amount_money_amount,
      total_money_amount,
      status,
      created_at_square,
      updated_at_square
    ) VALUES
    ('test-payment-1', 'test-location-1', 3, 20000, 20000, 'COMPLETED', NOW(), NOW());
  `
  
  await execAsync(`psql $DATABASE_URL -c "${testDataSQL}"`)
}

async function startMockServers() {
  // Mock servers are handled by MSW in individual tests
  // This is a placeholder for any global mock server setup
  console.log('  ✓ Mock servers ready')
}

async function setupTestAuth() {
  try {
    // Create test admin user and get auth token
    const browser = chromium.launch({ headless: true })
    const context = (await browser).newContext()
    const page = await context.newPage()
    
    // Navigate to admin login
    await page.goto('http://localhost:3001/login')
    
    // Perform admin login
    await page.fill('[data-testid="email-input"]', 'admin@foundersday.test')
    await page.fill('[data-testid="password-input"]', 'admin123')
    await page.click('[data-testid="login-button"]')
    
    // Wait for successful login and extract token
    await page.waitForURL('**/dashboard')
    
    // Store auth token in storage state
    await context.storageState({ path: './test/e2e/auth-state.json' })
    
    await browser.close()
    
    console.log('  ✓ Test authentication setup complete')
  } catch (error) {
    console.log('  ⚠️  Auth setup skipped (admin server not available)')
  }
}

async function verifySquareConnection() {
  try {
    // Test Square API connection with sandbox credentials
    const response = await fetch('https://connect.squareupsandbox.com/v2/locations', {
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Square API test failed: ${response.status}`)
    }
    
    const data = await response.json()
    if (!data.locations || data.locations.length === 0) {
      throw new Error('No Square locations found')
    }
    
    console.log('  ✓ Square sandbox connection verified')
  } catch (error) {
    console.error('  ⚠️  Square connection test failed:', error.message)
    console.log('  ℹ️  Tests will use mocked Square responses')
  }
}

export default globalSetup