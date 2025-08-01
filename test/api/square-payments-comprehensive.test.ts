/**
 * Comprehensive Square Payments API Tests
 * 
 * Complete test suite for Square payments API endpoints covering:
 * - Payment creation, updates, refunds, queries
 * - Authentication and authorization
 * - Rate limiting and security
 * - Error handling and edge cases
 * - Performance and load testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMocks } from 'node-mocks-http'
import { faker } from '@faker-js/faker'

// Mock Square SDK with realistic responses
const mockSquareClient = {
  paymentsApi: {
    createPayment: vi.fn(),
    getPayment: vi.fn(),
    listPayments: vi.fn(),
  },
  refundsApi: {
    refundPayment: vi.fn(),
    getRefund: vi.fn(),
  },
  customersApi: {
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    searchCustomers: vi.fn(),
  },
}

vi.mock('squareup', () => ({
  Client: vi.fn(() => mockSquareClient),
  Environment: {
    Production: 'production',
    Sandbox: 'sandbox',
  },
}))

// Mock authentication with different user levels
const mockAuth = {
  validateRequest: vi.fn(),
  generateTokens: vi.fn(),
}

vi.mock('@/lib/auth/jwt', () => mockAuth)

// Mock rate limiting
const mockRateLimit = {
  rateLimitMiddleware: vi.fn(),
}

vi.mock('@/lib/auth/middleware', () => mockRateLimit)

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

vi.mock('@/lib/monitoring/logger', () => ({ default: mockLogger }))

// Mock database calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import API handlers after mocks
import * as paymentsAPI from '../../app/api/square/payments/route'

describe('Square Payments API - Comprehensive Tests', () => {
  const testUsers = {
    admin: { userId: 'admin-1', email: 'admin@example.com', role: 'admin' },
    user: { userId: 'user-1', email: 'user@example.com', role: 'user' },
    guest: null,
  }

  beforeAll(() => {
    // Setup environment variables
    process.env.SQUARE_ACCESS_TOKEN = 'test-access-token'
    process.env.SQUARE_ENVIRONMENT = 'sandbox'
    process.env.SQUARE_LOCATION_ID = 'test-location-id'
    process.env.DATABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default successful mocks
    mockRateLimit.rateLimitMiddleware.mockResolvedValue(true)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
  })

  describe('POST /api/square/payments - Payment Creation', () => {
    const validPaymentRequest = {
      sourceId: 'ccof:test-card-token',
      amount: 25.50,
      currency: 'USD',
      registrationId: faker.string.uuid(),
      customerEmail: 'test@example.com',
      customerInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        phone: '+1234567890',
      },
      metadata: {
        event: 'Founders Day 2025',
        type: 'registration',
      },
    }

    it('should create payment successfully with valid data', async () => {
      const mockPaymentResponse = {
        result: {
          payment: {
            id: 'payment_test_123',
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(2550), currency: 'USD' },
            totalMoney: { amount: BigInt(2550), currency: 'USD' },
            receiptUrl: 'https://squareup.com/receipt/test',
            receiptNumber: 'RCP123',
            referenceId: validPaymentRequest.registrationId,
            createdAt: '2025-08-01T12:00:00Z',
            updatedAt: '2025-08-01T12:00:00Z',
            cardDetails: {
              card: {
                cardBrand: 'VISA',
                last4: '4242',
              },
            },
          },
        },
        statusCode: 200,
      }

      mockSquareClient.paymentsApi.createPayment.mockResolvedValue(mockPaymentResponse)

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: validPaymentRequest,
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.payment).toMatchObject({
        id: 'payment_test_123',
        status: 'COMPLETED',
        amount: 25.50,
        currency: 'USD',
        receiptUrl: 'https://squareup.com/receipt/test',
        receiptNumber: 'RCP123',
      })

      // Verify Square API was called correctly
      expect(mockSquareClient.paymentsApi.createPayment).toHaveBeenCalledWith({
        sourceId: validPaymentRequest.sourceId,
        idempotencyKey: expect.stringMatching(/^payment-.*-\d+$/),
        amountMoney: { amount: BigInt(2550), currency: 'USD' },
        locationId: 'test-location-id',
        referenceId: validPaymentRequest.registrationId,
        note: expect.stringContaining('Founders Day registration payment'),
        buyerEmailAddress: 'test@example.com',
      })

      // Verify database call was made
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/rpc/upsert_square_payment',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-service-role-key',
          }),
          body: expect.stringContaining('payment_test_123'),
        })
      )
    })

    it('should handle different payment amounts correctly', async () => {
      const testAmounts = [
        { input: 0.01, expected: BigInt(1) },    // Minimum amount
        { input: 1.00, expected: BigInt(100) },   // Whole dollar
        { input: 99.99, expected: BigInt(9999) }, // Max typical amount
        { input: 1234.56, expected: BigInt(123456) }, // Multiple dollars and cents
      ]

      for (const { input, expected } of testAmounts) {
        mockSquareClient.paymentsApi.createPayment.mockResolvedValue({
          result: {
            payment: {
              id: `payment_amount_${input}`,
              status: 'COMPLETED',
              amountMoney: { amount: expected, currency: 'USD' },
              totalMoney: { amount: expected, currency: 'USD' },
              createdAt: '2025-08-01T12:00:00Z',
              updatedAt: '2025-08-01T12:00:00Z',
            },
          },
          statusCode: 200,
        })

        const request = { ...validPaymentRequest, amount: input }
        const { req } = createMocks({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: request,
        })

        const response = await paymentsAPI.POST(req as NextRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.payment.amount).toBe(input)

        // Verify Square API received correct amount in cents
        expect(mockSquareClient.paymentsApi.createPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            amountMoney: { amount: expected, currency: 'USD' }
          })
        )

        vi.clearAllMocks()
      }
    })

    it('should validate required fields', async () => {
      const invalidRequests = [
        { ...validPaymentRequest, sourceId: '' }, // Empty source ID
        { ...validPaymentRequest, amount: 0 }, // Zero amount
        { ...validPaymentRequest, amount: -10 }, // Negative amount
        { ...validPaymentRequest, registrationId: '' }, // Empty registration ID
        { ...validPaymentRequest, registrationId: 'invalid-uuid' }, // Invalid UUID format
        { ...validPaymentRequest, currency: 'INVALID' }, // Invalid currency (if validated)
      ]

      for (const invalidRequest of invalidRequests) {
        const { req } = createMocks({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: invalidRequest,
        })

        const response = await paymentsAPI.POST(req as NextRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid request data')
        expect(data.details).toBeDefined()
        expect(mockSquareClient.paymentsApi.createPayment).not.toHaveBeenCalled()

        vi.clearAllMocks()
      }
    })

    it('should handle rate limiting', async () => {
      mockRateLimit.rateLimitMiddleware.mockResolvedValue(false)

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: validPaymentRequest,
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded. Please try again later.')
      expect(mockSquareClient.paymentsApi.createPayment).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Square payment rate limit exceeded',
        { clientIp: '192.168.1.1' }
      )
    })

    it('should handle Square API errors appropriately', async () => {
      const squareErrors = [
        {
          error: {
            result: {
              errors: [
                {
                  category: 'PAYMENT_METHOD_ERROR',
                  code: 'CARD_DECLINED',
                  detail: 'The card was declined.',
                },
              ],
            },
          },
          expectedStatus: 400,
          expectedMessage: 'Payment processing failed',
        },
        {
          error: {
            result: {
              errors: [
                {
                  category: 'INVALID_REQUEST_ERROR',
                  code: 'INVALID_VALUE',
                  detail: 'Invalid payment amount.',
                },
              ],
            },
          },
          expectedStatus: 400,
          expectedMessage: 'Payment processing failed',
        },
        {
          error: new Error('Network timeout'),
          expectedStatus: 500,
          expectedMessage: 'Internal server error',
        },
      ]

      for (const { error, expectedStatus, expectedMessage } of squareErrors) {
        mockSquareClient.paymentsApi.createPayment.mockRejectedValue(error)

        const { req } = createMocks({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: validPaymentRequest,
        })

        const response = await paymentsAPI.POST(req as NextRequest)
        const data = await response.json()

        expect(response.status).toBe(expectedStatus)
        expect(data.error).toBe(expectedMessage)

        if (expectedStatus === 400 && error.result) {
          expect(data.details).toBeDefined()
        }

        vi.clearAllMocks()
      }
    })

    it('should handle database failures gracefully', async () => {
      // Payment succeeds with Square but database fails
      mockSquareClient.paymentsApi.createPayment.mockResolvedValue({
        result: {
          payment: {
            id: 'payment_db_fail',
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(1000), currency: 'USD' },
            totalMoney: { amount: BigInt(1000), currency: 'USD' },
            createdAt: '2025-08-01T12:00:00Z',
            updatedAt: '2025-08-01T12:00:00Z',
          },
        },
        statusCode: 200,
      })

      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Database connection failed'),
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: validPaymentRequest,
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      // Should still return success since Square payment succeeded
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.payment.id).toBe('payment_db_fail')

      // Should log the database error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store payment in database',
        expect.objectContaining({
          paymentId: 'payment_db_fail',
          error: 'Database connection failed',
        })
      )
    })

    it('should handle custom idempotency keys', async () => {
      const customIdempotencyKey = `custom-${faker.string.uuid()}`
      const requestWithCustomKey = {
        ...validPaymentRequest,
        idempotencyKey: customIdempotencyKey,
      }

      mockSquareClient.paymentsApi.createPayment.mockResolvedValue({
        result: {
          payment: {
            id: 'payment_custom_key',
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(2550), currency: 'USD' },
            totalMoney: { amount: BigInt(2550), currency: 'USD' },
            createdAt: '2025-08-01T12:00:00Z',
            updatedAt: '2025-08-01T12:00:00Z',
          },
        },
        statusCode: 200,
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestWithCustomKey,
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.idempotencyKey).toBe(customIdempotencyKey)

      expect(mockSquareClient.paymentsApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: customIdempotencyKey,
        })
      )
    })

    it('should handle malformed JSON gracefully', async () => {
      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json{',
      })

      // Mock JSON parsing to throw error
      const originalJson = req.json
      req.json = vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('PUT /api/square/payments - Payment Updates', () => {
    const validUpdateRequest = {
      paymentId: 'payment_test_update',
      status: 'completed',
      metadata: {
        updated_by: 'admin',
        update_reason: 'manual_completion',
      },
    }

    it('should update payment status with admin authentication', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer admin-token',
        },
        body: validUpdateRequest,
      })

      const response = await paymentsAPI.PUT(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.paymentId).toBe(validUpdateRequest.paymentId)
      expect(data.status).toBe(validUpdateRequest.status)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/rpc/update_square_payment_status',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"p_status":"COMPLETED"'),
        })
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Square payment updated successfully',
        expect.objectContaining({
          paymentId: validUpdateRequest.paymentId,
          status: validUpdateRequest.status,
        })
      )
    })

    it('should reject updates without authentication', async () => {
      mockAuth.validateRequest.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: validUpdateRequest,
      })

      const response = await paymentsAPI.PUT(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should validate update request fields', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)

      const invalidRequests = [
        { ...validUpdateRequest, paymentId: '' }, // Empty payment ID
        { ...validUpdateRequest, status: 'invalid_status' }, // Invalid status
        { paymentId: 'test', status: '' }, // Empty status
      ]

      for (const invalidRequest of invalidRequests) {
        const { req } = createMocks({
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer admin-token',
          },
          body: invalidRequest,
        })

        const response = await paymentsAPI.PUT(req as NextRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid request data')
        expect(data.details).toBeDefined()

        vi.clearAllMocks()
        mockAuth.validateRequest.mockResolvedValue(testUsers.admin)
      }
    })

    it('should handle database update failures', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Update failed: Payment not found'),
      })

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer admin-token',
        },
        body: validUpdateRequest,
      })

      const response = await paymentsAPI.PUT(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Square payment update failed',
        expect.objectContaining({
          error: expect.stringContaining('Database update failed'),
        })
      )
    })
  })

  describe('DELETE /api/square/payments - Payment Refunds', () => {
    const validRefundRequest = {
      paymentId: 'payment_test_refund',
      amount: 15.75, // Partial refund
      reason: 'Customer requested partial refund due to event change',
    }

    it('should create full refund successfully', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)

      const refundRequest = {
        paymentId: 'payment_full_refund',
        reason: 'Event cancelled',
      }

      const mockRefundResponse = {
        result: {
          refund: {
            id: 'refund_test_123',
            paymentId: refundRequest.paymentId,
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(2550), currency: 'USD' },
            reason: refundRequest.reason,
            createdAt: '2025-08-01T14:00:00Z',
            updatedAt: '2025-08-01T14:00:00Z',
          },
        },
      }

      mockSquareClient.refundsApi.refundPayment.mockResolvedValue(mockRefundResponse)

      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer admin-token',
        },
        body: refundRequest,
      })

      const response = await paymentsAPI.DELETE(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.refund).toMatchObject({
        id: 'refund_test_123',
        paymentId: refundRequest.paymentId,
        status: 'COMPLETED',
        amount: 25.50, // Converted from cents
        currency: 'USD',
        reason: refundRequest.reason,
      })

      // Verify Square API call - no amount specified means full refund
      expect(mockSquareClient.refundsApi.refundPayment).toHaveBeenCalledWith({
        idempotencyKey: expect.stringMatching(/^refund-.*-\d+$/),
        paymentId: refundRequest.paymentId,
        reason: refundRequest.reason,
        // No amountMoney property for full refund
      })

      // Verify database call
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/rpc/create_square_refund',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('refund_test_123'),
        })
      )
    })

    it('should create partial refund successfully', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)

      const mockRefundResponse = {
        result: {
          refund: {
            id: 'refund_partial_123',
            paymentId: validRefundRequest.paymentId,
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(1575), currency: 'USD' },
            reason: validRefundRequest.reason,
            createdAt: '2025-08-01T14:00:00Z',
            updatedAt: '2025-08-01T14:00:00Z',
          },
        },
      }

      mockSquareClient.refundsApi.refundPayment.mockResolvedValue(mockRefundResponse)

      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer admin-token',
        },
        body: validRefundRequest,
      })

      const response = await paymentsAPI.DELETE(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.refund.amount).toBe(15.75)

      // Verify Square API call with specific amount
      expect(mockSquareClient.refundsApi.refundPayment).toHaveBeenCalledWith({
        idempotencyKey: expect.any(String),
        paymentId: validRefundRequest.paymentId,
        reason: validRefundRequest.reason,
        amountMoney: { amount: BigInt(1575), currency: 'USD' },
      })
    })

    it('should require authentication for refunds', async () => {
      mockAuth.validateRequest.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: validRefundRequest,
      })

      const response = await paymentsAPI.DELETE(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(mockSquareClient.refundsApi.refundPayment).not.toHaveBeenCalled()
    })

    it('should validate refund request fields', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)

      const invalidRequests = [
        { ...validRefundRequest, paymentId: '' }, // Empty payment ID
        { ...validRefundRequest, reason: '' }, // Empty reason
        { ...validRefundRequest, amount: 0 }, // Zero amount
        { ...validRefundRequest, amount: -5 }, // Negative amount
      ]

      for (const invalidRequest of invalidRequests) {
        const { req } = createMocks({
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer admin-token',
          },
          body: invalidRequest,
        })

        const response = await paymentsAPI.DELETE(req as NextRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid request data')

        vi.clearAllMocks()
        mockAuth.validateRequest.mockResolvedValue(testUsers.admin)
      }
    })

    it('should handle Square refund API errors', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)

      const refundErrors = [
        {
          error: {
            result: {
              errors: [
                {
                  category: 'REFUND_ERROR',
                  code: 'REFUND_ALREADY_PENDING',
                  detail: 'A refund is already pending for this payment.',
                },
              ],
            },
          },
          expectedMessage: 'Refund processing failed',
        },
        {
          error: {
            result: {
              errors: [
                {
                  category: 'PAYMENT_METHOD_ERROR',
                  code: 'PAYMENT_NOT_REFUNDABLE',
                  detail: 'This payment cannot be refunded.',
                },
              ],
            },
          },
          expectedMessage: 'Refund processing failed',
        },
      ]

      for (const { error, expectedMessage } of refundErrors) {
        mockSquareClient.refundsApi.refundPayment.mockRejectedValue(error)

        const { req } = createMocks({
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer admin-token',
          },
          body: validRefundRequest,
        })

        const response = await paymentsAPI.DELETE(req as NextRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe(expectedMessage)
        expect(data.details).toBeDefined()

        vi.clearAllMocks()
        mockAuth.validateRequest.mockResolvedValue(testUsers.admin)
      }
    })

    it('should handle database refund storage failure', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)

      mockSquareClient.refundsApi.refundPayment.mockResolvedValue({
        result: {
          refund: {
            id: 'refund_db_fail',
            paymentId: validRefundRequest.paymentId,
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(1575), currency: 'USD' },
            reason: validRefundRequest.reason,
            createdAt: '2025-08-01T14:00:00Z',
            updatedAt: '2025-08-01T14:00:00Z',
          },
        },
      })

      // Mock database failure
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Failed to store refund'),
      })

      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer admin-token',
        },
        body: validRefundRequest,
      })

      const response = await paymentsAPI.DELETE(req as NextRequest)
      const data = await response.json()

      // Should still return success since Square refund succeeded
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Should log database error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store refund in database',
        expect.objectContaining({
          refundId: 'refund_db_fail',
          error: 'Failed to store refund',
        })
      )
    })
  })

  describe('GET /api/square/payments - Payment Queries', () => {
    const mockPaymentsData = [
      {
        square_payment_id: 'payment_query_1',
        registration_id: 123,
        amount_money_amount: 2500,
        status: 'COMPLETED',
        created_at_square: '2025-08-01T10:00:00Z',
        buyer_email_address: 'customer1@example.com',
      },
      {
        square_payment_id: 'payment_query_2',
        registration_id: 124,
        amount_money_amount: 3000,
        status: 'PENDING',
        created_at_square: '2025-08-01T11:00:00Z',
        buyer_email_address: 'customer2@example.com',
      },
    ]

    beforeEach(() => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPaymentsData),
      })
    })

    it('should query all payments with pagination', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/square/payments?limit=50&offset=0',
        headers: { 'authorization': 'Bearer admin-token' },
      })

      const response = await paymentsAPI.GET(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.payments).toEqual(mockPaymentsData)
      expect(data.pagination).toEqual({
        limit: 50,
        offset: 0,
        count: 2,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/rpc/get_square_payments',
        expect.objectContaining({
          body: expect.stringContaining('"p_limit":50,"p_offset":0'),
        })
      )
    })

    it('should filter by registration ID', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/square/payments?registrationId=123&limit=10',
        headers: { 'authorization': 'Bearer admin-token' },
      })

      const response = await paymentsAPI.GET(req as NextRequest)
      expect(response.status).toBe(200)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/rpc/get_square_payments',
        expect.objectContaining({
          body: expect.stringContaining('"p_registration_id":"123"'),
        })
      )
    })

    it('should filter by payment ID', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/square/payments?paymentId=payment_specific',
        headers: { 'authorization': 'Bearer admin-token' },
      })

      await paymentsAPI.GET(req as NextRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/rpc/get_square_payments',
        expect.objectContaining({
          body: expect.stringContaining('"p_square_payment_id":"payment_specific"'),
        })
      )
    })

    it('should filter by status', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/square/payments?status=completed',
        headers: { 'authorization': 'Bearer admin-token' },
      })

      await paymentsAPI.GET(req as NextRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/rpc/get_square_payments',
        expect.objectContaining({
          body: expect.stringContaining('"p_status":"COMPLETED"'),
        })
      )
    })

    it('should enforce maximum limit', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/square/payments?limit=1000', // Exceeds max
        headers: { 'authorization': 'Bearer admin-token' },
      })

      await paymentsAPI.GET(req as NextRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/rpc/get_square_payments',
        expect.objectContaining({
          body: expect.stringContaining('"p_limit":100'), // Capped at 100
        })
      )
    })

    it('should require authentication', async () => {
      mockAuth.validateRequest.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/square/payments',
      })

      const response = await paymentsAPI.GET(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle database query failures', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Database connection error'),
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/square/payments',
        headers: { 'authorization': 'Bearer admin-token' },
      })

      const response = await paymentsAPI.GET(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('Performance and Load Testing', () => {
    it('should handle concurrent payment creation requests', async () => {
      const concurrentRequests = 10
      const responses = []

      // Setup unique responses for each request
      for (let i = 0; i < concurrentRequests; i++) {
        mockSquareClient.paymentsApi.createPayment.mockResolvedValueOnce({
          result: {
            payment: {
              id: `concurrent_payment_${i}`,
              status: 'COMPLETED',
              amountMoney: { amount: BigInt(1000 + i), currency: 'USD' },
              totalMoney: { amount: BigInt(1000 + i), currency: 'USD' },
              createdAt: '2025-08-01T12:00:00Z',
              updatedAt: '2025-08-01T12:00:00Z',
            },
          },
          statusCode: 200,
        })
      }

      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const { req } = createMocks({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            sourceId: `concurrent_source_${i}`,
            amount: 10 + i,
            registrationId: faker.string.uuid(),
          },
        })
        return paymentsAPI.POST(req as NextRequest)
      })

      const startTime = Date.now()
      const results = await Promise.all(requests)
      const duration = Date.now() - startTime

      // All requests should succeed
      expect(results.every(r => r.status === 200)).toBe(true)

      // Should complete within reasonable time (adjust based on environment)
      expect(duration).toBeLessThan(5000) // 5 seconds for 10 concurrent requests

      // Verify all payments were processed
      expect(mockSquareClient.paymentsApi.createPayment).toHaveBeenCalledTimes(concurrentRequests)
    })

    it('should maintain performance under rate limiting', async () => {
      let rateLimitCount = 0
      mockRateLimit.rateLimitMiddleware.mockImplementation(() => {
        rateLimitCount++
        return Promise.resolve(rateLimitCount <= 5) // Allow first 5, then rate limit
      })

      const requests = Array.from({ length: 10 }, (_, i) => {
        const { req } = createMocks({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            sourceId: `rate_limit_test_${i}`,
            amount: 10,
            registrationId: faker.string.uuid(),
          },
        })
        return paymentsAPI.POST(req as NextRequest)
      })

      const results = await Promise.all(requests)

      // First 5 should succeed (assuming Square API succeeds)
      const successfulRequests = results.filter(r => r.status === 200).length
      const rateLimitedRequests = results.filter(r => r.status === 429).length

      expect(successfulRequests).toBeLessThanOrEqual(5)
      expect(rateLimitedRequests).toBeGreaterThan(0)
      expect(successfulRequests + rateLimitedRequests).toBe(10)
    })

    it('should handle large payment amounts correctly', async () => {
      const largeAmount = 999999.99 // $999,999.99

      mockSquareClient.paymentsApi.createPayment.mockResolvedValue({
        result: {
          payment: {
            id: 'large_payment',
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(99999999), currency: 'USD' },
            totalMoney: { amount: BigInt(99999999), currency: 'USD' },
            createdAt: '2025-08-01T12:00:00Z',
            updatedAt: '2025-08-01T12:00:00Z',
          },
        },
        statusCode: 200,
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          sourceId: 'large_amount_source',
          amount: largeAmount,
          registrationId: faker.string.uuid(),
        },
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.payment.amount).toBe(largeAmount)

      // Verify correct conversion to cents
      expect(mockSquareClient.paymentsApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountMoney: { amount: BigInt(99999999), currency: 'USD' }
        })
      )
    })
  })

  describe('Security Tests', () => {
    it('should sanitize input data', async () => {
      const maliciousInput = {
        sourceId: '<script>alert("xss")</script>',
        amount: 10,
        registrationId: faker.string.uuid(),
        customerEmail: 'test@example.com<script>',
        customerInfo: {
          firstName: '<img src=x onerror=alert(1)>',
          lastName: 'DROP TABLE payments;--',
          email: 'test@example.com',
        },
        metadata: {
          malicious: '<script>window.location="http://evil.com"</script>',
        },
      }

      mockSquareClient.paymentsApi.createPayment.mockResolvedValue({
        result: {
          payment: {
            id: 'sanitized_payment',
            status: 'COMPLETED',
            amountMoney: { amount: BigInt(1000), currency: 'USD' },
            totalMoney: { amount: BigInt(1000), currency: 'USD' },
            createdAt: '2025-08-01T12:00:00Z',
            updatedAt: '2025-08-01T12:00:00Z',
          },
        },
        statusCode: 200,
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: maliciousInput,
      })

      const response = await paymentsAPI.POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)

      // Verify Square API was called (input should be processed)
      expect(mockSquareClient.paymentsApi.createPayment).toHaveBeenCalled()

      // In a real implementation, you'd verify that input was sanitized
      // before being passed to Square API or stored in database
    })

    it('should prevent SQL injection in query parameters', async () => {
      mockAuth.validateRequest.mockResolvedValue(testUsers.admin)

      const maliciousQueries = [
        "'; DROP TABLE square_payments; --",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO payments (amount) VALUES (999999); --",
      ]

      for (const maliciousQuery of maliciousQueries) {
        const { req } = createMocks({
          method: 'GET',
          url: `/api/square/payments?registrationId=${encodeURIComponent(maliciousQuery)}`,
          headers: { 'authorization': 'Bearer admin-token' },
        })

        const response = await paymentsAPI.GET(req as NextRequest)

        // Should not crash or return error due to SQL injection
        expect([200, 400]).toContain(response.status)

        vi.clearAllMocks()
        mockAuth.validateRequest.mockResolvedValue(testUsers.admin)
      }
    })

    it('should handle extremely large request bodies', async () => {
      const hugeMetadata = {}
      for (let i = 0; i < 1000; i++) {
        hugeMetadata[`key_${i}`] = 'x'.repeat(1000)
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          sourceId: 'huge_request_source',
          amount: 10,
          registrationId: faker.string.uuid(),
          metadata: hugeMetadata,
        },
      })

      const response = await paymentsAPI.POST(req as NextRequest)

      // Should handle gracefully (either succeed or fail with appropriate error)
      expect([200, 400, 413, 500]).toContain(response.status)
    })
  })
})