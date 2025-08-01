/**
 * Square Admin Integration End-to-End Tests
 * 
 * Comprehensive Playwright test suite for Square admin functionality covering:
 * - Payment management and reconciliation
 * - Customer management interface
 * - Webhook monitoring and processing
 * - Financial reporting and analytics
 * - Admin authentication and permissions
 */

import { test, expect, type Page } from '@playwright/test'
import { faker } from '@faker-js/faker'

// Test configuration
const ADMIN_CONFIG = {
  baseUrl: process.env.ADMIN_URL || 'http://localhost:3001',
  frontendUrl: process.env.BASE_URL || 'http://localhost:3000',
  adminCredentials: {
    email: process.env.ADMIN_EMAIL || 'admin@foundersday.test',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
}

// Test data generators
const generateTestPayment = () => ({
  id: `test-payment-${faker.string.alphanumeric(8)}`,
  amount: faker.number.int({ min: 1000, max: 50000 }),
  status: faker.helpers.arrayElement(['COMPLETED', 'PENDING', 'FAILED']),
  customerEmail: faker.internet.email(),
  customerName: faker.person.fullName(),
  registrationId: faker.string.uuid(),
  createdAt: faker.date.recent().toISOString(),
})

// Authentication helper
async function loginAsAdmin(page: Page) {
  await page.goto(`${ADMIN_CONFIG.baseUrl}/login`)
  
  await page.fill('[data-testid="email-input"]', ADMIN_CONFIG.adminCredentials.email)
  await page.fill('[data-testid="password-input"]', ADMIN_CONFIG.adminCredentials.password)
  await page.click('[data-testid="login-button"]')
  
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.locator('[data-testid="admin-header"]')).toBeVisible()
}

// Setup mock data
test.beforeEach(async ({ page }) => {
  // Mock API responses for consistent testing
  await page.route('**/api/square/payments', async (route) => {
    if (route.request().method() === 'GET') {
      const mockPayments = Array.from({ length: 10 }, () => generateTestPayment())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          payments: mockPayments,
          pagination: {
            limit: 10,
            offset: 0,
            count: mockPayments.length,
            total: 50,
          },
        }),
      })
    } else {
      await route.continue()
    }
  })

  await page.route('**/api/square/customers', async (route) => {
    if (route.request().method() === 'GET') {
      const mockCustomers = Array.from({ length: 5 }, () => ({
        id: faker.string.uuid(),
        square_customer_id: `cust_${faker.string.alphanumeric(8)}`,
        email: faker.internet.email(),
        given_name: faker.person.firstName(),
        family_name: faker.person.lastName(),
        phone_number: faker.phone.number(),
        created_at: faker.date.recent().toISOString(),
      }))
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          customers: mockCustomers,
        }),
      })
    } else {
      await route.continue()
    }
  })
})

test.describe('Square Admin Dashboard - End-to-End Tests', () => {
  test.describe('Authentication and Access Control', () => {
    test('should require authentication for admin pages', async ({ page }) => {
      // Try to access admin page without login
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/)
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
    })

    test('should login successfully with valid credentials', async ({ page }) => {
      await loginAsAdmin(page)
      
      // Verify successful login
      await expect(page.locator('[data-testid="admin-welcome"]')).toBeVisible()
      await expect(page.locator('[data-testid="user-menu"]')).toContainText('admin@foundersday.test')
    })

    test('should handle login with invalid credentials', async ({ page }) => {
      await page.goto(`${ADMIN_CONFIG.baseUrl}/login`)
      
      await page.fill('[data-testid="email-input"]', 'invalid@example.com')
      await page.fill('[data-testid="password-input"]', 'wrongpassword')
      await page.click('[data-testid="login-button"]')
      
      // Should show error message
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="login-error"]')).toContainText(/invalid.*credentials/i)
    })

    test('should logout successfully', async ({ page }) => {
      await loginAsAdmin(page)
      
      // Click user menu and logout
      await page.click('[data-testid="user-menu"]')
      await page.click('[data-testid="logout-button"]')
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/)
      
      // Try to access protected page
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Payment Management Interface', () => {
    test('should display payments list with correct data', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Verify payments table is displayed
      await expect(page.locator('[data-testid="payments-table"]')).toBeVisible()
      await expect(page.locator('[data-testid="payments-header"]')).toContainText('Payments')
      
      // Verify table headers
      await expect(page.locator('[data-testid="payment-id-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="amount-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="status-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="customer-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="date-header"]')).toBeVisible()
      
      // Verify payment rows are displayed
      const paymentRows = page.locator('[data-testid^="payment-row-"]')
      await expect(paymentRows).toHaveCount(10)
    })

    test('should allow filtering payments by status', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Apply status filter
      await page.selectOption('[data-testid="status-filter"]', 'COMPLETED')
      await page.click('[data-testid="apply-filters"]')
      
      // Verify filtered results
      const statusCells = page.locator('[data-testid^="payment-status-"]')
      const statusTexts = await statusCells.allTextContents()
      
      statusTexts.forEach(status => {
        expect(status).toBe('COMPLETED')
      })
    })

    test('should allow searching payments by customer email', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      const searchEmail = 'test@example.com'
      
      // Mock search results
      await page.route('**/api/square/payments*', async (route) => {
        const url = new URL(route.request().url())
        if (url.searchParams.get('customerEmail') === searchEmail) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              payments: [{
                ...generateTestPayment(),
                customerEmail: searchEmail,
              }],
              pagination: { limit: 10, offset: 0, count: 1 },
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      // Search for specific email
      await page.fill('[data-testid="search-input"]', searchEmail)
      await page.click('[data-testid="search-button"]')
      
      // Verify search results
      await expect(page.locator('[data-testid="payments-table"]')).toContainText(searchEmail)
    })

    test('should display payment details modal', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Click on first payment row
      await page.click('[data-testid^="payment-row-"]:first-child')
      
      // Verify modal opens
      await expect(page.locator('[data-testid="payment-details-modal"]')).toBeVisible()
      await expect(page.locator('[data-testid="payment-details-title"]')).toContainText('Payment Details')
      
      // Verify payment details are displayed
      await expect(page.locator('[data-testid="payment-id-detail"]')).toBeVisible()
      await expect(page.locator('[data-testid="payment-amount-detail"]')).toBeVisible()
      await expect(page.locator('[data-testid="payment-status-detail"]')).toBeVisible()
      await expect(page.locator('[data-testid="customer-details"]')).toBeVisible()
      
      // Close modal
      await page.click('[data-testid="close-modal"]')
      await expect(page.locator('[data-testid="payment-details-modal"]')).not.toBeVisible()
    })

    test('should allow payment status updates', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Mock update endpoint
      await page.route('**/api/square/payments', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              paymentId: 'test-payment-123',
              status: 'COMPLETED',
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      // Open payment details
      await page.click('[data-testid^="payment-row-"]:first-child')
      
      // Update status
      await page.selectOption('[data-testid="status-select"]', 'COMPLETED')
      await page.click('[data-testid="update-status-button"]')
      
      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="success-message"]')).toContainText(/status.*updated/i)
    })

    test('should handle payment refunds', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Mock refund endpoint
      await page.route('**/api/square/payments', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              refund: {
                id: 'refund-123',
                paymentId: 'payment-123',
                amount: 25.00,
                status: 'COMPLETED',
              },
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      // Open payment details
      await page.click('[data-testid^="payment-row-"]:first-child')
      
      // Initiate refund
      await page.click('[data-testid="refund-button"]')
      
      // Fill refund form
      await page.fill('[data-testid="refund-amount"]', '25.00')
      await page.fill('[data-testid="refund-reason"]', 'Customer requested refund')
      await page.click('[data-testid="confirm-refund"]')
      
      // Verify refund success
      await expect(page.locator('[data-testid="refund-success"]')).toBeVisible()
      await expect(page.locator('[data-testid="refund-success"]')).toContainText(/refund.*processed/i)
    })
  })

  test.describe('Customer Management Interface', () => {
    test('should display customers list', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/customers`)
      
      // Verify customers table
      await expect(page.locator('[data-testid="customers-table"]')).toBeVisible()
      await expect(page.locator('[data-testid="customers-header"]')).toContainText('Customers')
      
      // Verify table headers
      await expect(page.locator('[data-testid="customer-name-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="customer-email-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="customer-phone-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="customer-created-header"]')).toBeVisible()
      
      // Verify customer rows
      const customerRows = page.locator('[data-testid^="customer-row-"]')
      await expect(customerRows).toHaveCount(5)
    })

    test('should allow customer search', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/customers`)
      
      const searchEmail = 'search@example.com'
      
      // Mock search endpoint
      await page.route('**/api/square/customers*', async (route) => {
        const url = new URL(route.request().url())
        if (url.searchParams.get('email') === searchEmail) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              customers: [{
                id: faker.string.uuid(),
                email: searchEmail,
                given_name: 'Search',
                family_name: 'User',
              }],
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      // Search for customer
      await page.fill('[data-testid="customer-search"]', searchEmail)
      await page.click('[data-testid="search-customers"]')
      
      // Verify search results
      await expect(page.locator('[data-testid="customers-table"]')).toContainText(searchEmail)
    })

    test('should display customer payment history', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/customers`)
      
      // Mock customer payments endpoint
      await page.route('**/api/square/payments*', async (route) => {
        const url = new URL(route.request().url())
        if (url.searchParams.get('customerId')) {
          const customerPayments = Array.from({ length: 3 }, () => generateTestPayment())
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              payments: customerPayments,
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      // Click on customer to view details
      await page.click('[data-testid^="customer-row-"]:first-child')
      
      // Verify customer details modal
      await expect(page.locator('[data-testid="customer-details-modal"]')).toBeVisible()
      await expect(page.locator('[data-testid="customer-payment-history"]')).toBeVisible()
      
      // Click on payment history tab
      await page.click('[data-testid="payment-history-tab"]')
      
      // Verify payment history is displayed
      const paymentHistoryRows = page.locator('[data-testid^="customer-payment-"]')
      await expect(paymentHistoryRows).toHaveCount(3)
    })

    test('should allow customer profile updates', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/customers`)
      
      // Mock customer update endpoint
      await page.route('**/api/square/customers', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              customer: {
                id: 'customer-123',
                given_name: 'Updated',
                family_name: 'Name',
                email: 'updated@example.com',
              },
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      // Open customer details
      await page.click('[data-testid^="customer-row-"]:first-child')
      
      // Edit customer info
      await page.click('[data-testid="edit-customer-button"]')
      await page.fill('[data-testid="customer-first-name"]', 'Updated')
      await page.fill('[data-testid="customer-last-name"]', 'Name')
      await page.click('[data-testid="save-customer"]')
      
      // Verify update success
      await expect(page.locator('[data-testid="update-success"]')).toBeVisible()
    })
  })

  test.describe('Webhook Management Interface', () => {
    test('should display webhook events log', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/webhooks`)
      
      // Mock webhook events
      await page.route('**/api/square/webhooks*', async (route) => {
        const mockWebhooks = Array.from({ length: 20 }, () => ({
          id: faker.string.uuid(),
          event_id: `evt_${faker.string.alphanumeric(8)}`,
          event_type: faker.helpers.arrayElement(['payment.created', 'payment.updated', 'customer.created']),
          status: faker.helpers.arrayElement(['processed', 'failed', 'pending']),
          created_at: faker.date.recent().toISOString(),
          retry_count: faker.number.int({ min: 0, max: 3 }),
        }))
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            webhooks: mockWebhooks,
            pagination: { limit: 20, offset: 0, count: 20 },
          }),
        })
      })
      
      // Verify webhooks table
      await expect(page.locator('[data-testid="webhooks-table"]')).toBeVisible()
      await expect(page.locator('[data-testid="webhooks-header"]')).toContainText('Webhook Events')
      
      // Verify webhook rows
      const webhookRows = page.locator('[data-testid^="webhook-row-"]')
      await expect(webhookRows).toHaveCount(20)
    })

    test('should filter webhooks by event type', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/webhooks`)
      
      // Apply event type filter
      await page.selectOption('[data-testid="event-type-filter"]', 'payment.created')
      await page.click('[data-testid="apply-webhook-filters"]')
      
      // Verify filtered results
      const eventTypeCells = page.locator('[data-testid^="webhook-event-type-"]')
      const eventTypes = await eventTypeCells.allTextContents()
      
      eventTypes.forEach(type => {
        expect(type).toBe('payment.created')
      })
    })

    test('should display webhook event details', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/webhooks`)
      
      // Click on webhook row
      await page.click('[data-testid^="webhook-row-"]:first-child')
      
      // Verify details modal
      await expect(page.locator('[data-testid="webhook-details-modal"]')).toBeVisible()
      await expect(page.locator('[data-testid="webhook-event-data"]')).toBeVisible()
      await expect(page.locator('[data-testid="webhook-processing-log"]')).toBeVisible()
    })

    test('should allow webhook retry for failed events', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/webhooks`)
      
      // Mock retry endpoint
      await page.route('**/api/webhooks/retry', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Webhook retry queued successfully',
          }),
        })
      })
      
      // Click on failed webhook
      await page.click('[data-testid^="webhook-row-"]:first-child')
      
      // Retry webhook
      await page.click('[data-testid="retry-webhook-button"]')
      
      // Verify retry success
      await expect(page.locator('[data-testid="retry-success"]')).toBeVisible()
    })
  })

  test.describe('Financial Reporting and Analytics', () => {
    test('should display payment analytics dashboard', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/analytics`)
      
      // Mock analytics data
      await page.route('**/api/analytics/payments*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              totalRevenue: 125000,
              totalPayments: 450,
              averagePayment: 277.78,
              successRate: 96.2,
              dailyRevenue: Array.from({ length: 30 }, (_, i) => ({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
                revenue: faker.number.int({ min: 1000, max: 10000 }),
                payments: faker.number.int({ min: 10, max: 50 }),
              })),
            },
          }),
        })
      })
      
      // Verify analytics cards
      await expect(page.locator('[data-testid="total-revenue-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-payments-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="average-payment-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="success-rate-card"]')).toBeVisible()
      
      // Verify charts
      await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="payments-chart"]')).toBeVisible()
      
      // Verify data values
      await expect(page.locator('[data-testid="total-revenue-value"]')).toContainText('$125,000')
      await expect(page.locator('[data-testid="total-payments-value"]')).toContainText('450')
    })

    test('should allow date range filtering for analytics', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/analytics`)
      
      // Set custom date range
      await page.fill('[data-testid="start-date"]', '2024-01-01')
      await page.fill('[data-testid="end-date"]', '2024-01-31')
      await page.click('[data-testid="apply-date-range"]')
      
      // Verify URL contains date parameters
      await expect(page).toHaveURL(/startDate=2024-01-01/)
      await expect(page).toHaveURL(/endDate=2024-01-31/)
    })

    test('should export payment reports', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/reports`)
      
      // Mock export endpoint
      await page.route('**/api/reports/export*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          headers: {
            'Content-Disposition': 'attachment; filename="payments-report.csv"',
          },
          body: 'Payment ID,Amount,Status,Customer Email,Date\ntest-1,25.00,COMPLETED,test@example.com,2024-01-01',
        })
      })
      
      // Click export button
      const downloadPromise = page.waitForEvent('download')
      await page.click('[data-testid="export-payments"]')
      
      // Verify download
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('payments-report.csv')
    })
  })

  test.describe('Reconciliation Interface', () => {
    test('should display reconciliation dashboard', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/reconciliation`)
      
      // Mock reconciliation data
      await page.route('**/api/square/reconciliation*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              totalPayments: 450,
              matchedPayments: 445,
              discrepancies: 5,
              pendingReconciliation: 3,
              lastSyncTime: new Date().toISOString(),
            },
          }),
        })
      })
      
      // Verify reconciliation status cards
      await expect(page.locator('[data-testid="matched-payments-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="discrepancies-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="pending-reconciliation-card"]')).toBeVisible()
      
      // Verify values
      await expect(page.locator('[data-testid="matched-payments-count"]')).toContainText('445')
      await expect(page.locator('[data-testid="discrepancies-count"]')).toContainText('5')
    })

    test('should allow manual reconciliation sync', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/reconciliation`)
      
      // Mock sync endpoint
      await page.route('**/api/square/reconciliation/sync', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            sync: {
              totalProcessed: 25,
              successfulSyncs: 23,
              errors: 2,
              discrepancies: 1,
            },
          }),
        })
      })
      
      // Start manual sync
      await page.click('[data-testid="manual-sync-button"]')
      
      // Verify sync progress
      await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible()
      
      // Wait for sync completion
      await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('[data-testid="sync-results"]')).toContainText('23 successful')
    })

    test('should display and resolve discrepancies', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/reconciliation/discrepancies`)
      
      // Mock discrepancies data
      await page.route('**/api/square/reconciliation/discrepancies*', async (route) => {
        const mockDiscrepancies = Array.from({ length: 5 }, () => ({
          id: faker.string.uuid(),
          paymentId: `payment_${faker.string.alphanumeric(8)}`,
          type: 'amount_mismatch',
          squareAmount: faker.number.int({ min: 1000, max: 5000 }),
          localAmount: faker.number.int({ min: 1000, max: 5000 }),
          status: 'pending',
          createdAt: faker.date.recent().toISOString(),
        }))
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            discrepancies: mockDiscrepancies,
          }),
        })
      })
      
      // Verify discrepancies table
      await expect(page.locator('[data-testid="discrepancies-table"]')).toBeVisible()
      
      const discrepancyRows = page.locator('[data-testid^="discrepancy-row-"]')
      await expect(discrepancyRows).toHaveCount(5)
      
      // Resolve first discrepancy
      await page.click('[data-testid^="discrepancy-row-"]:first-child [data-testid="resolve-button"]')
      
      // Select resolution action
      await page.selectOption('[data-testid="resolution-action"]', 'update_local')
      await page.fill('[data-testid="resolution-notes"]', 'Updated local amount to match Square')
      await page.click('[data-testid="confirm-resolution"]')
      
      // Verify resolution success
      await expect(page.locator('[data-testid="resolution-success"]')).toBeVisible()
    })
  })

  test.describe('System Health and Monitoring', () => {
    test('should display system health dashboard', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/system`)
      
      // Mock system health data
      await page.route('**/api/system/health*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            status: 'healthy',
            services: {
              database: { status: 'healthy', responseTime: 45 },
              square: { status: 'healthy', responseTime: 120 },
              webhooks: { status: 'healthy', queueLength: 5 },
              cache: { status: 'healthy', hitRate: 94.5 },
            },
            uptime: '99.98%',
            lastCheck: new Date().toISOString(),
          }),
        })
      })
      
      // Verify health status cards
      await expect(page.locator('[data-testid="overall-health"]')).toContainText('Healthy')
      await expect(page.locator('[data-testid="database-status"]')).toContainText('Healthy')
      await expect(page.locator('[data-testid="square-status"]')).toContainText('Healthy')
      await expect(page.locator('[data-testid="webhook-status"]')).toContainText('Healthy')
      
      // Verify metrics
      await expect(page.locator('[data-testid="uptime-metric"]')).toContainText('99.98%')
      await expect(page.locator('[data-testid="cache-hit-rate"]')).toContainText('94.5%')
    })

    test('should display error logs', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/system/logs`)
      
      // Mock error logs
      await page.route('**/api/system/logs*', async (route) => {
        const mockLogs = Array.from({ length: 50 }, () => ({
          id: faker.string.uuid(),
          level: faker.helpers.arrayElement(['error', 'warn', 'info']),
          message: faker.lorem.sentence(),
          timestamp: faker.date.recent().toISOString(),
          source: faker.helpers.arrayElement(['payment-api', 'webhook-processor', 'square-sync']),
          metadata: {
            paymentId: faker.string.alphanumeric(8),
            userId: faker.string.uuid(),
          },
        }))
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            logs: mockLogs,
            pagination: { limit: 50, offset: 0, count: 50 },
          }),
        })
      })
      
      // Verify logs table
      await expect(page.locator('[data-testid="logs-table"]')).toBeVisible()
      
      const logRows = page.locator('[data-testid^="log-row-"]')
      await expect(logRows).toHaveCount(50)
      
      // Filter by error level
      await page.selectOption('[data-testid="log-level-filter"]', 'error')
      await page.click('[data-testid="apply-log-filters"]')
      
      // Verify filtered results
      const errorLogs = page.locator('[data-testid^="log-level-"]:has-text("error")')
      await expect(errorLogs.first()).toBeVisible()
    })
  })

  test.describe('Performance and Load Testing', () => {
    test('should handle large datasets efficiently', async ({ page }) => {
      await loginAsAdmin(page)
      
      // Mock large dataset
      await page.route('**/api/square/payments*', async (route) => {
        const largeMockData = Array.from({ length: 1000 }, () => generateTestPayment())
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            payments: largeMockData.slice(0, 100), // Paginated response
            pagination: {
              limit: 100,
              offset: 0,
              count: 100,
              total: 1000,
            },
          }),
        })
      })
      
      const startTime = Date.now()
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Wait for table to load
      await expect(page.locator('[data-testid="payments-table"]')).toBeVisible()
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds
      
      // Verify pagination controls
      await expect(page.locator('[data-testid="pagination-info"]')).toContainText('1-100 of 1000')
      await expect(page.locator('[data-testid="next-page"]')).toBeEnabled()
    })

    test('should handle concurrent admin actions', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Simulate concurrent filtering and searching
      const actions = [
        page.selectOption('[data-testid="status-filter"]', 'COMPLETED'),
        page.fill('[data-testid="search-input"]', 'test@example.com'),
        page.click('[data-testid="apply-filters"]'),
      ]
      
      await Promise.all(actions)
      
      // Should handle concurrent actions gracefully
      await expect(page.locator('[data-testid="payments-table"]')).toBeVisible()
    })
  })

  test.describe('Accessibility in Admin Interface', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Test keyboard navigation through interface
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="search-input"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="status-filter"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="apply-filters"]')).toBeFocused()
    })

    test('should have proper ARIA labels in tables', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_CONFIG.baseUrl}/payments`)
      
      // Verify table accessibility
      await expect(page.locator('[data-testid="payments-table"]')).toHaveAttribute('role', 'table')
      await expect(page.locator('[data-testid="payments-table"] thead')).toHaveAttribute('role', 'rowgroup')
      await expect(page.locator('[data-testid="payments-table"] tbody')).toHaveAttribute('role', 'rowgroup')
    })
  })
})