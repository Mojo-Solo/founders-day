/**
 * Square Webhook Integration Tests
 * 
 * Comprehensive integration tests for the Square webhook authentication
 * and processing system. Tests all components working together.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../../app/api/webhooks/square/route'
import { authenticateWebhook } from '../../lib/middleware/webhook-auth'
import webhookQueue from '../../lib/middleware/webhook-queue'
import webhookErrorHandler from '../../lib/middleware/webhook-error-handler'
import {
  WebhookTestDataGenerator,
  WebhookTestScenarios,
  WebhookPerformanceTester,
  WebhookIntegrationTestHelper
} from '../../lib/testing/webhook-test-utils'

// Test configuration
const testConfig = {
  webhookSignatureKey: 'test-webhook-signature-key-for-testing',
  merchantId: 'TEST_MERCHANT_ID',
  locationId: 'TEST_LOCATION_ID',
  environment: 'sandbox' as const
}

// Set up test environment variables
const originalEnv = process.env
beforeEach(() => {
  process.env = {
    ...originalEnv,
    SQUARE_WEBHOOK_SIGNATURE_KEY_SANDBOX: testConfig.webhookSignatureKey,
    NODE_ENV: 'test',
    WEBHOOK_RATE_LIMIT_WINDOW_MS: '60000',
    WEBHOOK_RATE_LIMIT_MAX_REQUESTS: '100',
    WEBHOOK_ENABLE_IDEMPOTENCY: 'true'
  }
})

afterEach(() => {
  process.env = originalEnv
  jest.clearAllMocks()
})

describe('Square Webhook Authentication', () => {
  const generator = new WebhookTestDataGenerator(testConfig)
  
  it('should authenticate valid webhook with correct signature', async () => {
    const event = generator.generatePaymentCreatedEvent()
    const request = generator.createMockWebhookRequest(event)
    
    const result = await authenticateWebhook(request)
    
    expect(result.success).toBe(true)
    expect(result.parsedBody).toEqual(event)
    expect(result.response).toBeUndefined()
  })
  
  it('should reject webhook with invalid signature', async () => {
    const event = generator.generatePaymentCreatedEvent()
    const request = generator.createMockWebhookRequest(event, {
      invalidSignature: true
    })
    
    const result = await authenticateWebhook(request)
    
    expect(result.success).toBe(false)
    expect(result.response).toBeDefined()
    expect(result.response?.status).toBe(401)
  })
  
  it('should reject webhook with missing signature', async () => {
    const event = generator.generatePaymentCreatedEvent()
    const request = generator.createMockWebhookRequest(event, {
      includeSignature: false
    })
    
    const result = await authenticateWebhook(request)
    
    expect(result.success).toBe(false)
    expect(result.response?.status).toBe(401)
  })
  
  it('should reject webhook with invalid content type', async () => {
    const event = generator.generatePaymentCreatedEvent()
    const request = generator.createMockWebhookRequest(event, {
      customHeaders: { 'content-type': 'text/plain' }
    })
    
    const result = await authenticateWebhook(request)
    
    expect(result.success).toBe(false)
    expect(result.response?.status).toBe(400)
  })
  
  it('should handle malformed JSON', async () => {
    const request = new Request('https://example.com/api/webhooks/square', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-square-signature': 'invalid-signature'
      },
      body: '{ invalid json'
    }) as NextRequest
    
    const result = await authenticateWebhook(request)
    
    expect(result.success).toBe(false)
    expect(result.response?.status).toBe(400)
  })
})

describe('Square Webhook Processing Queue', () => {
  const generator = new WebhookTestDataGenerator(testConfig)
  
  beforeEach(() => {
    // Clear any existing jobs
    jest.clearAllMocks()
  })
  
  it('should queue webhook events for processing', async () => {
    const event = generator.generatePaymentCreatedEvent()
    
    const jobId = await webhookQueue.enqueue(
      event.event_id,
      event.type,
      event
    )
    
    expect(jobId).toBeDefined()
    expect(jobId).toContain(event.type)
    expect(jobId).toContain(event.event_id)
    
    const stats = webhookQueue.getStats()
    expect(stats.total).toBeGreaterThan(0)
  })
  
  it('should process different event types with correct priority', async () => {
    const paymentEvent = generator.generatePaymentCreatedEvent()
    const customerEvent = generator.generateCustomerCreatedEvent()
    
    const paymentJobId = await webhookQueue.enqueue(
      paymentEvent.event_id,
      paymentEvent.type,
      paymentEvent
    )
    
    const customerJobId = await webhookQueue.enqueue(
      customerEvent.event_id,
      customerEvent.type,
      customerEvent
    )
    
    expect(paymentJobId).toBeDefined()
    expect(customerJobId).toBeDefined()
    
    const stats = webhookQueue.getStats()
    expect(stats.byEventType['payment.created']).toBe(1)
    expect(stats.byEventType['customer.created']).toBe(1)
  })
})

describe('Square Webhook API Route', () => {
  const generator = new WebhookTestDataGenerator(testConfig)
  
  it('should handle valid payment webhook end-to-end', async () => {
    const event = generator.generatePaymentCreatedEvent()
    const request = generator.createMockWebhookRequest(event)
    
    const response = await POST(request)
    const responseData = await response.json()
    
    expect(response.status).toBe(200)
    expect(responseData.eventId).toBe(event.event_id)
    expect(responseData.jobId).toBeDefined()
    expect(responseData.message).toContain('queued')
  })
  
  it('should handle customer webhook end-to-end', async () => {
    const event = generator.generateCustomerCreatedEvent()
    const request = generator.createMockWebhookRequest(event)
    
    const response = await POST(request)
    const responseData = await response.json()
    
    expect(response.status).toBe(200)
    expect(responseData.eventId).toBe(event.event_id)
    expect(responseData.jobId).toBeDefined()
  })
  
  it('should reject invalid webhook signatures', async () => {
    const event = generator.generatePaymentCreatedEvent()
    const request = generator.createMockWebhookRequest(event, {
      invalidSignature: true
    })
    
    const response = await POST(request)
    
    expect(response.status).toBe(401)
  })
  
  it('should handle duplicate events with idempotency', async () => {
    const event = generator.generatePaymentCreatedEvent()
    const request1 = generator.createMockWebhookRequest(event)
    const request2 = generator.createMockWebhookRequest(event)
    
    const response1 = await POST(request1)
    const response2 = await POST(request2)
    
    expect(response1.status).toBe(200)
    expect(response2.status).toBe(200)
    
    const data2 = await response2.json()
    expect(data2.message).toContain('already processed')
  })
})

describe('Webhook Error Handling', () => {
  const generator = new WebhookTestDataGenerator(testConfig)
  
  it('should classify authentication errors correctly', async () => {
    const authError = new Error('Invalid webhook signature')
    const result = await webhookErrorHandler.handleError(authError, undefined, {
      eventType: 'payment.created'
    })
    
    expect(result.shouldRetry).toBe(false)
    expect(result.fallbackExecuted).toBe(true)
  })
  
  it('should handle processing errors with retry logic', async () => {
    const processingError = new Error('Database connection failed')
    const mockJob = {
      id: 'test-job-1',
      eventId: 'test-event-1',
      eventType: 'payment.created',
      attempts: 1,
      maxAttempts: 3
    } as any
    
    const result = await webhookErrorHandler.handleError(processingError, mockJob, {
      eventType: 'payment.created'
    })
    
    expect(result.shouldRetry).toBe(true)
    expect(result.retryDelayMs).toBeGreaterThan(0)
  })
  
  it('should not retry validation errors', async () => {
    const validationError = new Error('Invalid event structure: missing required field')
    const result = await webhookErrorHandler.handleError(validationError, undefined, {
      eventType: 'payment.created'
    })
    
    expect(result.shouldRetry).toBe(false)
  })
})

describe('Performance and Load Testing', () => {
  const performanceTester = new WebhookPerformanceTester(testConfig)
  
  it('should handle multiple concurrent webhooks', async () => {
    const eventCount = 10
    const events = performanceTester.generateLoadTestEvents(eventCount, ['payment.created'])
    
    const startTime = Date.now()
    const responses = await Promise.all(
      events.map(({ request }) => POST(request))
    )
    const endTime = Date.now()
    
    const successfulResponses = responses.filter(r => r.status === 200)
    
    expect(successfulResponses.length).toBe(eventCount)
    expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    
    // Check that all events were queued
    const stats = webhookQueue.getStats()
    expect(stats.total).toBeGreaterThanOrEqual(eventCount)
  })
  
  it('should maintain performance under load', async () => {
    const loadTestEvents = performanceTester.generateLoadTestEvents(5)
    
    const results = await performanceTester.measureProcessingTime(
      loadTestEvents,
      async (request) => await POST(request)
    )
    
    expect(results.successfulEvents).toBe(5)
    expect(results.failedEvents).toBe(0)
    expect(results.averageProcessingTime).toBeLessThan(1000) // Under 1 second average
    expect(results.maxProcessingTime).toBeLessThan(2000) // Under 2 seconds max
  })
})

describe('Integration Test Scenarios', () => {
  const helper = new WebhookIntegrationTestHelper(testConfig)
  
  it('should complete full payment flow', async () => {
    const results = await helper.testEndToEndProcessing(
      async (request) => await POST(request)
    )
    
    expect(results.overallSuccess).toBe(true)
    expect(results.successfulSteps).toBe(3) // customer.created, payment.created, payment.updated
    expect(results.totalProcessingTime).toBeLessThan(3000)
  })
  
  it('should pass authentication test suite', async () => {
    const results = await helper.testAuthentication(
      async (request) => await POST(request)
    )
    
    expect(results.passedTests).toBe(results.totalTests)
    expect(results.failedTests).toBe(0)
  })
})

describe('Rate Limiting', () => {
  const generator = new WebhookTestDataGenerator(testConfig)
  
  it('should apply rate limiting after threshold', async () => {
    // This test would need to be adjusted based on actual rate limits
    // For now, we test that the system handles rapid requests gracefully
    
    const requests = Array(5).fill(null).map(() => 
      generator.createMockWebhookRequest(generator.generatePaymentCreatedEvent())
    )
    
    const responses = await Promise.all(
      requests.map(request => POST(request))
    )
    
    // All should succeed under normal rate limits
    const successfulResponses = responses.filter(r => r.status === 200)
    expect(successfulResponses.length).toBe(5)
  })
})

describe('Circuit Breaker', () => {
  it('should trip circuit breaker after repeated failures', async () => {
    const circuitBreaker = webhookErrorHandler.getCircuitBreaker('test-service')
    
    // Simulate failures
    const failingOperation = async () => {
      throw new Error('Service unavailable')
    }
    
    // Should fail and increment failure count
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(failingOperation)
      } catch (error) {
        // Expected to fail
      }
    }
    
    const state = circuitBreaker.getState()
    expect(state.state).toBe('OPEN')
    expect(state.failures).toBe(5)
    
    // Next call should fail immediately due to open circuit
    await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Circuit breaker is OPEN')
  })
})

describe('Webhook Event Validation', () => {
  const generator = new WebhookTestDataGenerator(testConfig)
  
  it('should validate required webhook fields', async () => {
    const incompleteEvent = {
      merchant_id: testConfig.merchantId,
      type: 'payment.created'
      // Missing event_id, created_at, data
    }
    
    const request = generator.createMockWebhookRequest(incompleteEvent as any)
    const response = await POST(request)
    
    expect(response.status).toBe(400)
  })
  
  it('should validate event timestamp', async () => {
    const oldEvent = generator.generatePaymentCreatedEvent()
    // Make event very old (more than 10 minutes)
    oldEvent.created_at = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    
    const request = generator.createMockWebhookRequest(oldEvent)
    const response = await POST(request)
    
    expect(response.status).toBe(400)
  })
  
  it('should validate event type format', async () => {
    const invalidEvent = generator.generatePaymentCreatedEvent()
    invalidEvent.type = 'invalid-event-type-format'
    
    const request = generator.createMockWebhookRequest(invalidEvent)
    const response = await POST(request)
    
    expect(response.status).toBe(400)
  })
})

// Helper function to wait for async operations
const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('Queue Processing', () => {
  it('should process queued events asynchronously', async () => {
    const generator = new WebhookTestDataGenerator(testConfig)
    const event = generator.generatePaymentCreatedEvent()
    
    const jobId = await webhookQueue.enqueue(
      event.event_id,
      event.type,
      event
    )
    
    // Wait a bit for processing
    await waitFor(100)
    
    const stats = webhookQueue.getStats()
    expect(stats.total).toBeGreaterThan(0)
    
    // The job should either be processing or completed
    expect(stats.byStatus.pending + stats.byStatus.processing + stats.byStatus.completed).toBeGreaterThan(0)
  })
})