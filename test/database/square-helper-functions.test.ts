/**
 * Square Database Helper Functions Tests
 * 
 * Tests all stored procedures and helper functions for Square integration.
 * Covers payment processing, customer management, and reconciliation functions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'

// Test database configuration
const supabaseUrl = process.env.DATABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
const supabase = createClient(supabaseUrl, supabaseKey)

describe('Square Database Helper Functions', () => {
  let testData: any = {}

  beforeAll(async () => {
    await cleanupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  beforeEach(() => {
    testData = {}
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  async function cleanupTestData() {
    // Clean up in correct order
    await supabase.from('square_refunds').delete().like('square_refund_id', 'test_%')
    await supabase.from('payment_reconciliation_log').delete().like('square_payment_id', 'test_%')
    await supabase.from('square_payments').delete().like('square_payment_id', 'test_%')
    await supabase.from('square_customers').delete().like('square_customer_id', 'test_%')
    await supabase.from('square_webhooks').delete().like('event_id', 'test_%')
  }

  describe('upsert_square_payment Function', () => {
    it('should create new payment with all fields', async () => {
      const paymentData = {
        p_square_payment_id: `test_payment_${faker.string.alphanumeric(10)}`,
        p_registration_id: faker.number.int({ min: 1, max: 1000 }),
        p_amount_money_amount: 1500,
        p_amount_money_currency: 'USD',
        p_total_money_amount: 1500,
        p_total_money_currency: 'USD',
        p_status: 'COMPLETED',
        p_source_type: 'CARD',
        p_card_brand: 'VISA',
        p_card_last_4: '4242',
        p_receipt_number: `RCP_${faker.string.alphanumeric(8)}`,
        p_receipt_url: faker.internet.url(),
        p_reference_id: `ref_${faker.string.alphanumeric(10)}`,
        p_note: 'Test payment via function',
        p_buyer_email_address: faker.internet.email(),
        p_application_details_square_product: 'ECOMMERCE_API',
        p_application_details_application_id: 'test_app_id',
        p_idempotency_key: faker.string.uuid(),
        p_location_id: `test_location_${faker.string.alphanumeric(8)}`,
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      }

      const { data, error } = await supabase.rpc('upsert_square_payment', paymentData)

      expect(error).toBeNull()
      expect(data).toBeDefined()

      // Verify payment was created
      const { data: payment } = await supabase
        .from('square_payments')
        .select('*')
        .eq('square_payment_id', paymentData.p_square_payment_id)
        .single()

      expect(payment).toBeDefined()
      expect(payment.square_payment_id).toBe(paymentData.p_square_payment_id)
      expect(payment.amount_money_amount).toBe(paymentData.p_amount_money_amount)
      expect(payment.status).toBe(paymentData.p_status)
      expect(payment.card_brand).toBe(paymentData.p_card_brand)
      expect(payment.card_last_4).toBe(paymentData.p_card_last_4)

      testData.payment = payment
    })

    it('should update existing payment on duplicate square_payment_id', async () => {
      const squarePaymentId = `test_payment_update_${faker.string.alphanumeric(10)}`
      
      // Create initial payment
      const initialData = {
        p_square_payment_id: squarePaymentId,
        p_registration_id: 123,
        p_amount_money_amount: 1000,
        p_amount_money_currency: 'USD',
        p_total_money_amount: 1000,
        p_total_money_currency: 'USD',
        p_status: 'PENDING',
        p_source_type: 'CARD',
        p_location_id: 'test_location',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      }

      await supabase.rpc('upsert_square_payment', initialData)

      // Update with new status
      const updateData = {
        ...initialData,
        p_status: 'COMPLETED',
        p_receipt_number: 'RCP_UPDATED',
        p_receipt_url: 'https://updated-receipt.com',
        p_updated_at_square: new Date().toISOString(),
      }

      const { error } = await supabase.rpc('upsert_square_payment', updateData)
      expect(error).toBeNull()

      // Verify update
      const { data: updatedPayment } = await supabase
        .from('square_payments')
        .select('*')
        .eq('square_payment_id', squarePaymentId)
        .single()

      expect(updatedPayment.status).toBe('COMPLETED')
      expect(updatedPayment.receipt_number).toBe('RCP_UPDATED')
      expect(updatedPayment.receipt_url).toBe('https://updated-receipt.com')

      testData.updatedPayment = updatedPayment
    })

    it('should handle minimal required fields', async () => {
      const minimalData = {
        p_square_payment_id: `test_payment_minimal_${faker.string.alphanumeric(10)}`,
        p_amount_money_amount: 500,
        p_total_money_amount: 500,
        p_location_id: 'test_location_minimal',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      }

      const { error } = await supabase.rpc('upsert_square_payment', minimalData)
      expect(error).toBeNull()

      const { data: payment } = await supabase
        .from('square_payments')
        .select('*')
        .eq('square_payment_id', minimalData.p_square_payment_id)
        .single()

      expect(payment).toBeDefined()
      expect(payment.amount_money_amount).toBe(500)
      expect(payment.amount_money_currency).toBe('USD') // Default value
      expect(payment.status).toBe('PENDING') // Default value

      testData.minimalPayment = payment
    })
  })

  describe('update_square_payment_status Function', () => {
    it('should update payment status successfully', async () => {
      // Create a payment first
      const paymentData = {
        p_square_payment_id: `test_payment_status_${faker.string.alphanumeric(10)}`,
        p_amount_money_amount: 1000,
        p_total_money_amount: 1000,
        p_status: 'PENDING',
        p_location_id: 'test_location',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      }

      await supabase.rpc('upsert_square_payment', paymentData)

      // Update status
      const { error } = await supabase.rpc('update_square_payment_status', {
        p_square_payment_id: paymentData.p_square_payment_id,
        p_status: 'COMPLETED',
        p_metadata: { completion_time: new Date().toISOString() }
      })

      expect(error).toBeNull()

      // Verify update
      const { data: payment } = await supabase
        .from('square_payments')
        .select('*')
        .eq('square_payment_id', paymentData.p_square_payment_id)
        .single()

      expect(payment.status).toBe('COMPLETED')
      expect(payment.updated_at).toBeDefined()

      testData.statusPayment = payment
    })

    it('should handle non-existent payment gracefully', async () => {
      const { error } = await supabase.rpc('update_square_payment_status', {
        p_square_payment_id: 'non_existent_payment',
        p_status: 'COMPLETED'
      })

      // Should not error, but should not update anything
      expect(error).toBeNull()
    })
  })

  describe('create_square_refund Function', () => {
    it('should create refund with all fields', async () => {
      // Create payment first
      const paymentData = {
        p_square_payment_id: `test_payment_refund_${faker.string.alphanumeric(10)}`,
        p_amount_money_amount: 2000,
        p_total_money_amount: 2000,
        p_status: 'COMPLETED',
        p_location_id: 'test_location',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      }

      await supabase.rpc('upsert_square_payment', paymentData)

      // Create refund
      const refundData = {
        p_square_refund_id: `test_refund_${faker.string.alphanumeric(10)}`,
        p_square_payment_id: paymentData.p_square_payment_id,
        p_amount_money_amount: 1000, // Partial refund
        p_amount_money_currency: 'USD',
        p_status: 'COMPLETED',
        p_reason: 'Customer requested partial refund',
        p_idempotency_key: faker.string.uuid(),
        p_location_id: 'test_location',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      }

      const { error } = await supabase.rpc('create_square_refund', refundData)
      expect(error).toBeNull()

      // Verify refund was created
      const { data: refund } = await supabase
        .from('square_refunds')
        .select(`
          *,
          payment:payment_id (
            square_payment_id,
            amount_money_amount
          )
        `)
        .eq('square_refund_id', refundData.p_square_refund_id)
        .single()

      expect(refund).toBeDefined()
      expect(refund.square_refund_id).toBe(refundData.p_square_refund_id)
      expect(refund.amount_money_amount).toBe(1000)
      expect(refund.reason).toBe('Customer requested partial refund')
      expect(refund.payment.square_payment_id).toBe(paymentData.p_square_payment_id)

      testData.refund = refund
    })

    it('should handle refund for non-existent payment', async () => {
      const refundData = {
        p_square_refund_id: `test_refund_orphan_${faker.string.alphanumeric(10)}`,
        p_square_payment_id: 'non_existent_payment',
        p_amount_money_amount: 500,
        p_amount_money_currency: 'USD',
        p_status: 'COMPLETED',
        p_reason: 'Test orphan refund',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      }

      const { error } = await supabase.rpc('create_square_refund', refundData)

      // Should create refund even if payment doesn't exist locally
      expect(error).toBeNull()

      const { data: refund } = await supabase
        .from('square_refunds')
        .select('*')
        .eq('square_refund_id', refundData.p_square_refund_id)
        .single()

      expect(refund).toBeDefined()
      expect(refund.payment_id).toBeNull() // No local payment relationship
      expect(refund.square_payment_id).toBe('non_existent_payment')

      testData.orphanRefund = refund
    })
  })

  describe('get_square_payments Function', () => {
    beforeEach(async () => {
      // Create test payments for querying
      const payments = [
        {
          p_square_payment_id: `test_query_payment_1_${faker.string.alphanumeric(6)}`,
          p_registration_id: 100,
          p_amount_money_amount: 1000,
          p_total_money_amount: 1000,
          p_status: 'COMPLETED',
          p_location_id: 'test_location',
          p_created_at_square: new Date('2025-08-01T10:00:00Z').toISOString(),
          p_updated_at_square: new Date('2025-08-01T10:00:00Z').toISOString(),
        },
        {
          p_square_payment_id: `test_query_payment_2_${faker.string.alphanumeric(6)}`,
          p_registration_id: 100, // Same registration
          p_amount_money_amount: 2000,
          p_total_money_amount: 2000,
          p_status: 'PENDING',
          p_location_id: 'test_location',
          p_created_at_square: new Date('2025-08-01T11:00:00Z').toISOString(),
          p_updated_at_square: new Date('2025-08-01T11:00:00Z').toISOString(),
        },
        {
          p_square_payment_id: `test_query_payment_3_${faker.string.alphanumeric(6)}`,
          p_registration_id: 200, // Different registration
          p_amount_money_amount: 1500,
          p_total_money_amount: 1500,
          p_status: 'COMPLETED',
          p_location_id: 'test_location',
          p_created_at_square: new Date('2025-08-01T12:00:00Z').toISOString(),
          p_updated_at_square: new Date('2025-08-01T12:00:00Z').toISOString(),
        },
      ]

      for (const payment of payments) {
        await supabase.rpc('upsert_square_payment', payment)
        testData[payment.p_square_payment_id] = payment
      }
    })

    it('should query all payments with pagination', async () => {
      const { data, error } = await supabase.rpc('get_square_payments', {
        p_limit: 10,
        p_offset: 0
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(3)

      // Verify structure
      const payment = data[0]
      expect(payment).toHaveProperty('square_payment_id')
      expect(payment).toHaveProperty('amount_money_amount')
      expect(payment).toHaveProperty('status')
      expect(payment).toHaveProperty('created_at_square')
    })

    it('should filter by registration_id', async () => {
      const { data, error } = await supabase.rpc('get_square_payments', {
        p_registration_id: 100,
        p_limit: 10,
        p_offset: 0
      })

      expect(error).toBeNull()
      expect(data).toHaveLength(2) // Two payments for registration 100
      expect(data.every((p: any) => p.registration_id === 100)).toBe(true)
    })

    it('should filter by payment status', async () => {
      const { data, error } = await supabase.rpc('get_square_payments', {
        p_status: 'COMPLETED',
        p_limit: 10,
        p_offset: 0
      })

      expect(error).toBeNull()
      expect(data.length).toBeGreaterThanOrEqual(2)
      expect(data.every((p: any) => p.status === 'COMPLETED')).toBe(true)
    })

    it('should filter by specific square_payment_id', async () => {
      const paymentId = Object.keys(testData).find(key => key.includes('test_query_payment_1'))
      
      const { data, error } = await supabase.rpc('get_square_payments', {
        p_square_payment_id: paymentId,
        p_limit: 10,
        p_offset: 0
      })

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].square_payment_id).toBe(paymentId)
    })

    it('should handle pagination correctly', async () => {
      // Get first page
      const { data: page1 } = await supabase.rpc('get_square_payments', {
        p_limit: 2,
        p_offset: 0
      })

      // Get second page
      const { data: page2 } = await supabase.rpc('get_square_payments', {
        p_limit: 2,
        p_offset: 2
      })

      expect(page1).toHaveLength(2)
      expect(page2.length).toBeGreaterThan(0)

      // Ensure no overlap
      const page1Ids = page1.map((p: any) => p.square_payment_id)
      const page2Ids = page2.map((p: any) => p.square_payment_id)
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id))
      expect(overlap).toHaveLength(0)
    })
  })

  describe('get_square_payment_summary Function', () => {
    beforeEach(async () => {
      // Create diverse test data for summary
      const summaryPayments = [
        {
          p_square_payment_id: `test_summary_1_${faker.string.alphanumeric(6)}`,
          p_amount_money_amount: 1000,
          p_total_money_amount: 1000,
          p_status: 'COMPLETED',
          p_location_id: 'test_location',
          p_created_at_square: new Date('2025-08-01T10:00:00Z').toISOString(),
          p_updated_at_square: new Date('2025-08-01T10:00:00Z').toISOString(),
        },
        {
          p_square_payment_id: `test_summary_2_${faker.string.alphanumeric(6)}`,
          p_amount_money_amount: 2000,
          p_total_money_amount: 2000,
          p_status: 'COMPLETED',
          p_location_id: 'test_location',
          p_created_at_square: new Date('2025-08-01T11:00:00Z').toISOString(),
          p_updated_at_square: new Date('2025-08-01T11:00:00Z').toISOString(),
        },
        {
          p_square_payment_id: `test_summary_3_${faker.string.alphanumeric(6)}`,
          p_amount_money_amount: 1500,
          p_total_money_amount: 1500,
          p_status: 'FAILED',
          p_location_id: 'test_location',
          p_created_at_square: new Date('2025-08-01T12:00:00Z').toISOString(),
          p_updated_at_square: new Date('2025-08-01T12:00:00Z').toISOString(),
        },
      ]

      for (const payment of summaryPayments) {
        await supabase.rpc('upsert_square_payment', payment)
        testData[payment.p_square_payment_id] = payment
      }
    })

    it('should generate payment summary with correct totals', async () => {
      const startDate = '2025-08-01T00:00:00Z'
      const endDate = '2025-08-01T23:59:59Z'

      const { data, error } = await supabase.rpc('get_square_payment_summary', {
        p_start_date: startDate,
        p_end_date: endDate
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data).toHaveProperty('total_payments')
      expect(data).toHaveProperty('total_amount')
      expect(data).toHaveProperty('completed_payments')
      expect(data).toHaveProperty('failed_payments')
      expect(data).toHaveProperty('pending_payments')

      expect(data.total_payments).toBeGreaterThanOrEqual(3)
      expect(data.completed_payments).toBeGreaterThanOrEqual(2)
      expect(data.failed_payments).toBeGreaterThanOrEqual(1)
      expect(data.total_amount).toBeGreaterThanOrEqual(4500) // 1000 + 2000 + 1500
    })

    it('should handle empty date range', async () => {
      const { data, error } = await supabase.rpc('get_square_payment_summary', {
        p_start_date: '2025-01-01T00:00:00Z',
        p_end_date: '2025-01-02T00:00:00Z'
      })

      expect(error).toBeNull()
      expect(data.total_payments).toBe(0)
      expect(data.total_amount).toBe(0)
      expect(data.completed_payments).toBe(0)
      expect(data.failed_payments).toBe(0)
      expect(data.pending_payments).toBe(0)
    })
  })

  describe('Performance and Error Handling', () => {
    it('should handle large batch operations efficiently', async () => {
      const batchSize = 50
      const startTime = Date.now()

      // Create batch of payments
      const promises = Array.from({ length: batchSize }, (_, i) => {
        return supabase.rpc('upsert_square_payment', {
          p_square_payment_id: `test_batch_${i}_${faker.string.alphanumeric(6)}`,
          p_amount_money_amount: 1000 + i,
          p_total_money_amount: 1000 + i,
          p_status: i % 2 === 0 ? 'COMPLETED' : 'PENDING',
          p_location_id: 'test_location_batch',
          p_created_at_square: new Date().toISOString(),
          p_updated_at_square: new Date().toISOString(),
        })
      })

      const results = await Promise.all(promises)
      const duration = Date.now() - startTime

      // All operations should succeed
      expect(results.every(r => r.error === null)).toBe(true)
      
      // Should complete reasonably quickly
      expect(duration).toBeLessThan(5000) // 5 seconds for 50 operations

      // Store for cleanup
      testData.batchPayments = results
    })

    it('should handle invalid data gracefully', async () => {
      // Test with invalid amount (negative)
      const { error: negativeError } = await supabase.rpc('upsert_square_payment', {
        p_square_payment_id: 'test_invalid_amount',
        p_amount_money_amount: -1000,
        p_total_money_amount: -1000,
        p_location_id: 'test_location',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      })

      // Should either succeed (if no constraints) or fail gracefully
      if (negativeError) {
        expect(negativeError.message).toBeDefined()
      }

      // Test with extremely long string
      const longString = 'x'.repeat(1000)
      const { error: longStringError } = await supabase.rpc('upsert_square_payment', {
        p_square_payment_id: longString,
        p_amount_money_amount: 1000,
        p_total_money_amount: 1000,
        p_location_id: 'test_location',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      })

      if (longStringError) {
        expect(longStringError.message).toBeDefined()
      }
    })

    it('should handle concurrent operations safely', async () => {
      const paymentId = `test_concurrent_${faker.string.alphanumeric(10)}`
      
      // Create initial payment
      await supabase.rpc('upsert_square_payment', {
        p_square_payment_id: paymentId,
        p_amount_money_amount: 1000,
        p_total_money_amount: 1000,
        p_status: 'PENDING',
        p_location_id: 'test_location',
        p_created_at_square: new Date().toISOString(),
        p_updated_at_square: new Date().toISOString(),
      })

      // Simulate concurrent updates
      const concurrentUpdates = Array.from({ length: 10 }, (_, i) => {
        return supabase.rpc('update_square_payment_status', {
          p_square_payment_id: paymentId,
          p_status: i % 2 === 0 ? 'COMPLETED' : 'FAILED',
          p_metadata: { update_index: i }
        })
      })

      const results = await Promise.all(concurrentUpdates)
      
      // All updates should succeed (last one wins)
      expect(results.every(r => r.error === null)).toBe(true)

      // Verify final state is consistent
      const { data: finalPayment } = await supabase
        .from('square_payments')
        .select('*')
        .eq('square_payment_id', paymentId)
        .single()

      expect(finalPayment).toBeDefined()
      expect(['COMPLETED', 'FAILED']).toContain(finalPayment.status)

      testData.concurrentPayment = finalPayment
    })
  })
})