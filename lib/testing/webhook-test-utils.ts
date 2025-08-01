/**
 * Square Webhook Testing Utilities
 * 
 * Comprehensive testing utilities for Square webhook authentication,
 * processing, and integration testing.
 * 
 * Features:
 * - Mock webhook event generation
 * - Signature generation for testing
 * - Integration test helpers
 * - Performance testing utilities
 * - Error scenario simulation
 */

import { createHmac, randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import { WebhookPriority, WebhookJobStatus } from '../middleware/webhook-queue'
import { SquareWebhookEvent } from '../services/webhook-processor'

// Test configuration
export interface WebhookTestConfig {
  webhookSignatureKey: string
  merchantId: string
  locationId: string
  environment: 'sandbox' | 'production'
}

// Mock data generators
export class WebhookTestDataGenerator {
  private config: WebhookTestConfig
  
  constructor(config: Partial<WebhookTestConfig> = {}) {
    this.config = {
      webhookSignatureKey: config.webhookSignatureKey || 'test-signature-key-for-testing-only',
      merchantId: config.merchantId || 'ML1ABCDEFGHIJK123',
      locationId: config.locationId || 'LH1ABCDEFGHIJK123',
      environment: config.environment || 'sandbox'
    }
  }
  
  /**
   * Generate a mock payment.created webhook event
   */
  generatePaymentCreatedEvent(overrides: Partial<any> = {}): SquareWebhookEvent {
    const eventId = `event_${randomBytes(8).toString('hex')}`
    const paymentId = `payment_${randomBytes(8).toString('hex')}`
    const orderId = overrides.orderId || `order_${randomBytes(8).toString('hex')}`
    const customerId = overrides.customerId || `customer_${randomBytes(8).toString('hex')}`
    const amount = overrides.amount || 2500 // $25.00 in cents
    
    return {
      merchant_id: this.config.merchantId,
      type: 'payment.created',
      event_id: eventId,
      created_at: new Date().toISOString(),
      data: {
        type: 'payment',
        id: paymentId,
        object: {
          id: paymentId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          amount_money: {
            amount: amount,
            currency: 'USD'
          },
          status: 'COMPLETED',
          source_type: 'CARD',
          card_details: {
            card: {
              card_brand: 'VISA',
              last_4: '1111',
              exp_month: 12,
              exp_year: 2025,
              fingerprint: `fp_${randomBytes(8).toString('hex')}`
            },
            avs_status: 'AVS_ACCEPTED',
            cvv_status: 'CVV_ACCEPTED'
          },
          location_id: this.config.locationId,
          order_id: orderId,
          customer_id: customerId,
          reference_id: `ref_${randomBytes(4).toString('hex')}`,
          receipt_number: `receipt_${randomBytes(4).toString('hex')}`,
          receipt_url: `https://squareup.com/receipt/preview/${paymentId}`,
          processing_fee: [
            {
              amount_money: {
                amount: 100, // $1.00 processing fee
                currency: 'USD'
              },
              type: 'PROCESSING_FEE'
            }
          ],
          risk_evaluation: {
            created_at: new Date().toISOString(),
            risk_level: 'NORMAL'
          },
          ...overrides.paymentData
        }
      }
    }
  }
  
  /**
   * Generate a mock payment.updated webhook event
   */
  generatePaymentUpdatedEvent(paymentId: string, newStatus: string = 'COMPLETED', overrides: Partial<any> = {}): SquareWebhookEvent {
    const eventId = `event_${randomBytes(8).toString('hex')}`
    
    return {
      merchant_id: this.config.merchantId,
      type: 'payment.updated',
      event_id: eventId,
      created_at: new Date().toISOString(),
      data: {
        type: 'payment',
        id: paymentId,
        object: {
          id: paymentId,
          created_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          updated_at: new Date().toISOString(),
          amount_money: {
            amount: 2500,
            currency: 'USD'
          },
          status: newStatus,
          source_type: 'CARD',
          location_id: this.config.locationId,
          ...overrides.paymentData
        }
      }
    }
  }
  
  /**
   * Generate a mock customer.created webhook event
   */
  generateCustomerCreatedEvent(overrides: Partial<any> = {}): SquareWebhookEvent {
    const eventId = `event_${randomBytes(8).toString('hex')}`
    const customerId = `customer_${randomBytes(8).toString('hex')}`
    
    return {
      merchant_id: this.config.merchantId,
      type: 'customer.created',
      event_id: eventId,
      created_at: new Date().toISOString(),
      data: {
        type: 'customer',
        id: customerId,
        object: {
          id: customerId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          given_name: overrides.given_name || 'John',
          family_name: overrides.family_name || 'Doe',
          email_address: overrides.email_address || 'john.doe@example.com',
          phone_number: overrides.phone_number || '+1-555-123-4567',
          address: overrides.address || {
            address_line_1: '123 Main St',
            locality: 'San Francisco',
            administrative_district_level_1: 'CA',
            postal_code: '94102',
            country: 'US'
          },
          preferences: {
            email_unsubscribed: false
          },
          creation_source: 'THIRD_PARTY',
          version: 0,
          ...overrides.customerData
        }
      }
    }
  }
  
  /**
   * Generate webhook signature for testing
   */
  generateWebhookSignature(body: string): string {
    const hmac = createHmac('sha256', this.config.webhookSignatureKey)
    hmac.update(body, 'utf8')
    return hmac.digest('base64')
  }
  
  /**
   * Create a mock NextRequest for webhook testing
   */
  createMockWebhookRequest(event: SquareWebhookEvent, options: {
    includeSignature?: boolean
    invalidSignature?: boolean
    customHeaders?: Record<string, string>
  } = {}): NextRequest {
    const body = JSON.stringify(event)
    const signature = options.includeSignature !== false 
      ? (options.invalidSignature ? 'invalid-signature' : this.generateWebhookSignature(body))
      : undefined
    
    const headers = new Headers({
      'content-type': 'application/json',
      'user-agent': 'Square-Webhook/1.0',
      ...(signature && { 'x-square-signature': signature }),
      ...options.customHeaders
    })
    
    // Create a mock Request with the body
    const request = new Request('https://example.com/api/webhooks/square', {
      method: 'POST',
      headers,
      body
    })
    
    // Cast to NextRequest (this is a testing utility)
    return request as NextRequest
  }
}

// Test scenario generators
export class WebhookTestScenarios {
  private generator: WebhookTestDataGenerator
  
  constructor(config?: Partial<WebhookTestConfig>) {
    this.generator = new WebhookTestDataGenerator(config)
  }
  
  /**
   * Valid payment flow scenario
   */
  validPaymentFlow() {
    const orderId = `order_${randomBytes(4).toString('hex')}`
    const customerId = `customer_${randomBytes(4).toString('hex')}`
    const paymentId = `payment_${randomBytes(8).toString('hex')}`
    
    return {
      customerCreated: this.generator.generateCustomerCreatedEvent({
        customerData: { id: customerId }
      }),
      paymentCreated: this.generator.generatePaymentCreatedEvent({
        orderId,
        customerId,
        paymentData: { id: paymentId }
      }),
      paymentCompleted: this.generator.generatePaymentUpdatedEvent(paymentId, 'COMPLETED')
    }
  }
  
  /**
   * Failed payment scenario
   */
  failedPaymentFlow() {
    const paymentId = `payment_${randomBytes(8).toString('hex')}`
    
    return {
      paymentCreated: this.generator.generatePaymentCreatedEvent({
        paymentData: { id: paymentId, status: 'PENDING' }
      }),
      paymentFailed: this.generator.generatePaymentUpdatedEvent(paymentId, 'FAILED')
    }
  }
  
  /**
   * Rate limiting test scenario
   */
  rateLimitingScenario(count: number = 10) {
    const events = []
    for (let i = 0; i < count; i++) {
      events.push(this.generator.generatePaymentCreatedEvent({
        paymentData: { id: `payment_rate_test_${i}` }
      }))
    }
    return events
  }
  
  /**
   * Idempotency test scenario (duplicate events)
   */
  idempotencyScenario() {
    const event = this.generator.generatePaymentCreatedEvent()
    return {
      original: event,
      duplicate: { ...event } // Same event_id
    }
  }
  
  /**
   * Invalid signature scenario
   */
  invalidSignatureScenario() {
    const event = this.generator.generatePaymentCreatedEvent()
    return {
      event,
      request: this.generator.createMockWebhookRequest(event, {
        invalidSignature: true
      })
    }
  }
  
  /**
   * Malformed webhook scenarios
   */
  malformedWebhookScenarios() {
    return {
      emptyBody: this.generator.createMockWebhookRequest({} as any, {
        customHeaders: { 'content-length': '0' }
      }),
      invalidJson: new Request('https://example.com/api/webhooks/square', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': 'test-sig'
        },
        body: '{ invalid json'
      }) as NextRequest,
      missingFields: this.generator.createMockWebhookRequest({
        merchant_id: 'test',
        type: 'payment.created'
        // Missing event_id, created_at, data
      } as any)
    }
  }
}

// Performance testing utilities
export class WebhookPerformanceTester {
  private generator: WebhookTestDataGenerator
  
  constructor(config?: Partial<WebhookTestConfig>) {
    this.generator = new WebhookTestDataGenerator(config)
  }
  
  /**
   * Generate load test events
   */
  generateLoadTestEvents(count: number, eventTypes: string[] = ['payment.created', 'payment.updated', 'customer.created']) {
    const events = []
    
    for (let i = 0; i < count; i++) {
      const eventType = eventTypes[i % eventTypes.length]
      
      let event: SquareWebhookEvent
      switch (eventType) {
        case 'payment.created':
          event = this.generator.generatePaymentCreatedEvent({
            paymentData: { id: `load_test_payment_${i}` }
          })
          break
        case 'payment.updated':
          event = this.generator.generatePaymentUpdatedEvent(`load_test_payment_${i}`, 'COMPLETED')
          break
        case 'customer.created':
          event = this.generator.generateCustomerCreatedEvent({
            customerData: { id: `load_test_customer_${i}` }
          })
          break
        default:
          event = this.generator.generatePaymentCreatedEvent()
      }
      
      events.push({
        event,
        request: this.generator.createMockWebhookRequest(event)
      })
    }
    
    return events
  }
  
  /**
   * Measure processing time for multiple events
   */
  async measureProcessingTime(events: any[], processor: (request: NextRequest) => Promise<any>) {
    const results = []
    
    for (const { event, request } of events) {
      const startTime = Date.now()
      
      try {
        const response = await processor(request)
        const endTime = Date.now()
        
        results.push({
          eventId: event.event_id,
          eventType: event.type,
          processingTime: endTime - startTime,
          success: response.status < 400,
          status: response.status
        })
      } catch (error) {
        const endTime = Date.now()
        
        results.push({
          eventId: event.event_id,
          eventType: event.type,
          processingTime: endTime - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return {
      totalEvents: results.length,
      successfulEvents: results.filter(r => r.success).length,
      failedEvents: results.filter(r => !r.success).length,
      averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      minProcessingTime: Math.min(...results.map(r => r.processingTime)),
      maxProcessingTime: Math.max(...results.map(r => r.processingTime)),
      results
    }
  }
}

// Integration test helpers
export class WebhookIntegrationTestHelper {
  private scenarios: WebhookTestScenarios
  private performanceTester: WebhookPerformanceTester
  
  constructor(config?: Partial<WebhookTestConfig>) {
    this.scenarios = new WebhookTestScenarios(config)
    this.performanceTester = new WebhookPerformanceTester(config)
  }
  
  /**
   * Test webhook authentication with various scenarios
   */
  async testAuthentication(authenticator: (request: NextRequest) => Promise<any>) {
    const testCases = [
      {
        name: 'Valid webhook with signature',
        request: this.scenarios.generator.createMockWebhookRequest(
          this.scenarios.generator.generatePaymentCreatedEvent()
        ),
        expectedStatus: 200
      },
      {
        name: 'Invalid signature',
        request: this.scenarios.invalidSignatureScenario().request,
        expectedStatus: 401
      },
      {
        name: 'Missing signature',
        request: this.scenarios.generator.createMockWebhookRequest(
          this.scenarios.generator.generatePaymentCreatedEvent(),
          { includeSignature: false }
        ),
        expectedStatus: 401
      },
      {
        name: 'Invalid content type',
        request: this.scenarios.generator.createMockWebhookRequest(
          this.scenarios.generator.generatePaymentCreatedEvent(),
          { customHeaders: { 'content-type': 'text/plain' } }
        ),
        expectedStatus: 400
      }
    ]
    
    const results = []
    
    for (const testCase of testCases) {
      try {
        const response = await authenticator(testCase.request)
        const success = response.status === testCase.expectedStatus
        
        results.push({
          name: testCase.name,
          success,
          expectedStatus: testCase.expectedStatus,
          actualStatus: response.status,
          passed: success
        })
      } catch (error) {
        results.push({
          name: testCase.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          passed: false
        })
      }
    }
    
    return {
      totalTests: results.length,
      passedTests: results.filter(r => r.passed).length,
      failedTests: results.filter(r => !r.passed).length,
      results
    }
  }
  
  /**
   * Test end-to-end webhook processing
   */
  async testEndToEndProcessing(webhookHandler: (request: NextRequest) => Promise<any>) {
    const paymentFlow = this.scenarios.validPaymentFlow()
    const requests = [
      this.scenarios.generator.createMockWebhookRequest(paymentFlow.customerCreated),
      this.scenarios.generator.createMockWebhookRequest(paymentFlow.paymentCreated),
      this.scenarios.generator.createMockWebhookRequest(paymentFlow.paymentCompleted)
    ]
    
    const results = []
    
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i]
      const eventType = [paymentFlow.customerCreated, paymentFlow.paymentCreated, paymentFlow.paymentCompleted][i].type
      const startTime = Date.now()
      
      try {
        const response = await webhookHandler(request)
        const endTime = Date.now()
        
        results.push({
          step: i + 1,
          eventType,
          success: response.status < 300,
          status: response.status,
          processingTime: endTime - startTime,
          response: await response.json().catch(() => null)
        })
      } catch (error) {
        const endTime = Date.now()
        
        results.push({
          step: i + 1,
          eventType,
          success: false,
          processingTime: endTime - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return {
      overallSuccess: results.every(r => r.success),
      totalSteps: results.length,
      successfulSteps: results.filter(r => r.success).length,
      totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
      results
    }
  }
}

// Export utilities
export {
  WebhookTestDataGenerator,
  WebhookTestScenarios,
  WebhookPerformanceTester,
  WebhookIntegrationTestHelper
}

export type { WebhookTestConfig }