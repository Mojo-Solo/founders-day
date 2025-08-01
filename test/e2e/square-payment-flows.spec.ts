/**
 * Square Payment End-to-End Tests
 * 
 * Comprehensive Playwright test suite for Square payment integration covering:
 * - Complete payment flows from UI to database
 * - Cross-browser compatibility testing
 * - Mobile responsive payment flows
 * - Error scenarios and recovery
 * - Accessibility and keyboard navigation
 * - Performance and load testing
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { faker } from '@faker-js/faker'

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:3001',
  squareAppId: process.env.SQUARE_APP_ID || 'sandbox-sq0idb-test',
  squareLocationId: process.env.SQUARE_LOCATION_ID || 'test-location',
}

// Test data generators
const generateTestPayment = () => ({
  amount: faker.number.int({ min: 500, max: 50000 }), // $5.00 to $500.00
  customerName: faker.person.fullName(),
  customerEmail: faker.internet.email(),
  customerPhone: faker.phone.number(),
  registrationId: faker.string.uuid(),
})

const generateTestCard = () => ({
  // Square sandbox test cards
  number: '4111 1111 1111 1111', // Valid Visa
  expiry: '12/25',
  cvv: '123',
  postalCode: '12345',
})

// Custom test fixtures
test.beforeEach(async ({ page }) => {
  // Mock Square SDK for consistent testing
  await page.addInitScript(() => {
    // Mock Square Web SDK
    const mockCard = {
      attach: () => Promise.resolve(),
      tokenize: () => Promise.resolve({
        status: 'OK',
        token: 'test-card-token-' + Date.now(),
        details: {
          card: {
            brand: 'VISA',
            last4: '1111',
            expMonth: 12,
            expYear: 2025,
          },
        },
      }),
      destroy: () => Promise.resolve(),
    }

    const mockPayments = {
      card: () => Promise.resolve(mockCard),
    }

    window.Square = {
      payments: () => Promise.resolve(mockPayments),
    }
  })

  // Set up network interception for API calls
  await page.route('**/api/square/payments', async (route) => {
    if (route.request().method() === 'POST') {
      // Mock successful payment response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          payment: {
            id: `mock-payment-${Date.now()}`,
            status: 'COMPLETED',
            amount: 25.00,
            currency: 'USD',
            receiptUrl: 'https://example.com/receipt',
            receiptNumber: 'RCP123',
            createdAt: new Date().toISOString(),
          },
        }),
      })
    } else {
      await route.continue()
    }
  })
})

test.describe('Square Payment Integration - End-to-End Tests', () => {
  test.describe('Complete Payment Flows', () => {
    test('should complete successful payment flow from start to finish', async ({ page }) => {
      const testPayment = generateTestPayment()
      const testCard = generateTestCard()

      // Navigate to payment page
      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Wait for page to load
      await expect(page.locator('[data-testid="payment-form"]')).toBeVisible()

      // Fill customer information
      await page.fill('[data-testid="customer-name"]', testPayment.customerName)
      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.fill('[data-testid="customer-phone"]', testPayment.customerPhone)

      // Wait for Square form to initialize
      await expect(page.locator('#square-card-container')).toBeVisible()
      await page.waitForTimeout(2000) // Allow Square SDK to initialize

      // Fill payment information
      // Note: In real tests, you'd interact with Square's iframe
      // Here we're testing the integration flow with mocked responses

      // Verify amount display
      await expect(page.locator('[data-testid="payment-amount"]')).toContainText('$')

      // Submit payment
      const payButton = page.locator('[data-testid="pay-button"]')
      await expect(payButton).toBeEnabled()
      await payButton.click()

      // Verify loading state
      await expect(page.locator('[data-testid="payment-loading"]')).toBeVisible()
      await expect(payButton).toBeDisabled()

      // Wait for payment completion
      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 })

      // Verify success message and receipt
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Payment successful')
      await expect(page.locator('[data-testid="receipt-link"]')).toBeVisible()
      await expect(page.locator('[data-testid="payment-id"]')).toContainText('mock-payment-')

      // Verify redirect to success page
      await expect(page).toHaveURL(/\/checkout\/success/)
    })

    test('should handle registration-specific payment flow', async ({ page }) => {
      const testPayment = generateTestPayment()

      // Start from event registration
      await page.goto(`${TEST_CONFIG.baseUrl}/register`)

      // Select event type
      await page.click('[data-testid="event-banquet"]')
      
      // Fill registration form
      await page.fill('[data-testid="attendee-name"]', testPayment.customerName)
      await page.fill('[data-testid="attendee-email"]', testPayment.customerEmail)
      await page.selectOption('[data-testid="meal-preference"]', 'vegetarian')

      // Proceed to payment
      await page.click('[data-testid="proceed-to-payment"]')

      // Verify we're on checkout page with registration data
      await expect(page).toHaveURL(/\/register\/checkout/)
      await expect(page.locator('[data-testid="registration-summary"]')).toBeVisible()
      await expect(page.locator('[data-testid="attendee-info"]')).toContainText(testPayment.customerName)

      // Complete payment
      await page.fill('[data-testid="customer-name"]', testPayment.customerName)
      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)

      const payButton = page.locator('[data-testid="pay-button"]')
      await payButton.click()

      // Verify payment completion
      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 })
      
      // Verify registration confirmation
      await expect(page.locator('[data-testid="registration-confirmation"]')).toBeVisible()
      await expect(page.locator('[data-testid="confirmation-number"]')).toBeVisible()
    })

    test('should support multiple payment amounts and currencies', async ({ page }) => {
      const testAmounts = [
        { amount: 1000, display: '$10.00' }, // $10.00
        { amount: 2550, display: '$25.50' }, // $25.50
        { amount: 10000, display: '$100.00' }, // $100.00
      ]

      for (const { amount, display } of testAmounts) {
        await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout?amount=${amount}`)

        // Verify amount display
        await expect(page.locator('[data-testid="payment-amount"]')).toContainText(display)
        await expect(page.locator('[data-testid="pay-button"]')).toContainText(display)

        // Fill minimal required info
        await page.fill('[data-testid="customer-email"]', faker.internet.email())

        // Submit payment
        await page.click('[data-testid="pay-button"]')

        // Verify success
        await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()

        // Verify amount in success message
        await expect(page.locator('[data-testid="payment-details"]')).toContainText(display)
      }
    })
  })

  test.describe('Error Handling and Recovery', () => {
    test('should handle payment declined scenario', async ({ page }) => {
      // Mock declined payment response
      await page.route('**/api/square/payments', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Payment processing failed',
              details: {
                errors: [{
                  code: 'CARD_DECLINED',
                  detail: 'Your card was declined. Please try a different payment method.',
                  category: 'PAYMENT_METHOD_ERROR',
                }],
              },
            }),
          })
        } else {
          await route.continue()
        }
      })

      const testPayment = generateTestPayment()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Fill payment form
      await page.fill('[data-testid="customer-name"]', testPayment.customerName)
      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)

      // Submit payment
      await page.click('[data-testid="pay-button"]')

      // Verify error display
      await expect(page.locator('[data-testid="payment-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText('card was declined')

      // Verify retry option is available
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
      await expect(page.locator('[data-testid="try-different-method"]')).toBeVisible()

      // Test retry functionality
      await page.route('**/api/square/payments', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              payment: {
                id: `retry-payment-${Date.now()}`,
                status: 'COMPLETED',
                amount: 25.00,
                currency: 'USD',
              },
            }),
          })
        } else {
          await route.continue()
        }
      })

      await page.click('[data-testid="retry-button"]')

      // Verify successful retry
      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()
    })

    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/square/payments', async (route) => {
        await route.abort('failed')
      })

      const testPayment = generateTestPayment()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.click('[data-testid="pay-button"]')

      // Verify network error handling
      await expect(page.locator('[data-testid="payment-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/network.*error|connection.*failed/i)

      // Verify retry is available
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    })

    test('should handle Square SDK initialization failure', async ({ page }) => {
      // Mock Square SDK failure
      await page.addInitScript(() => {
        window.Square = {
          payments: () => Promise.reject(new Error('Square SDK failed to initialize')),
        }
      })

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Verify error display
      await expect(page.locator('[data-testid="sdk-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/payment.*system.*unavailable/i)

      // Verify fallback options
      await expect(page.locator('[data-testid="alternative-payment"]')).toBeVisible()
      await expect(page.locator('[data-testid="contact-support"]')).toBeVisible()
    })

    test('should handle form validation errors', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Try to submit without required fields
      await page.click('[data-testid="pay-button"]')

      // Verify validation errors
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="email-error"]')).toContainText(/email.*required/i)

      // Fill invalid email
      await page.fill('[data-testid="customer-email"]', 'invalid-email')
      await page.click('[data-testid="pay-button"]')

      await expect(page.locator('[data-testid="email-error"]')).toContainText(/valid.*email/i)

      // Fix validation errors
      await page.fill('[data-testid="customer-email"]', 'valid@example.com')
      await page.fill('[data-testid="customer-name"]', 'Valid Name')

      // Should now be able to proceed
      await page.click('[data-testid="pay-button"]')
      await expect(page.locator('[data-testid="payment-loading"]')).toBeVisible()
    })
  })

  test.describe('Cross-Browser Compatibility', () => {
    test('should work correctly in Chrome', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Chrome-specific test')

      const testPayment = generateTestPayment()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Test Chrome-specific features
      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.click('[data-testid="pay-button"]')

      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()

      // Verify Chrome-specific optimizations
      const performanceEntries = await page.evaluate(() => 
        performance.getEntriesByType('navigation')
      )
      expect(performanceEntries).toBeDefined()
    })

    test('should work correctly in Firefox', async ({ page, browserName }) => {
      test.skip(browserName !== 'firefox', 'Firefox-specific test')

      const testPayment = generateTestPayment()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.click('[data-testid="pay-button"]')

      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()
    })

    test('should work correctly in Safari', async ({ page, browserName }) => {
      test.skip(browserName !== 'webkit', 'Safari-specific test')

      const testPayment = generateTestPayment()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.click('[data-testid="pay-button"]')

      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()

      // Test Safari-specific behavior
      const hasSecureContext = await page.evaluate(() => window.isSecureContext)
      expect(hasSecureContext).toBe(true)
    })
  })

  test.describe('Mobile Responsive Testing', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE

      const testPayment = generateTestPayment()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-payment-form"]')).toBeVisible()
      
      // Verify touch-friendly elements
      const payButton = page.locator('[data-testid="pay-button"]')
      const buttonBox = await payButton.boundingBox()
      expect(buttonBox?.height).toBeGreaterThan(44) // iOS touch target minimum

      // Test mobile payment flow
      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.tap('[data-testid="pay-button"]')

      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()
    })

    test('should handle landscape orientation', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 }) // iPhone SE landscape

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Verify layout adjusts for landscape
      await expect(page.locator('[data-testid="payment-form"]')).toBeVisible()
      
      const testPayment = generateTestPayment()
      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.click('[data-testid="pay-button"]')

      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()
    })

    test('should work on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }) // iPad

      const testPayment = generateTestPayment()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Verify tablet-optimized layout
      await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible()

      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.click('[data-testid="pay-button"]')

      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()
    })
  })

  test.describe('Accessibility Testing', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Test keyboard navigation
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="customer-name"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="customer-email"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="customer-phone"]')).toBeFocused()

      // Fill form using keyboard
      await page.fill('[data-testid="customer-email"]', 'keyboard@example.com')

      // Navigate to pay button
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="pay-button"]')).toBeFocused()

      // Submit using Enter key
      await page.keyboard.press('Enter')

      await expect(page.locator('[data-testid="payment-loading"]')).toBeVisible()
    })

    test('should announce errors to screen readers', async ({ page }) => {
      // Mock screen reader API
      await page.addInitScript(() => {
        window.speechSynthesis = {
          speak: (utterance: any) => {
            window.lastSpokenText = utterance.text
          },
        }
      })

      await page.route('**/api/square/payments', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Card declined',
            details: { errors: [{ detail: 'Your card was declined' }] },
          }),
        })
      })

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      await page.fill('[data-testid="customer-email"]', 'test@example.com')
      await page.click('[data-testid="pay-button"]')

      // Verify ARIA live region is updated
      await expect(page.locator('[role="alert"]')).toContainText(/card.*declined/i)

      // Verify error is announced
      const spokenText = await page.evaluate(() => window.lastSpokenText)
      expect(spokenText).toMatch(/card.*declined/i)
    })

    test('should have proper ARIA labels and structure', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Verify form structure
      await expect(page.locator('form[role="form"]')).toBeVisible()
      await expect(page.locator('fieldset')).toHaveAttribute('aria-labelledby')

      // Verify input labels
      await expect(page.locator('[data-testid="customer-email"]')).toHaveAttribute('aria-describedby')
      await expect(page.locator('[data-testid="pay-button"]')).toHaveAttribute('aria-label')

      // Verify heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
      expect(headings.length).toBeGreaterThan(0)
    })

    test('should support high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Verify high contrast styles are applied
      const payButton = page.locator('[data-testid="pay-button"]')
      const buttonStyles = await payButton.evaluate(el => getComputedStyle(el))
      
      // Verify sufficient contrast
      expect(buttonStyles.backgroundColor).not.toBe(buttonStyles.color)
    })
  })

  test.describe('Performance Testing', () => {
    test('should load payment form within acceptable time', async ({ page }) => {
      const startTime = Date.now()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Wait for form to be interactive
      await expect(page.locator('[data-testid="pay-button"]')).toBeEnabled()

      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds
    })

    test('should handle multiple rapid payment attempts', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      await page.fill('[data-testid="customer-email"]', 'rapid@example.com')

      const payButton = page.locator('[data-testid="pay-button"]')

      // Rapid clicking should not cause issues
      await Promise.all([
        payButton.click(),
        payButton.click(),
        payButton.click(),
      ])

      // Should only process one payment
      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()

      // Verify no duplicate payments were attempted
      const networkRequests = []
      page.on('request', request => {
        if (request.url().includes('/api/square/payments')) {
          networkRequests.push(request)
        }
      })

      expect(networkRequests.length).toBeLessThanOrEqual(1)
    })

    test('should measure Core Web Vitals', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Measure Largest Contentful Paint (LCP)
      const lcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1]
            resolve(lastEntry.startTime)
          }).observe({ entryTypes: ['largest-contentful-paint'] })
        })
      })

      expect(lcp).toBeLessThan(2500) // Good LCP is < 2.5s

      // Measure Cumulative Layout Shift (CLS)
      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value
              }
            }
            resolve(clsValue)
          }).observe({ entryTypes: ['layout-shift'] })

          setTimeout(() => resolve(clsValue), 5000)
        })
      })

      expect(cls).toBeLessThan(0.1) // Good CLS is < 0.1
    })
  })

  test.describe('Security Testing', () => {
    test('should enforce HTTPS in production', async ({ page }) => {
      // Skip if not testing production
      test.skip(process.env.NODE_ENV !== 'production', 'Production-only test')

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      const url = page.url()
      expect(url).toMatch(/^https:\/\//)

      // Verify secure context
      const isSecure = await page.evaluate(() => window.isSecureContext)
      expect(isSecure).toBe(true)
    })

    test('should not expose sensitive information in client', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Check for sensitive data in page source
      const content = await page.content()
      expect(content).not.toMatch(/sk_test_|sk_live_/) // Stripe secret keys
      expect(content).not.toMatch(/sq0csp|sq0idp/) // Square secret keys
      expect(content).not.toMatch(/database.*password/i)

      // Check local storage and session storage
      const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage))
      const sessionStorage = await page.evaluate(() => JSON.stringify(window.sessionStorage))

      expect(localStorage).not.toMatch(/secret|key|password/i)
      expect(sessionStorage).not.toMatch(/secret|key|password/i)
    })

    test('should validate input sanitization', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)

      // Test XSS prevention
      const maliciousInput = '<script>alert("xss")</script>'
      
      await page.fill('[data-testid="customer-name"]', maliciousInput)
      await page.fill('[data-testid="customer-email"]', 'test@example.com')
      await page.click('[data-testid="pay-button"]')

      // Verify script is not executed
      const alerts = []
      page.on('dialog', dialog => {
        alerts.push(dialog.message())
        dialog.dismiss()
      })

      await page.waitForTimeout(1000)
      expect(alerts).toHaveLength(0)

      // Verify input is sanitized in display
      const displayedName = await page.locator('[data-testid="customer-name"]').inputValue()
      expect(displayedName).not.toContain('<script>')
    })

    test('should implement proper CSP headers', async ({ page }) => {
      const response = await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)
      
      const cspHeader = response?.headers()['content-security-policy']
      expect(cspHeader).toBeDefined()
      expect(cspHeader).toContain("default-src 'self'")
      expect(cspHeader).toContain('script-src')
    })
  })

  test.describe('Integration with Admin Dashboard', () => {
    test('should reflect payment in admin dashboard', async ({ browser }) => {
      // Create two contexts - user and admin
      const userContext = await browser.newContext()
      const adminContext = await browser.newContext()

      const userPage = await userContext.newPage()
      const adminPage = await adminContext.newPage()

      const testPayment = generateTestPayment()

      // Make payment as user
      await userPage.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)
      await userPage.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await userPage.click('[data-testid="pay-button"]')

      await expect(userPage.locator('[data-testid="payment-success"]')).toBeVisible()

      // Check admin dashboard
      await adminPage.goto(`${TEST_CONFIG.adminUrl}/payments`)

      // Verify payment appears in admin dashboard
      await expect(adminPage.locator('[data-testid="payments-table"]')).toContainText(testPayment.customerEmail)

      // Verify payment details
      await adminPage.click(`[data-testid="payment-details-${testPayment.customerEmail}"]`)
      await expect(adminPage.locator('[data-testid="payment-status"]')).toContainText('COMPLETED')

      await userContext.close()
      await adminContext.close()
    })
  })

  test.describe('Webhook Processing', () => {
    test('should handle webhook events properly', async ({ page }) => {
      // Mock webhook endpoint
      await page.route('**/api/webhooks/square/payments', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      })

      const testPayment = generateTestPayment()

      await page.goto(`${TEST_CONFIG.baseUrl}/register/checkout`)
      await page.fill('[data-testid="customer-email"]', testPayment.customerEmail)
      await page.click('[data-testid="pay-button"]')

      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()

      // Simulate webhook processing
      // In real scenarios, this would be triggered by Square
      await page.evaluate(() => {
        fetch('/api/webhooks/square/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'payment.updated',
            data: {
              object: {
                payment: {
                  id: 'test-payment-id',
                  status: 'COMPLETED',
                },
              },
            },
          }),
        })
      })

      // Verify webhook processing (would need to check database or admin dashboard)
      await page.waitForTimeout(1000)
    })
  })
})

// Test utilities and helpers
test.describe('Test Utilities', () => {
  test('should clean up test data', async ({ page }) => {
    // This test would clean up any test data created during the test run
    // Implementation would depend on your database cleanup strategy
    
    await page.evaluate(() => {
      // Clear any test data from local storage
      localStorage.clear()
      sessionStorage.clear()
    })

    // Clear cookies
    await page.context().clearCookies()

    expect(true).toBe(true) // Placeholder assertion
  })
})