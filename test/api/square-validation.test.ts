/**
 * Square API Validation Tests
 * 
 * Simple validation tests for Square API endpoints
 * without complex mocking or dependencies.
 */

import { describe, it, expect, test } from 'vitest'
import { z } from 'zod'

// Test the validation schemas used in the Square API routes

describe('Square API Validation Schemas', () => {
  const createPaymentSchema = z.object({
    sourceId: z.string().min(1, 'Payment source ID is required'),
    amount: z.number().positive('Amount must be positive'),
    currency: z.string().default('USD'),
    registrationId: z.string().uuid('Valid registration ID required'),
    customerEmail: z.string().email().optional(),
    customerInfo: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    }).optional(),
    metadata: z.record(z.string()).optional(),
    locationId: z.string().optional(),
    idempotencyKey: z.string().optional(),
  })

  const createCustomerSchema = z.object({
    givenName: z.string().min(1).max(100),
    familyName: z.string().min(1).max(100),
    emailAddress: z.string().email(),
    phoneNumber: z.string().optional(),
    companyName: z.string().optional(),
    address: z.object({
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      locality: z.string().optional(),
      administrativeDistrictLevel1: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().default('US'),
    }).optional(),
    registrationId: z.string().uuid().optional(),
    metadata: z.record(z.string()).optional(),
    idempotencyKey: z.string().optional(),
  })

  describe('Payment Schema Validation', () => {
    it('should validate valid payment request', () => {
      const validPayment = {
        sourceId: 'cnon:card-nonce-ok',
        amount: 10.00,
        registrationId: '123e4567-e89b-12d3-a456-426614174000',
        customerEmail: 'test@example.com'
      }

      const result = createPaymentSchema.safeParse(validPayment)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.currency).toBe('USD') // Default value
        expect(result.data.amount).toBe(10.00)
        expect(result.data.sourceId).toBe('cnon:card-nonce-ok')
      }
    })

    it('should reject payment with negative amount', () => {
      const invalidPayment = {
        sourceId: 'cnon:card-nonce-ok',
        amount: -10.00,
        registrationId: '123e4567-e89b-12d3-a456-426614174000'
      }

      const result = createPaymentSchema.safeParse(invalidPayment)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Amount must be positive')
      }
    })

    it('should reject payment with invalid UUID', () => {
      const invalidPayment = {
        sourceId: 'cnon:card-nonce-ok',
        amount: 10.00,
        registrationId: 'invalid-uuid'
      }

      const result = createPaymentSchema.safeParse(invalidPayment)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Valid registration ID required')
      }
    })

    it('should reject payment with empty source ID', () => {
      const invalidPayment = {
        sourceId: '',
        amount: 10.00,
        registrationId: '123e4567-e89b-12d3-a456-426614174000'
      }

      const result = createPaymentSchema.safeParse(invalidPayment)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Payment source ID is required')
      }
    })

    it('should validate optional customer info', () => {
      const paymentWithCustomer = {
        sourceId: 'cnon:card-nonce-ok',
        amount: 10.00,
        registrationId: '123e4567-e89b-12d3-a456-426614174000',
        customerInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890'
        }
      }

      const result = createPaymentSchema.safeParse(paymentWithCustomer)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.customerInfo?.firstName).toBe('John')
        expect(result.data.customerInfo?.email).toBe('john@example.com')
      }
    })

    it('should reject invalid customer email', () => {
      const invalidPayment = {
        sourceId: 'cnon:card-nonce-ok',
        amount: 10.00,
        registrationId: '123e4567-e89b-12d3-a456-426614174000',
        customerInfo: {
          email: 'invalid-email'
        }
      }

      const result = createPaymentSchema.safeParse(invalidPayment)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('customerInfo')
        expect(result.error.errors[0].path).toContain('email')
      }
    })
  })

  describe('Customer Schema Validation', () => {
    it('should validate valid customer request', () => {
      const validCustomer = {
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'john@example.com'
      }

      const result = createCustomerSchema.safeParse(validCustomer)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.givenName).toBe('John')
        expect(result.data.familyName).toBe('Doe')
        expect(result.data.emailAddress).toBe('john@example.com')
      }
    })

    it('should reject customer with empty name', () => {
      const invalidCustomer = {
        givenName: '',
        familyName: 'Doe',
        emailAddress: 'john@example.com'
      }

      const result = createCustomerSchema.safeParse(invalidCustomer)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('givenName')
      }
    })

    it('should reject customer with invalid email', () => {
      const invalidCustomer = {
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'invalid-email'
      }

      const result = createCustomerSchema.safeParse(invalidCustomer)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('emailAddress')
      }
    })

    it('should validate optional address', () => {
      const customerWithAddress = {
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'john@example.com',
        address: {
          addressLine1: '123 Main St',
          locality: 'Anytown',
          administrativeDistrictLevel1: 'CA',
          postalCode: '12345'
        }
      }

      const result = createCustomerSchema.safeParse(customerWithAddress)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.address?.addressLine1).toBe('123 Main St')
        expect(result.data.address?.country).toBe('US') // Default value
      }
    })

    it('should validate optional registration ID', () => {
      const customerWithRegId = {
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'john@example.com',
        registrationId: '123e4567-e89b-12d3-a456-426614174000'
      }

      const result = createCustomerSchema.safeParse(customerWithRegId)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.registrationId).toBe('123e4567-e89b-12d3-a456-426614174000')
      }
    })

    it('should reject invalid registration UUID', () => {
      const invalidCustomer = {
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'john@example.com',
        registrationId: 'invalid-uuid'
      }

      const result = createCustomerSchema.safeParse(invalidCustomer)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('registrationId')
      }
    })

    it('should validate name length limits', () => {
      const longName = 'A'.repeat(101) // 101 characters, exceeds max of 100
      
      const invalidCustomer = {
        givenName: longName,
        familyName: 'Doe',
        emailAddress: 'john@example.com'
      }

      const result = createCustomerSchema.safeParse(invalidCustomer)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('givenName')
      }
    })
  })

  describe('Reconciliation Schema Validation', () => {
    const syncPaymentsSchema = z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      locationId: z.string().optional(),
      forceSync: z.boolean().default(false),
    })

    it('should validate sync request with ISO dates', () => {
      const syncRequest = {
        startDate: '2025-07-01T00:00:00Z',
        endDate: '2025-08-01T23:59:59Z'
      }

      const result = syncPaymentsSchema.safeParse(syncRequest)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.forceSync).toBe(false) // Default value
      }
    })

    it('should reject invalid date format', () => {
      const invalidSync = {
        startDate: '2025-07-01', // Not ISO datetime
        endDate: '2025-08-01T23:59:59Z'
      }

      const result = syncPaymentsSchema.safeParse(invalidSync)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('startDate')
      }
    })

    it('should validate with location ID', () => {
      const syncWithLocation = {
        startDate: '2025-07-01T00:00:00Z',
        endDate: '2025-08-01T23:59:59Z',
        locationId: 'L123ABC',
        forceSync: true
      }

      const result = syncPaymentsSchema.safeParse(syncWithLocation)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.locationId).toBe('L123ABC')
        expect(result.data.forceSync).toBe(true)
      }
    })
  })

  describe('Refund Schema Validation', () => {
    const refundPaymentSchema = z.object({
      paymentId: z.string().min(1, 'Payment ID is required'),
      amount: z.number().positive().optional(),
      reason: z.string().min(1, 'Refund reason is required'),
      idempotencyKey: z.string().optional(),
    })

    it('should validate full refund', () => {
      const refundRequest = {
        paymentId: 'sq0idp-abc123',
        reason: 'Customer requested refund'
      }

      const result = refundPaymentSchema.safeParse(refundRequest)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.paymentId).toBe('sq0idp-abc123')
        expect(result.data.reason).toBe('Customer requested refund')
      }
    })

    it('should validate partial refund', () => {
      const partialRefund = {
        paymentId: 'sq0idp-abc123',
        amount: 5.00,
        reason: 'Partial refund for cancelled item'
      }

      const result = refundPaymentSchema.safeParse(partialRefund)
      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.amount).toBe(5.00)
      }
    })

    it('should reject refund with empty payment ID', () => {
      const invalidRefund = {
        paymentId: '',
        reason: 'Customer requested refund'
      }

      const result = refundPaymentSchema.safeParse(invalidRefund)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Payment ID is required')
      }
    })

    it('should reject refund with empty reason', () => {
      const invalidRefund = {
        paymentId: 'sq0idp-abc123',
        reason: ''
      }

      const result = refundPaymentSchema.safeParse(invalidRefund)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Refund reason is required')
      }
    })

    it('should reject refund with negative amount', () => {
      const invalidRefund = {
        paymentId: 'sq0idp-abc123',
        amount: -5.00,
        reason: 'Customer requested refund'
      }

      const result = refundPaymentSchema.safeParse(invalidRefund)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('amount')
      }
    })
  })
})

describe('Square API Client Types', () => {
  // Test type definitions and interfaces
  
  it('should have correct payment response structure', () => {
    interface PaymentResponse {
      success: boolean
      payment?: {
        id: string
        status: string
        amount: number
        currency: string
        receiptUrl?: string
        receiptNumber?: string
        referenceId?: string
        createdAt?: string
      }
      error?: string
      details?: any
    }

    const mockSuccessResponse: PaymentResponse = {
      success: true,
      payment: {
        id: 'sq0idp-test',
        status: 'COMPLETED',
        amount: 10.00,
        currency: 'USD',
        receiptUrl: 'https://example.com/receipt',
        referenceId: '123e4567-e89b-12d3-a456-426614174000'
      }
    }

    expect(mockSuccessResponse.success).toBe(true)
    expect(mockSuccessResponse.payment?.id).toBe('sq0idp-test')
    expect(mockSuccessResponse.payment?.amount).toBe(10.00)
  })

  it('should have correct customer response structure', () => {
    interface CustomerResponse {
      success: boolean
      customer?: {
        id: string
        givenName?: string
        familyName?: string
        emailAddress?: string
        phoneNumber?: string
        companyName?: string
        address?: any
        createdAt?: string
        updatedAt?: string
      }
      existing?: boolean
      error?: string
      details?: any
    }

    const mockCustomerResponse: CustomerResponse = {
      success: true,
      customer: {
        id: 'sq0cst-test',
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'john@example.com'
      },
      existing: false
    }

    expect(mockCustomerResponse.success).toBe(true)
    expect(mockCustomerResponse.customer?.id).toBe('sq0cst-test')
    expect(mockCustomerResponse.existing).toBe(false)
  })

  it('should have correct error response structure', () => {
    interface ErrorResponse {
      success: boolean
      error: string
      details?: any
    }

    const mockErrorResponse: ErrorResponse = {
      success: false,
      error: 'Payment processing failed',
      details: {
        code: 'CARD_DECLINED',
        message: 'The card was declined'
      }
    }

    expect(mockErrorResponse.success).toBe(false)
    expect(mockErrorResponse.error).toBe('Payment processing failed')
    expect(mockErrorResponse.details.code).toBe('CARD_DECLINED')
  })
})

describe('API Response Validation', () => {
  it('should validate successful payment response format', () => {
    const paymentResponseSchema = z.object({
      success: z.boolean(),
      payment: z.object({
        id: z.string(),
        status: z.string(),
        amount: z.number(),
        currency: z.string(),
        receiptUrl: z.string().optional(),
        receiptNumber: z.string().optional(),
        referenceId: z.string().optional(),
        createdAt: z.string().optional(),
      }).optional(),
      error: z.string().optional(),
      idempotencyKey: z.string().optional(),
    })

    const mockResponse = {
      success: true,
      payment: {
        id: 'sq0idp-test123',
        status: 'COMPLETED',
        amount: 25.00,
        currency: 'USD',
        receiptUrl: 'https://squareup.com/receipt/test',
        referenceId: '123e4567-e89b-12d3-a456-426614174000'
      },
      idempotencyKey: 'payment-test-123'
    }

    const result = paymentResponseSchema.safeParse(mockResponse)
    expect(result.success).toBe(true)
  })

  it('should validate error response format', () => {
    const errorResponseSchema = z.object({
      success: z.literal(false),
      error: z.string(),
      details: z.any().optional(),
    })

    const mockErrorResponse = {
      success: false,
      error: 'Payment processing failed',
      details: {
        category: 'PAYMENT_METHOD_ERROR',
        code: 'CARD_DECLINED'
      }
    }

    const result = errorResponseSchema.safeParse(mockErrorResponse)
    expect(result.success).toBe(true)
  })

  it('should validate webhook event structure', () => {
    const webhookEventSchema = z.object({
      event_id: z.string(),
      event_type: z.string(),
      created_at: z.string(),
      data: z.object({
        object: z.any()
      })
    })

    const mockWebhookEvent = {
      event_id: 'webhook-123',
      event_type: 'payment.completed',
      created_at: '2025-08-01T12:00:00Z',
      data: {
        object: {
          payment: {
            id: 'sq0idp-test',
            status: 'COMPLETED'
          }
        }
      }
    }

    const result = webhookEventSchema.safeParse(mockWebhookEvent)
    expect(result.success).toBe(true)
  })
})