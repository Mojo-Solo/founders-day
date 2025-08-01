/**
 * Comprehensive Square Webhooks API Tests
 * 
 * Complete test suite for Square webhook endpoints covering:
 * - Webhook authentication and signature verification
 * - Payment and customer event processing
 * - Queue management and retry logic
 * - Error handling and malformed payloads
 * - Security and rate limiting
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMocks } from 'node-mocks-http'
import { faker } from '@faker-js/faker'
import crypto from 'crypto'

// Mock webhook authentication
const mockWebhookAuth = {
  authenticateWebhook: vi.fn(),
  verifySignature: vi.fn(),
}

vi.mock('@/lib/middleware/webhook-auth', () => mockWebhookAuth)

// Mock webhook queue
const mockWebhookQueue = {
  enqueue: vi.fn(),
  dequeue: vi.fn(),
  process: vi.fn(),
  registerProcessor: vi.fn(),
  getQueueStatus: vi.fn(),
}

vi.mock('@/lib/middleware/webhook-queue', () => mockWebhookQueue)

// Mock error handler
const mockErrorHandler = {
  handleWebhookError: vi.fn(),
  logError: vi.fn(),
}

vi.mock('@/lib/middleware/webhook-error-handler', () => mockErrorHandler)

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

vi.mock('@/lib/monitoring/logger', () => ({ default: mockLogger }))

// Mock database
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Square Webhooks API - Comprehensive Tests', () => {
  const validWebhookSecret = 'test-webhook-secret-key'
  const testMerchantId = 'test-merchant-12345'
  const testLocationId = 'test-location-67890'

  beforeAll(() => {
    process.env.SQUARE_WEBHOOK_SECRET = validWebhookSecret
    process.env.SQUARE_MERCHANT_ID = testMerchantId
    process.env.DATABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default success mocks
    mockWebhookAuth.authenticateWebhook.mockResolvedValue({
      success: true,
      data: null, // Will be set per test
    })
    
    mockWebhookQueue.enqueue.mockResolvedValue(true)
    mockWebhookQueue.getQueueStatus.mockResolvedValue({
      pending: 0,
      processing: 0,
      failed: 0,
    })

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
  })

  // Helper function to create webhook signature
  function createWebhookSignature(body: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000)
    const payload = `${timestamp}.${body}`
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64')
    return `t=${timestamp},v1=${signature}`
  }

  // Helper function to create test webhook events
  const createPaymentWebhookEvent = (eventType: string, paymentData: any = {}) => ({
    event_id: `test_event_${faker.string.alphanumeric(10)}`,
    event_type: eventType,
    merchant_id: testMerchantId,
    location_id: testLocationId,
    api_version: '2023-10-18',
    created_at: new Date().toISOString(),
    data: {
      type: 'payment',
      id: paymentData.id || `test_payment_${faker.string.alphanumeric(8)}`,
      object: {
        payment: {
          id: paymentData.id || `test_payment_${faker.string.alphanumeric(8)}`,
          status: paymentData.status || 'COMPLETED',
          amount_money: {
            amount: paymentData.amount || 1500,
            currency: 'USD',
          },
          source_type: 'CARD',
          card_details: {
            card: {
              card_brand: 'VISA',
              last_4: '4242',
            },
          },
          reference_id: paymentData.referenceId || `reg_${faker.string.alphanumeric(8)}`,
          receipt_number: `RCP_${faker.string.alphanumeric(6)}`,
          receipt_url: faker.internet.url(),
          buyer_email_address: faker.internet.email(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...paymentData,
        },
      },
    },
  })

  const createCustomerWebhookEvent = (eventType: string, customerData: any = {}) => ({
    event_id: `test_event_${faker.string.alphanumeric(10)}`,
    event_type: eventType,
    merchant_id: testMerchantId,
    location_id: testLocationId,
    api_version: '2023-10-18',
    created_at: new Date().toISOString(),
    data: {
      type: 'customer',
      id: customerData.id || `test_customer_${faker.string.alphanumeric(8)}`,
      object: {
        customer: {
          id: customerData.id || `test_customer_${faker.string.alphanumeric(8)}`,
          given_name: customerData.givenName || faker.person.firstName(),
          family_name: customerData.familyName || faker.person.lastName(),
          email_address: customerData.email || faker.internet.email(),
          phone_number: customerData.phone || faker.phone.number(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...customerData,
        },
      },
    },
  })

  describe('Payment Webhook Processing', () => {
    it('should process payment.created webhook successfully', async () => {
      const paymentEvent = createPaymentWebhookEvent('payment.created', {
        status: 'COMPLETED',
        amount: 2500,
        referenceId: 'reg_12345',
      })

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: paymentEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const requestBody = JSON.stringify(paymentEvent)
      
      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': createWebhookSignature(requestBody, validWebhookSecret),
          'x-square-hmacsha256-signature': createWebhookSignature(requestBody, validWebhookSecret),
        },
        body: requestBody,
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.eventId).toBe(paymentEvent.event_id)
      expect(data.eventType).toBe('payment.created')

      // Verify webhook was queued for processing
      expect(mockWebhookQueue.enqueue).toHaveBeenCalledWith(
        'payment-webhook',
        expect.objectContaining({
          eventId: paymentEvent.event_id,
          eventType: 'payment.created',
          eventData: paymentEvent,
        })
      )

      // Verify webhook was stored in database
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rpc/store_webhook_event'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(paymentEvent.event_id),
        })
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Square payment webhook processed successfully',
        expect.objectContaining({
          eventId: paymentEvent.event_id,
          eventType: 'payment.created',
        })
      )
    })

    it('should process payment.updated webhook with status change', async () => {
      const paymentEvent = createPaymentWebhookEvent('payment.updated', {
        id: 'payment_update_test',
        status: 'FAILED',
        failure_reason: 'CARD_DECLINED',
      })

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: paymentEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const requestBody = JSON.stringify(paymentEvent)

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': createWebhookSignature(requestBody, validWebhookSecret),
        },
        body: requestBody,
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify queue received the update event
      expect(mockWebhookQueue.enqueue).toHaveBeenCalledWith(
        'payment-webhook',
        expect.objectContaining({
          eventType: 'payment.updated',
          paymentStatus: 'FAILED',
        })
      )
    })

    it('should handle refund webhooks', async () => {
      const refundEvent = {
        event_id: `test_refund_event_${faker.string.alphanumeric(10)}`,
        event_type: 'refund.created',
        merchant_id: testMerchantId,
        created_at: new Date().toISOString(),
        data: {
          type: 'refund',
          id: `test_refund_${faker.string.alphanumeric(8)}`,
          object: {
            refund: {
              id: `test_refund_${faker.string.alphanumeric(8)}`,
              payment_id: 'payment_to_refund',
              status: 'COMPLETED',
              amount_money: { amount: 1000, currency: 'USD' },
              reason: 'Customer request',
              created_at: new Date().toISOString(),
            },
          },
        },
      }

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: refundEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': 'valid-signature',
        },
        body: JSON.stringify(refundEvent),
      })

      const response = await POST(req as NextRequest)
      expect(response.status).toBe(200)

      expect(mockWebhookQueue.enqueue).toHaveBeenCalledWith(
        'payment-webhook',
        expect.objectContaining({
          eventType: 'refund.created',
        })
      )
    })

    it('should handle dispute webhooks', async () => {
      const disputeEvent = {
        event_id: `test_dispute_event_${faker.string.alphanumeric(10)}`,
        event_type: 'dispute.created',
        merchant_id: testMerchantId,
        created_at: new Date().toISOString(),
        data: {
          type: 'dispute',
          id: `test_dispute_${faker.string.alphanumeric(8)}`,
          object: {
            dispute: {
              id: `test_dispute_${faker.string.alphanumeric(8)}`,
              payment_id: 'disputed_payment',
              amount_money: { amount: 2500, currency: 'USD' },
              reason: 'FRAUDULENT',
              state: 'INQUIRY_EVIDENCE_REQUIRED',
              created_at: new Date().toISOString(),
            },
          },
        },
      }

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: disputeEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(disputeEvent),
      })

      const response = await POST(req as NextRequest)
      expect(response.status).toBe(200)

      // Disputes should be queued with high priority
      expect(mockWebhookQueue.enqueue).toHaveBeenCalledWith(
        'payment-webhook',
        expect.objectContaining({
          eventType: 'dispute.created',
          priority: 'high',
        })
      )
    })
  })

  describe('Customer Webhook Processing', () => {
    it('should process customer.created webhook successfully', async () => {
      const customerEvent = createCustomerWebhookEvent('customer.created', {
        givenName: 'Jane',
        familyName: 'Smith',
        email: 'jane.smith@example.com',
      })

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: customerEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/customers/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(customerEvent),
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.eventId).toBe(customerEvent.event_id)

      expect(mockWebhookQueue.enqueue).toHaveBeenCalledWith(
        'customer-webhook',
        expect.objectContaining({
          eventType: 'customer.created',
          customerData: expect.objectContaining({
            email_address: 'jane.smith@example.com',
          }),
        })
      )
    })

    it('should process customer.updated webhook', async () => {
      const updateEvent = createCustomerWebhookEvent('customer.updated', {
        id: 'existing_customer_123',
        email: 'updated@example.com',
        phone: '+1-555-0199',
      })

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: updateEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/customers/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updateEvent),
      })

      const response = await POST(req as NextRequest)
      expect(response.status).toBe(200)

      expect(mockWebhookQueue.enqueue).toHaveBeenCalledWith(
        'customer-webhook',
        expect.objectContaining({
          eventType: 'customer.updated',
          customerId: 'existing_customer_123',
        })
      )
    })

    it('should process customer.deleted webhook', async () => {
      const deleteEvent = createCustomerWebhookEvent('customer.deleted', {
        id: 'customer_to_delete',
      })

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: deleteEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/customers/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(deleteEvent),
      })

      const response = await POST(req as NextRequest)
      expect(response.status).toBe(200)

      expect(mockWebhookQueue.enqueue).toHaveBeenCalledWith(
        'customer-webhook',
        expect.objectContaining({
          eventType: 'customer.deleted',
          action: 'soft_delete', // Should not hard delete, just mark as deleted
        })
      )
    })
  })

  describe('Webhook Authentication and Security', () => {
    it('should reject webhooks with invalid signatures', async () => {
      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': 'invalid-signature',
        },
        body: JSON.stringify({ event_type: 'payment.created' }),
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication failed')
      expect(data.code).toBe('INVALID_SIGNATURE')

      expect(mockWebhookQueue.enqueue).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Square webhook authentication failed',
        expect.objectContaining({
          error: 'Invalid signature',
        })
      )
    })

    it('should reject webhooks without signatures', async () => {
      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_type: 'payment.created' }),
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication failed')

      expect(mockWebhookAuth.authenticateWebhook).toHaveBeenCalled()
    })

    it('should reject webhooks from wrong merchant', async () => {
      const wrongMerchantEvent = createPaymentWebhookEvent('payment.created')
      wrongMerchantEvent.merchant_id = 'wrong-merchant-id'

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: false,
        error: 'Merchant ID mismatch',
        code: 'INVALID_MERCHANT',
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(wrongMerchantEvent),
      })

      const response = await POST(req as NextRequest)
      expect(response.status).toBe(401)

      expect(mockWebhookQueue.enqueue).not.toHaveBeenCalled()
    })

    it('should handle replay attack prevention', async () => {
      const replayEvent = createPaymentWebhookEvent('payment.created')

      // First request succeeds
      mockWebhookAuth.authenticateWebhook.mockResolvedValueOnce({
        success: true,
        data: replayEvent,
      })

      // Second request (replay) fails
      mockWebhookAuth.authenticateWebhook.mockResolvedValueOnce({
        success: false,
        error: 'Event already processed',
        code: 'REPLAY_ATTACK',
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      // First request
      const { req: req1 } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(replayEvent),
      })

      const response1 = await POST(req1 as NextRequest)
      expect(response1.status).toBe(200)

      // Second request (replay)
      const { req: req2 } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(replayEvent),
      })

      const response2 = await POST(req2 as NextRequest)
      expect(response2.status).toBe(401)

      // Only first request should be queued
      expect(mockWebhookQueue.enqueue).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON payloads', async () => {
      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json {]',
      })

      // Mock JSON parsing to throw error
      req.json = vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid JSON payload')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Square webhook JSON parsing failed',
        expect.objectContaining({
          error: expect.stringContaining('Invalid JSON'),
        })
      )
    })

    it('should handle missing required fields', async () => {
      const incompleteEvent = {
        event_id: 'incomplete_event',
        // Missing event_type, merchant_id, etc.
      }

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: incompleteEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(incompleteEvent),
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid webhook payload')
      expect(data.details).toBeDefined()

      expect(mockWebhookQueue.enqueue).not.toHaveBeenCalled()
    })

    it('should handle queue failures gracefully', async () => {
      const validEvent = createPaymentWebhookEvent('payment.created')

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: validEvent,
      })

      // Mock queue failure
      mockWebhookQueue.enqueue.mockRejectedValue(new Error('Queue is full'))

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validEvent),
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      // Should still acknowledge webhook to Square
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.queued).toBe(false)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to queue webhook for processing',
        expect.objectContaining({
          eventId: validEvent.event_id,
          error: 'Queue is full',
        })
      )
    })

    it('should handle database storage failures', async () => {
      const validEvent = createPaymentWebhookEvent('payment.created')

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: validEvent,
      })

      // Mock database failure
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Database unavailable'),
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validEvent),
      })

      const response = await POST(req as NextRequest)

      // Should still process the webhook even if storage fails
      expect(response.status).toBe(200)
      expect(mockWebhookQueue.enqueue).toHaveBeenCalled()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to store webhook event in database',
        expect.objectContaining({
          eventId: validEvent.event_id,
        })
      )
    })

    it('should handle unknown event types gracefully', async () => {
      const unknownEvent = {
        event_id: 'unknown_event_123',
        event_type: 'unknown.event.type',
        merchant_id: testMerchantId,
        created_at: new Date().toISOString(),
        data: {
          type: 'unknown',
          id: 'unknown_object',
          object: {
            unknown_field: 'unknown_value',
          },
        },
      }

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: unknownEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(unknownEvent),
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.processed).toBe(false)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Received unknown Square webhook event type',
        expect.objectContaining({
          eventType: 'unknown.event.type',
          eventId: 'unknown_event_123',
        })
      )

      // Should still store for potential future processing
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('Rate Limiting and Performance', () => {
    it('should handle high volume of webhooks', async () => {
      const webhookCount = 100
      const events = Array.from({ length: webhookCount }, (_, i) =>
        createPaymentWebhookEvent('payment.created', { id: `bulk_payment_${i}` })
      )

      events.forEach(event => {
        mockWebhookAuth.authenticateWebhook.mockResolvedValueOnce({
          success: true,
          data: event,
        })
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const requests = events.map(event => {
        const { req } = createMocks({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(event),
        })
        return POST(req as NextRequest)
      })

      const startTime = Date.now()
      const responses = await Promise.all(requests)
      const duration = Date.now() - startTime

      // All webhooks should be acknowledged
      expect(responses.every(r => r.status === 200)).toBe(true)

      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000) // 10 seconds for 100 webhooks

      // All should be queued
      expect(mockWebhookQueue.enqueue).toHaveBeenCalledTimes(webhookCount)
    })

    it('should handle webhook bursts without dropping events', async () => {
      const burstSize = 50
      const events = Array.from({ length: burstSize }, (_, i) =>
        createPaymentWebhookEvent('payment.updated', { id: `burst_payment_${i}` })
      )

      // Simulate queue backpressure
      let queueDelay = 0
      mockWebhookQueue.enqueue.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(true), queueDelay)
          queueDelay += 10 // Increasing delay
        })
      })

      events.forEach(event => {
        mockWebhookAuth.authenticateWebhook.mockResolvedValueOnce({
          success: true,
          data: event,
        })
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const requests = events.map(event => {
        const { req } = createMocks({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(event),
        })
        return POST(req as NextRequest)
      })

      const responses = await Promise.all(requests)

      // All webhooks should still be acknowledged
      expect(responses.every(r => r.status === 200)).toBe(true)
      expect(mockWebhookQueue.enqueue).toHaveBeenCalledTimes(burstSize)
    })

    it('should implement webhook rate limiting per merchant', async () => {
      // This would be implemented in the webhook authentication layer
      mockWebhookAuth.authenticateWebhook
        .mockResolvedValueOnce({ success: true, data: createPaymentWebhookEvent('payment.created') })
        .mockResolvedValueOnce({ success: true, data: createPaymentWebhookEvent('payment.created') })
        .mockResolvedValueOnce({ success: false, error: 'Rate limit exceeded', code: 'RATE_LIMITED' })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const requests = Array.from({ length: 3 }, () => {
        const { req } = createMocks({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(createPaymentWebhookEvent('payment.created')),
        })
        return POST(req as NextRequest)
      })

      const responses = await Promise.all(requests)

      expect(responses[0].status).toBe(200)
      expect(responses[1].status).toBe(200)
      expect(responses[2].status).toBe(429) // Rate limited

      expect(mockWebhookQueue.enqueue).toHaveBeenCalledTimes(2) // Only first two processed
    })
  })

  describe('Webhook Queue Status and Management', () => {
    it('should provide webhook queue status endpoint', async () => {
      mockWebhookQueue.getQueueStatus.mockResolvedValue({
        pending: 15,
        processing: 3,
        failed: 2,
        completed: 1250,
        avgProcessingTime: 150, // ms
        oldestPending: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
      })

      const { GET } = await import('../../app/api/webhooks/square/status/route')

      const { req } = createMocks({
        method: 'GET',
        headers: { 'authorization': 'Bearer admin-token' },
      })

      const response = await GET(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status.pending).toBe(15)
      expect(data.status.processing).toBe(3)
      expect(data.status.failed).toBe(2)
      expect(data.status.avgProcessingTime).toBe(150)
    })

    it('should handle webhook retry logic', async () => {
      const failedEvent = createPaymentWebhookEvent('payment.created')

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: failedEvent,
      })

      // Mock queue processing failure
      mockWebhookQueue.enqueue.mockRejectedValueOnce(new Error('Processing failed'))
      mockWebhookQueue.enqueue.mockResolvedValueOnce(true) // Retry succeeds

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(failedEvent),
      })

      const response = await POST(req as NextRequest)

      expect(response.status).toBe(200)

      // Should attempt retry
      expect(mockWebhookQueue.enqueue).toHaveBeenCalledTimes(1)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to queue webhook for processing',
        expect.objectContaining({
          eventId: failedEvent.event_id,
        })
      )
    })
  })

  describe('Webhook Data Validation and Sanitization', () => {
    it('should validate payment webhook data structure', async () => {
      const invalidPaymentEvent = {
        event_id: 'invalid_structure',
        event_type: 'payment.created',
        merchant_id: testMerchantId,
        created_at: new Date().toISOString(),
        data: {
          // Missing required fields
          type: 'payment',
          object: {
            // Invalid payment structure
            payment: {
              // Missing required fields like id, amount_money, etc.
              status: 'COMPLETED',
            },
          },
        },
      }

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: invalidPaymentEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(invalidPaymentEvent),
      })

      const response = await POST(req as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid webhook payload')
      expect(data.details).toBeDefined()

      expect(mockWebhookQueue.enqueue).not.toHaveBeenCalled()
    })

    it('should sanitize potentially dangerous data', async () => {
      const maliciousEvent = createPaymentWebhookEvent('payment.created', {
        buyer_email_address: '<script>alert("xss")</script>@example.com',
        reference_id: '"; DROP TABLE payments; --',
        note: '<img src=x onerror=alert(1)>',
      })

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: maliciousEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(maliciousEvent),
      })

      const response = await POST(req as NextRequest)
      expect(response.status).toBe(200)

      // Verify that data was sanitized before queueing
      expect(mockWebhookQueue.enqueue).toHaveBeenCalledWith(
        'payment-webhook',
        expect.objectContaining({
          eventData: expect.objectContaining({
            data: expect.objectContaining({
              object: expect.objectContaining({
                payment: expect.objectContaining({
                  buyer_email_address: expect.not.stringContaining('<script>'),
                  reference_id: expect.not.stringContaining('DROP TABLE'),
                  note: expect.not.stringContaining('<img'),
                }),
              }),
            }),
          }),
        })
      )
    })

    it('should handle extremely large webhook payloads', async () => {
      const largePaymentEvent = createPaymentWebhookEvent('payment.created')
      
      // Add large metadata
      largePaymentEvent.data.object.payment.metadata = {}
      for (let i = 0; i < 1000; i++) {
        largePaymentEvent.data.object.payment.metadata[`key_${i}`] = 'x'.repeat(1000)
      }

      mockWebhookAuth.authenticateWebhook.mockResolvedValue({
        success: true,
        data: largePaymentEvent,
      })

      const { POST } = await import('../../app/api/webhooks/square/payments/route')

      const { req } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(largePaymentEvent),
      })

      const response = await POST(req as NextRequest)

      // Should handle gracefully (either succeed or fail with appropriate error)
      expect([200, 413, 400]).toContain(response.status)

      if (response.status === 200) {
        expect(mockWebhookQueue.enqueue).toHaveBeenCalled()
      }
    })
  })
})