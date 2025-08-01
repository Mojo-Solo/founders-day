/**
 * Square API Integration Tests
 * 
 * Comprehensive test suite for Square API endpoints.
 * Tests payment processing, customer management, webhooks, and reconciliation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/test'
import { NextRequest } from 'next/server'
import { createMocks } from 'node-mocks-http'

// Mock Square SDK
jest.mock('squareup', () => ({
  Client: jest.fn(() => ({
    paymentsApi: {
      createPayment: jest.fn(),
      getPayment: jest.fn(),
      listPayments: jest.fn(),
    },
    refundsApi: {
      refundPayment: jest.fn(),
    },
    customersApi: {
      createCustomer: jest.fn(),
      updateCustomer: jest.fn(),
      deleteCustomer: jest.fn(),
      searchCustomers: jest.fn(),
    },
  })),
  Environment: {
    Production: 'production',
    Sandbox: 'sandbox',
  },
}))

// Mock authentication middleware
jest.mock('@/lib/auth/jwt', () => ({
  validateRequest: jest.fn(),
  generateTokens: jest.fn(),
}))

// Mock rate limiting middleware
jest.mock('@/lib/auth/middleware', () => ({
  rateLimitMiddleware: jest.fn(() => Promise.resolve(true)),
}))

// Mock logger
jest.mock('@/lib/monitoring/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

// Mock webhook authentication
jest.mock('@/lib/middleware/webhook-auth', () => ({
  authenticateWebhook: jest.fn(),
}))

// Mock webhook queue
jest.mock('@/lib/middleware/webhook-queue', () => ({
  enqueue: jest.fn(),
  registerProcessor: jest.fn(),
}))

// Import API handlers after mocks
import * as paymentsAPI from '../../app/api/square/payments/route'
import * as customersAPI from '../../app/api/square/customers/route'
import * as reconciliationAPI from '../../app/api/square/reconciliation/route'

describe('Square Payments API', () => {
  let mockSquareClient: any
  let mockValidateRequest: any
  let mockRateLimitMiddleware: any

  beforeAll(() => {
    // Setup environment variables
    process.env.SQUARE_ACCESS_TOKEN = 'test-access-token'
    process.env.SQUARE_ENVIRONMENT = 'sandbox'
    process.env.SQUARE_LOCATION_ID = 'test-location-id'
    process.env.DATABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    const { Client } = require('squareup')
    mockSquareClient = new Client()
    
    mockValidateRequest = require('@/lib/auth/jwt').validateRequest
    mockRateLimitMiddleware = require('@/lib/auth/middleware').rateLimitMiddleware
    
    // Mock fetch for database calls
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      })
    ) as jest.Mock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('POST /api/square/payments', () => {
    it('should create a payment successfully', async () => {
      // Mock Square API response
      mockSquareClient.paymentsApi.createPayment.mockResolvedValue({
        result: {
          payment: {
            id: 'test-payment-id',
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(1000), currency: 'USD' },
            totalMoney: { amount: BigInt(1000), currency: 'USD' },
            receiptUrl: 'https://test-receipt.com',
            receiptNumber: 'TEST123',
            referenceId: 'test-registration-id',
            createdAt: '2025-08-01T12:00:00Z',
            updatedAt: '2025-08-01T12:00:00Z',
          },
        },
        statusCode: 200,
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: {
          sourceId: 'test-source-id',
          amount: 10.00,
          currency: 'USD',
          registrationId: 'test-registration-id',
          customerEmail: 'test@example.com',
        },
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.payment.id).toBe('test-payment-id')
      expect(data.payment.status).toBe('COMPLETED')
      expect(data.payment.amount).toBe(10)
    })

    it('should handle validation errors', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          // Missing required fields
          amount: -10, // Invalid negative amount
        },
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
      expect(data.details).toBeDefined()
    })

    it('should handle rate limiting', async () => {
      mockRateLimitMiddleware.mockResolvedValue(false)

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: {
          sourceId: 'test-source-id',
          amount: 10.00,
          registrationId: 'test-registration-id',
        },
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded. Please try again later.')
    })

    it('should handle Square API errors', async () => {
      mockSquareClient.paymentsApi.createPayment.mockRejectedValue({
        result: {
          errors: [
            {
              category: 'PAYMENT_METHOD_ERROR',
              code: 'CARD_DECLINED',
              detail: 'The card was declined.',
            },
          ],
        },
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          sourceId: 'test-source-id',
          amount: 10.00,
          registrationId: 'test-registration-id',
        },
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Payment processing failed')
    })
  })

  describe('PUT /api/square/payments', () => {
    it('should update payment status with authentication', async () => {
      mockValidateRequest.mockResolvedValue({
        userId: 'test-user-id',
        email: 'admin@example.com',
      })

      const { req, res } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-token',
        },
        body: {
          paymentId: 'test-payment-id',
          status: 'completed',
        },
      })

      const response = await paymentsAPI.PUT(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.paymentId).toBe('test-payment-id')
      expect(data.status).toBe('completed')
    })

    it('should require authentication', async () => {
      mockValidateRequest.mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          paymentId: 'test-payment-id',
          status: 'completed',
        },
      })

      const response = await paymentsAPI.PUT(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('DELETE /api/square/payments (Refund)', () => {
    it('should create a refund successfully', async () => {
      mockValidateRequest.mockResolvedValue({
        userId: 'test-user-id',
        email: 'admin@example.com',
      })

      mockSquareClient.refundsApi.refundPayment.mockResolvedValue({
        result: {
          refund: {
            id: 'test-refund-id',
            paymentId: 'test-payment-id',
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(500), currency: 'USD' },
            reason: 'Customer request',
            createdAt: '2025-08-01T12:00:00Z',
            updatedAt: '2025-08-01T12:00:00Z',
          },
        },
      })

      const { req, res } = createMocks({
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-token',
        },
        body: {
          paymentId: 'test-payment-id',
          amount: 5.00,
          reason: 'Customer request',
        },
      })

      const response = await paymentsAPI.DELETE(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.refund.id).toBe('test-refund-id')
      expect(data.refund.amount).toBe(5)
    })
  })

  describe('GET /api/square/payments', () => {
    it('should query payments successfully', async () => {
      mockValidateRequest.mockResolvedValue({
        userId: 'test-user-id',
        email: 'admin@example.com',
      })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            square_payment_id: 'test-payment-1',
            amount_money_amount: 1000,
            status: 'COMPLETED',
            created_at: '2025-08-01T12:00:00Z',
          },
          {
            square_payment_id: 'test-payment-2',
            amount_money_amount: 2000,
            status: 'PENDING',
            created_at: '2025-08-01T11:00:00Z',
          },
        ]),
      })

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/square/payments?registrationId=test-reg-id&limit=10',
        headers: {
          'authorization': 'Bearer test-token',
        },
      })

      const response = await paymentsAPI.GET(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.payments).toHaveLength(2)
      expect(data.pagination.limit).toBe(10)
    })
  })
})

describe('Square Customers API', () => {
  let mockSquareClient: any

  beforeEach(() => {
    const { Client } = require('squareup')
    mockSquareClient = new Client()
  })

  describe('POST /api/square/customers', () => {
    it('should create a customer successfully', async () => {
      mockSquareClient.customersApi.searchCustomers.mockResolvedValue({
        result: { customers: [] }, // No existing customers
      })

      mockSquareClient.customersApi.createCustomer.mockResolvedValue({
        result: {
          customer: {
            id: 'test-customer-id',
            givenName: 'John',
            familyName: 'Doe',
            emailAddress: 'john@example.com',
            phoneNumber: '+1234567890',
            createdAt: '2025-08-01T12:00:00Z',
            updatedAt: '2025-08-01T12:00:00Z',
          },
        },
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          givenName: 'John',
          familyName: 'Doe',
          emailAddress: 'john@example.com',
          phoneNumber: '+1234567890',
        },
      })

      const response = await customersAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.customer.id).toBe('test-customer-id')
      expect(data.existing).toBe(false)
    })

    it('should return existing customer if found', async () => {
      mockSquareClient.customersApi.searchCustomers.mockResolvedValue({
        result: {
          customers: [
            {
              id: 'existing-customer-id',
              givenName: 'John',
              familyName: 'Doe',
              emailAddress: 'john@example.com',
              createdAt: '2025-07-01T12:00:00Z',
              updatedAt: '2025-07-01T12:00:00Z',
            },
          ],
        },
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          givenName: 'John',
          familyName: 'Doe',
          emailAddress: 'john@example.com',
        },
      })

      const response = await customersAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.customer.id).toBe('existing-customer-id')
      expect(data.existing).toBe(true)
    })
  })

  describe('PUT /api/square/customers', () => {
    it('should update customer successfully', async () => {
      const mockValidateRequest = require('@/lib/auth/jwt').validateRequest
      mockValidateRequest.mockResolvedValue({
        userId: 'test-user-id',
        email: 'admin@example.com',
      })

      mockSquareClient.customersApi.updateCustomer.mockResolvedValue({
        result: {
          customer: {
            id: 'test-customer-id',
            givenName: 'Jane',
            familyName: 'Doe',
            emailAddress: 'jane@example.com',
            updatedAt: '2025-08-01T12:00:00Z',
          },
        },
      })

      const { req, res } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-token',
        },
        body: {
          customerId: 'test-customer-id',
          givenName: 'Jane',
          emailAddress: 'jane@example.com',
        },
      })

      const response = await customersAPI.PUT(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.customer.givenName).toBe('Jane')
    })
  })
})

describe('Square Reconciliation API', () => {
  let mockValidateRequest: any

  beforeEach(() => {
    mockValidateRequest = require('@/lib/auth/jwt').validateRequest
    mockValidateRequest.mockResolvedValue({
      userId: 'test-user-id',
      email: 'admin@example.com',
    })
  })

  describe('GET /api/square/reconciliation', () => {
    it('should generate summary report', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          totalPayments: 100,
          totalAmount: 10000,
          successfulPayments: 95,
          failedPayments: 5,
          refundedPayments: 2,
          discrepancies: 1,
        }),
      })

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/square/reconciliation?type=summary&startDate=2025-07-01&endDate=2025-08-01',
        headers: {
          'authorization': 'Bearer test-token',
        },
      })

      const response = await reconciliationAPI.GET(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reportType).toBe('summary')
      expect(data.data.totalPayments).toBe(100)
    })

    it('should generate discrepancies report', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            paymentId: 'test-payment-1',
            discrepancies: [
              {
                field: 'status',
                square: 'COMPLETED',
                database: 'PENDING',
              },
            ],
          },
        ]),
      })

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/square/reconciliation?type=discrepancies',
        headers: {
          'authorization': 'Bearer test-token',
        },
      })

      const response = await reconciliationAPI.GET(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reportType).toBe('discrepancies')
      expect(data.data).toHaveLength(1)
    })
  })

  describe('POST /api/square/reconciliation/sync', () => {
    it('should sync payments successfully', async () => {
      const mockSquareClient = new (require('squareup').Client)()
      mockSquareClient.paymentsApi.listPayments.mockResolvedValue({
        result: {
          payments: [
            {
              id: 'payment-1',
              status: 'COMPLETED',
              amountMoney: { amount: BigInt(1000), currency: 'USD' },
              createdAt: '2025-08-01T12:00:00Z',
            },
          ],
        },
      })

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/square/reconciliation/sync',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-token',
        },
        body: {
          startDate: '2025-07-01T00:00:00Z',
          endDate: '2025-08-01T23:59:59Z',
          forceSync: true,
        },
      })

      const response = await reconciliationAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.sync).toBeDefined()
    })
  })
})

describe('Square Webhook Integration', () => {
  let mockAuthenticateWebhook: any
  let mockWebhookQueue: any

  beforeEach(() => {
    mockAuthenticateWebhook = require('@/lib/middleware/webhook-auth').authenticateWebhook
    mockWebhookQueue = require('@/lib/middleware/webhook-queue')

    mockAuthenticateWebhook.mockResolvedValue({
      success: true,
      data: {
        event_id: 'test-event-id',
        event_type: 'payment.completed',
        created_at: '2025-08-01T12:00:00Z',
        data: {
          object: {
            payment: {
              id: 'test-payment-id',
              status: 'COMPLETED',
              amount_money: { amount: 1000, currency: 'USD' },
              reference_id: 'test-registration-id',
            },
          },
        },
      },
    })

    mockWebhookQueue.enqueue.mockResolvedValue(true)
  })

  it('should process payment webhook successfully', async () => {
    const { POST } = await import('../../app/api/webhooks/square/payments/route')

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-square-signature': 'test-signature',
      },
      body: {
        event_id: 'test-event-id',
        event_type: 'payment.completed',
        created_at: '2025-08-01T12:00:00Z',
        data: {
          object: {
            payment: {
              id: 'test-payment-id',
              status: 'COMPLETED',
            },
          },
        },
      },
    })

    const response = await POST(req as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.eventId).toBe('test-event-id')
    expect(mockWebhookQueue.enqueue).toHaveBeenCalled()
  })

  it('should process customer webhook successfully', async () => {
    mockAuthenticateWebhook.mockResolvedValue({
      success: true,
      data: {
        event_id: 'test-customer-event-id',
        event_type: 'customer.created',
        created_at: '2025-08-01T12:00:00Z',
        data: {
          object: {
            customer: {
              id: 'test-customer-id',
              email_address: 'test@example.com',
              given_name: 'John',
              family_name: 'Doe',
            },
          },
        },
      },
    })

    const { POST } = await import('../../app/api/webhooks/square/customers/route')

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-square-signature': 'test-signature',
      },
      body: {
        event_id: 'test-customer-event-id',
        event_type: 'customer.created',
      },
    })

    const response = await POST(req as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.eventId).toBe('test-customer-event-id')
  })

  it('should handle webhook authentication failure', async () => {
    mockAuthenticateWebhook.mockResolvedValue({
      success: false,
      error: 'Invalid signature',
    })

    const { POST } = await import('../../app/api/webhooks/square/payments/route')

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: {},
    })

    const response = await POST(req as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Authentication failed')
  })
})

describe('Error Handling and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle database connection failures', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Database connection failed'))

    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/square/payments',
      headers: {
        'authorization': 'Bearer test-token',
      },
    })

    const mockValidateRequest = require('@/lib/auth/jwt').validateRequest
    mockValidateRequest.mockResolvedValue({
      userId: 'test-user-id',
      email: 'admin@example.com',
    })

    const response = await paymentsAPI.GET(req as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })

  it('should handle malformed JSON requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: 'invalid json',
    })

    // Mock JSON parsing to throw error
    const originalJSON = req.json
    req.json = jest.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))

    const response = await paymentsAPI.POST(req as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })

  it('should handle network timeouts', async () => {
    const mockSquareClient = new (require('squareup').Client)()
    mockSquareClient.paymentsApi.createPayment.mockRejectedValue(
      new Error('Network timeout')
    )

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: {
        sourceId: 'test-source-id',
        amount: 10.00,
        registrationId: 'test-registration-id',
      },
    })

    const response = await paymentsAPI.POST(req as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })
})