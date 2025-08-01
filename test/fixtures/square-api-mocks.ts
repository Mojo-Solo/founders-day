/**
 * Square API Mock Responses
 * 
 * Comprehensive mock implementations for Square API responses.
 * Provides realistic API behavior for testing all Square integration scenarios.
 */

import { rest } from 'msw'
import { setupServer } from 'msw/node'
import SquareTestDataFactory, { TEST_SCENARIOS, TestDataUtils } from './square-test-data'

// Mock server configuration
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
export const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3001'

// Square API mock handlers
export const squareApiMocks = [
  // Payment creation endpoint
  rest.post(`${BASE_URL}/api/square/payments`, async (req, res, ctx) => {
    const body = await req.json()
    
    // Simulate different scenarios based on input
    if (body.sourceId?.includes('declined')) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: 'Payment processing failed',
          details: {
            errors: [TEST_SCENARIOS.DECLINED_CARD.error],
          },
        })
      )
    }

    if (body.sourceId?.includes('insufficient')) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: 'Payment processing failed',
          details: {
            errors: [TEST_SCENARIOS.INSUFFICIENT_FUNDS.error],
          },
        })
      )
    }

    if (body.amount <= 0) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: 'Invalid request data',
          details: [
            { field: 'amount', message: 'Amount must be positive' },
          ],
        })
      )
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100))

    // Return successful payment
    return res(
      ctx.status(200),
      ctx.json(SquareTestDataFactory.createPaymentResponse(true, {
        amount: body.amount,
        registrationId: body.registrationId,
        customerEmail: body.customerEmail,
      }))
    )
  }),

  // Payment updates endpoint
  rest.put(`${BASE_URL}/api/square/payments`, async (req, res, ctx) => {
    const body = await req.json()
    
    if (!body.paymentId) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: 'Invalid request data',
          details: [{ field: 'paymentId', message: 'Payment ID is required' }],
        })
      )
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        paymentId: body.paymentId,
        status: body.status,
      })
    )
  }),

  // Payment refunds endpoint
  rest.delete(`${BASE_URL}/api/square/payments`, async (req, res, ctx) => {
    const body = await req.json()
    
    if (!body.paymentId || !body.reason) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: 'Invalid request data',
          details: [
            { field: 'paymentId', message: 'Payment ID is required' },
            { field: 'reason', message: 'Refund reason is required' },
          ],
        })
      )
    }

    const refund = SquareTestDataFactory.createRefund({
      squarePaymentId: body.paymentId,
      amount: body.amount || 2500,
      reason: body.reason,
    })

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        refund: {
          id: refund.squareRefundId,
          paymentId: refund.squarePaymentId,
          status: refund.status,
          amount: refund.amount / 100,
          currency: refund.currency,
          reason: refund.reason,
          createdAt: refund.createdAt,
        },
      })
    )
  }),

  // Payment queries endpoint
  rest.get(`${BASE_URL}/api/square/payments`, (req, res, ctx) => {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const status = url.searchParams.get('status')
    const registrationId = url.searchParams.get('registrationId')
    const paymentId = url.searchParams.get('paymentId')

    let payments = SquareTestDataFactory.createPayments(50)

    // Apply filters
    if (status) {
      payments = payments.filter(p => p.status === status.toUpperCase())
    }
    if (registrationId) {
      payments = payments.filter(p => p.registrationId === registrationId)
    }
    if (paymentId) {
      payments = payments.filter(p => p.squarePaymentId === paymentId)
    }

    // Apply pagination
    const paginatedPayments = payments.slice(offset, offset + limit)

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        payments: paginatedPayments,
        pagination: {
          limit,
          offset,
          count: paginatedPayments.length,
          total: payments.length,
        },
      })
    )
  }),

  // Customer creation endpoint
  rest.post(`${BASE_URL}/api/square/customers`, async (req, res, ctx) => {
    const body = await req.json()
    
    if (!body.emailAddress) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: 'Invalid request data',
          details: [{ field: 'emailAddress', message: 'Email address is required' }],
        })
      )
    }

    // Simulate existing customer check
    if (body.emailAddress === 'existing@example.com') {
      return res(
        ctx.status(200),
        ctx.json({
          ...SquareTestDataFactory.createCustomerResponse(true, {
            email: body.emailAddress,
          }),
          existing: true,
        })
      )
    }

    return res(
      ctx.status(200),
      ctx.json(SquareTestDataFactory.createCustomerResponse(true, {
        email: body.emailAddress,
        givenName: body.givenName,
        familyName: body.familyName,
        phoneNumber: body.phoneNumber,
      }))
    )
  }),

  // Customer updates endpoint
  rest.put(`${BASE_URL}/api/square/customers`, async (req, res, ctx) => {
    const body = await req.json()
    
    if (!body.customerId) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: 'Invalid request data',
          details: [{ field: 'customerId', message: 'Customer ID is required' }],
        })
      )
    }

    return res(
      ctx.status(200),
      ctx.json(SquareTestDataFactory.createCustomerResponse(true, {
        givenName: body.givenName,
        familyName: body.familyName,
        email: body.emailAddress,
      }))
    )
  }),

  // Customer queries endpoint
  rest.get(`${BASE_URL}/api/square/customers`, (req, res, ctx) => {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const email = url.searchParams.get('email')
    const customerId = url.searchParams.get('customerId')

    let customers = SquareTestDataFactory.createCustomers(25)

    // Apply filters
    if (email) {
      customers = customers.filter(c => c.email.includes(email))
    }
    if (customerId) {
      customers = customers.filter(c => c.squareCustomerId === customerId)
    }

    // Apply pagination
    const paginatedCustomers = customers.slice(offset, offset + limit)

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        customers: paginatedCustomers,
        pagination: {
          limit,
          offset,
          count: paginatedCustomers.length,
          total: customers.length,
        },
      })
    )
  }),

  // Customer deletion endpoint
  rest.delete(`${BASE_URL}/api/square/customers`, (req, res, ctx) => {
    const url = new URL(req.url)
    const customerId = url.searchParams.get('customerId')

    if (!customerId) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: 'Customer ID is required',
        })
      )
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        customerId,
      })
    )
  }),

  // Reconciliation endpoints
  rest.get(`${BASE_URL}/api/square/reconciliation`, (req, res, ctx) => {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'summary'
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    switch (type) {
      case 'summary':
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            reportType: 'summary',
            data: SquareTestDataFactory.createReconciliationData(),
            generatedAt: new Date().toISOString(),
          })
        )

      case 'discrepancies':
        const discrepancies = Array.from({ length: 3 }, () => ({
          paymentId: `payment_${Math.random().toString(36).substr(2, 8)}`,
          discrepancies: [
            {
              field: 'status',
              square: 'COMPLETED',
              database: 'PENDING',
            },
          ],
        }))

        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            reportType: 'discrepancies',
            data: discrepancies,
            generatedAt: new Date().toISOString(),
          })
        )

      case 'payments':
        const reconciliationPayments = SquareTestDataFactory.createPayments(20)
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            reportType: 'payments',
            data: reconciliationPayments,
            generatedAt: new Date().toISOString(),
          })
        )

      default:
        return res(
          ctx.status(400),
          ctx.json({
            success: false,
            error: 'Invalid report type',
          })
        )
    }
  }),

  // Reconciliation sync endpoint
  rest.post(`${BASE_URL}/api/square/reconciliation/sync`, async (req, res, ctx) => {
    const body = await req.json()
    
    // Simulate sync processing delay
    await new Promise(resolve => setTimeout(resolve, 500))

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        sync: {
          totalProcessed: 50,
          successfulSyncs: 48,
          errors: 2,
          discrepancies: 1,
          startDate: body.startDate,
          endDate: body.endDate,
          processedAt: new Date().toISOString(),
        },
      })
    )
  }),

  // Webhook endpoints
  rest.post(`${BASE_URL}/api/webhooks/square/payments`, async (req, res, ctx) => {
    const body = await req.json()
    
    // Simulate webhook processing
    await new Promise(resolve => setTimeout(resolve, 50))

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        eventId: body.event_id,
        eventType: body.event_type,
        processed: true,
      })
    )
  }),

  rest.post(`${BASE_URL}/api/webhooks/square/customers`, async (req, res, ctx) => {
    const body = await req.json()
    
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        eventId: body.event_id,
        eventType: body.event_type,
        processed: true,
      })
    )
  }),

  // Webhook status endpoint
  rest.get(`${BASE_URL}/api/webhooks/square/status`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        status: {
          pending: 5,
          processing: 2,
          processed: 1250,
          failed: 3,
          avgProcessingTime: 150,
          oldestPending: new Date(Date.now() - 30000).toISOString(),
        },
      })
    )
  }),

  // Analytics endpoints
  rest.get(`${BASE_URL}/api/analytics/payments`, (req, res, ctx) => {
    const url = new URL(req.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: SquareTestDataFactory.createAnalyticsData(30),
        period: {
          start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: endDate || new Date().toISOString(),
        },
      })
    )
  }),

  // System health endpoint
  rest.get(`${BASE_URL}/api/system/health`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        ...SquareTestDataFactory.createSystemHealthData(),
      })
    )
  }),

  // Error simulation endpoints for testing
  rest.get(`${BASE_URL}/api/test/simulate-error/:type`, (req, res, ctx) => {
    const { type } = req.params
    const errors = TestDataUtils.createErrorScenarios()

    switch (type) {
      case 'network':
        return res.networkError('Network error')
      
      case 'timeout':
        return res(
          ctx.delay(5000), // 5 second delay to simulate timeout
          ctx.status(408),
          ctx.json({ error: 'Request timeout' })
        )
      
      case 'server':
        return res(
          ctx.status(500),
          ctx.json(errors.serverError)
        )
      
      case 'validation':
        return res(
          ctx.status(400),
          ctx.json(errors.validationError)
        )
      
      case 'rate-limit':
        return res(
          ctx.status(429),
          ctx.json(errors.rateLimitError)
        )
      
      default:
        return res(
          ctx.status(400),
          ctx.json({ error: 'Unknown error type' })
        )
    }
  }),
]

// Admin API mock handlers
export const adminApiMocks = [
  // Admin authentication
  rest.post(`${ADMIN_URL}/api/auth/login`, async (req, res, ctx) => {
    const body = await req.json()
    
    if (body.email === 'admin@foundersday.test' && body.password === 'admin123') {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          token: 'mock-admin-token',
          user: {
            id: 'admin-1',
            email: 'admin@foundersday.test',
            role: 'admin',
            name: 'Admin User',
          },
        })
      )
    }

    return res(
      ctx.status(401),
      ctx.json({
        success: false,
        error: 'Invalid credentials',
      })
    )
  }),

  // Admin logout
  rest.post(`${ADMIN_URL}/api/auth/logout`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        message: 'Logged out successfully',
      })
    )
  }),

  // Admin dashboard data
  rest.get(`${ADMIN_URL}/api/dashboard`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          totalPayments: 1250,
          totalRevenue: 125000,
          todayPayments: 45,
          todayRevenue: 4500,
          recentPayments: SquareTestDataFactory.createPayments(5),
          recentCustomers: SquareTestDataFactory.createCustomers(3),
          systemHealth: SquareTestDataFactory.createSystemHealthData(),
        },
      })
    )
  }),
]

// Create mock server instance
export const mockServer = setupServer(...squareApiMocks, ...adminApiMocks)

// Mock handlers for specific test scenarios
export const createMockHandlers = {
  /**
   * Create handlers for successful payment flow
   */
  successfulPayment: () => [
    rest.post(`${BASE_URL}/api/square/payments`, (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json(TEST_SCENARIOS.SUCCESSFUL_PAYMENT.response)
      )
    }),
  ],

  /**
   * Create handlers for declined payment
   */
  declinedPayment: () => [
    rest.post(`${BASE_URL}/api/square/payments`, (req, res, ctx) => {
      return res(
        ctx.status(400),
        ctx.json(TEST_SCENARIOS.DECLINED_CARD.response)
      )
    }),
  ],

  /**
   * Create handlers for network errors
   */
  networkError: () => [
    rest.post(`${BASE_URL}/api/square/payments`, (req, res, ctx) => {
      return res.networkError('Network connection failed')
    }),
  ],

  /**
   * Create handlers for rate limiting
   */
  rateLimited: () => [
    rest.post(`${BASE_URL}/api/square/payments`, (req, res, ctx) => {
      return res(
        ctx.status(429),
        ctx.json({
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        })
      )
    }),
  ],

  /**
   * Create handlers for slow responses (testing timeouts)
   */
  slowResponse: (delay = 5000) => [
    rest.post(`${BASE_URL}/api/square/payments`, (req, res, ctx) => {
      return res(
        ctx.delay(delay),
        ctx.status(200),
        ctx.json(TEST_SCENARIOS.SUCCESSFUL_PAYMENT.response)
      )
    }),
  ],

  /**
   * Create handlers for large dataset testing
   */
  largeDataset: (count = 1000) => [
    rest.get(`${BASE_URL}/api/square/payments`, (req, res, ctx) => {
      const url = new URL(req.url)
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const offset = parseInt(url.searchParams.get('offset') || '0')

      const { payments, pagination } = TestDataUtils.createPaginatedPayments(
        Math.floor(offset / limit) + 1,
        limit,
        count
      )

      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          payments,
          pagination,
        })
      )
    }),
  ],

  /**
   * Create handlers for webhook testing
   */
  webhookProcessing: () => [
    rest.post(`${BASE_URL}/api/webhooks/square/payments`, (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          eventId: 'test-event-id',
          processed: true,
        })
      )
    }),
  ],

  /**
   * Create handlers for reconciliation testing
   */
  reconciliationData: () => [
    rest.get(`${BASE_URL}/api/square/reconciliation`, (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          data: SquareTestDataFactory.createReconciliationData(),
        })
      )
    }),
  ],
}

// Utility functions for test setup
export const MockServerUtils = {
  /**
   * Setup mock server for tests
   */
  setup: () => {
    beforeAll(() => mockServer.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => mockServer.resetHandlers())
    afterAll(() => mockServer.close())
  },

  /**
   * Use specific mock handlers for a test
   */
  useHandlers: (handlers: any[]) => {
    mockServer.use(...handlers)
  },

  /**
   * Reset handlers to default
   */
  resetHandlers: () => {
    mockServer.resetHandlers()
  },

  /**
   * Create a mock handler that tracks requests
   */
  createTrackingHandler: (endpoint: string, method = 'GET') => {
    const requests: any[] = []
    
    const handler = rest[method.toLowerCase()](endpoint, (req, res, ctx) => {
      requests.push({
        url: req.url.toString(),
        method: req.method,
        body: req.body,
        headers: Object.fromEntries(req.headers.entries()),
        timestamp: new Date().toISOString(),
      })

      return res(
        ctx.status(200),
        ctx.json({ success: true, tracked: true })
      )
    })

    return { handler, requests }
  },
}

export default {
  squareApiMocks,
  adminApiMocks,
  mockServer,
  createMockHandlers,
  MockServerUtils,
}