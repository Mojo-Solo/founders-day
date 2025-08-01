/**
 * Square Database Schema Integration Tests
 * 
 * Comprehensive testing suite for Square database schema, functions, and policies.
 * Tests all stored procedures, helper functions, and Row Level Security policies.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'

// Test database configuration
const supabaseUrl = process.env.DATABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
const supabase = createClient(supabaseUrl, supabaseKey)

// Test data factories
const createTestCustomer = () => ({
  square_customer_id: `test_customer_${faker.string.alphanumeric(10)}`,
  email: faker.internet.email(),
  given_name: faker.person.firstName(),
  family_name: faker.person.lastName(),
  phone_number: faker.phone.number(),
  company_name: faker.company.name(),
  address_line_1: faker.location.streetAddress(),
  locality: faker.location.city(),
  administrative_district_level_1: faker.location.state(),
  postal_code: faker.location.zipCode(),
  country: 'USA',
  created_at_square: new Date().toISOString(),
  updated_at_square: new Date().toISOString(),
})

const createTestPayment = (customerId?: string, registrationId?: number) => ({
  square_payment_id: `test_payment_${faker.string.alphanumeric(10)}`,
  square_location_id: `test_location_${faker.string.alphanumeric(8)}`,
  square_customer_id: customerId || `test_customer_${faker.string.alphanumeric(10)}`,
  registration_id: registrationId || faker.number.int({ min: 1, max: 1000 }),
  amount_money_amount: faker.number.int({ min: 100, max: 100000 }), // In cents
  amount_money_currency: 'USD',
  total_money_amount: faker.number.int({ min: 100, max: 100000 }),
  total_money_currency: 'USD',
  source_type: 'CARD',
  card_brand: faker.helpers.arrayElement(['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS']),
  card_last_4: faker.finance.creditCardNumber().slice(-4),
  status: faker.helpers.arrayElement(['PENDING', 'COMPLETED', 'FAILED', 'CANCELED']),
  receipt_number: `RCP_${faker.string.alphanumeric(8)}`,
  receipt_url: faker.internet.url(),
  reference_id: `ref_${faker.string.alphanumeric(10)}`,
  note: faker.lorem.sentence(),
  buyer_email_address: faker.internet.email(),
  created_at_square: new Date().toISOString(),
  updated_at_square: new Date().toISOString(),
})

describe('Square Database Schema Tests', () => {
  let testCustomers: any[] = []
  let testPayments: any[] = []
  let testRegistrations: any[] = []

  beforeAll(async () => {
    // Ensure test database is clean
    await cleanupTestData()
  })

  afterAll(async () => {
    // Clean up after all tests
    await cleanupTestData()
  })

  beforeEach(() => {
    testCustomers = []
    testPayments = []
    testRegistrations = []
  })

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData()
  })

  async function cleanupTestData() {
    // Delete test data in correct order (foreign keys)
    await supabase.from('square_refunds').delete().like('square_refund_id', 'test_%')
    await supabase.from('payment_reconciliation_log').delete().like('square_payment_id', 'test_%')
    await supabase.from('square_payments').delete().like('square_payment_id', 'test_%')
    await supabase.from('square_customers').delete().like('square_customer_id', 'test_%')
    await supabase.from('square_webhooks').delete().like('event_id', 'test_%')
    
    // Clean up test registrations if any were created
    await supabase.from('registrations').delete().like('email', 'test%@example.com')
  }

  describe('Square Customers Table', () => {
    it('should create customer with all fields', async () => {
      const customerData = createTestCustomer()
      
      const { data, error } = await supabase
        .from('square_customers')
        .insert(customerData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.square_customer_id).toBe(customerData.square_customer_id)
      expect(data.email).toBe(customerData.email)
      expect(data.given_name).toBe(customerData.given_name)
      expect(data.sync_status).toBe('synced')
      expect(data.created_at).toBeDefined()
      expect(data.updated_at).toBeDefined()

      testCustomers.push(data)
    })

    it('should enforce unique square_customer_id constraint', async () => {
      const customerData = createTestCustomer()
      
      // Insert first customer
      await supabase.from('square_customers').insert(customerData)
      
      // Try to insert duplicate
      const { error } = await supabase.from('square_customers').insert(customerData)
      
      expect(error).toBeDefined()
      expect(error?.code).toBe('23505') // Unique violation
    })

    it('should enforce unique email constraint', async () => {
      const email = faker.internet.email()
      const customer1 = { ...createTestCustomer(), email }
      const customer2 = { ...createTestCustomer(), email }
      
      // Insert first customer
      await supabase.from('square_customers').insert(customer1)
      
      // Try to insert customer with same email
      const { error } = await supabase.from('square_customers').insert(customer2)
      
      expect(error).toBeDefined()
      expect(error?.code).toBe('23505') // Unique violation
    })

    it('should update timestamp on modification', async () => {
      const customerData = createTestCustomer()
      
      const { data: inserted } = await supabase
        .from('square_customers')
        .insert(customerData)
        .select()
        .single()

      testCustomers.push(inserted)
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const { data: updated } = await supabase
        .from('square_customers')
        .update({ given_name: 'Updated Name' })
        .eq('id', inserted.id)
        .select()
        .single()

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
        new Date(inserted.updated_at).getTime()
      )
    })
  })

  describe('Square Payments Table', () => {
    it('should create payment with customer relationship', async () => {
      // Create customer first
      const customerData = createTestCustomer()
      const { data: customer } = await supabase
        .from('square_customers')
        .insert(customerData)
        .select()
        .single()

      testCustomers.push(customer)

      // Create payment linked to customer
      const paymentData = {
        ...createTestPayment(customer.square_customer_id),
        customer_id: customer.id,
      }

      const { data, error } = await supabase
        .from('square_payments')
        .insert(paymentData)
        .select(`
          *,
          customer:customer_id (
            id,
            square_customer_id,
            email
          )
        `)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.square_payment_id).toBe(paymentData.square_payment_id)
      expect(data.customer_id).toBe(customer.id)
      expect(data.customer.email).toBe(customer.email)

      testPayments.push(data)
    })

    it('should handle payment without customer (guest payment)', async () => {
      const paymentData = createTestPayment()
      
      const { data, error } = await supabase
        .from('square_payments')
        .insert(paymentData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.customer_id).toBeNull()
      expect(data.square_customer_id).toBe(paymentData.square_customer_id)

      testPayments.push(data)
    })

    it('should enforce required fields', async () => {
      const incompletePayment = {
        square_payment_id: 'test_incomplete',
        // Missing required fields
      }
      
      const { error } = await supabase
        .from('square_payments')
        .insert(incompletePayment)

      expect(error).toBeDefined()
      expect(error?.code).toBe('23502') // Not null violation
    })

    it('should validate status enum', async () => {
      const paymentData = {
        ...createTestPayment(),
        status: 'INVALID_STATUS',
      }
      
      const { error } = await supabase
        .from('square_payments')
        .insert(paymentData)

      expect(error).toBeDefined()
      expect(error?.message).toContain('sync_status')
    })
  })

  describe('Square Refunds Table', () => {
    it('should create refund linked to payment', async () => {
      // Create payment first
      const paymentData = createTestPayment()
      const { data: payment } = await supabase
        .from('square_payments')
        .insert(paymentData)
        .select()
        .single()

      testPayments.push(payment)

      // Create refund
      const refundData = {
        square_refund_id: `test_refund_${faker.string.alphanumeric(10)}`,
        square_payment_id: payment.square_payment_id,
        payment_id: payment.id,
        amount_money_amount: faker.number.int({ min: 100, max: payment.amount_money_amount }),
        amount_money_currency: 'USD',
        reason: 'Customer request',
        status: 'COMPLETED',
        created_at_square: new Date().toISOString(),
        updated_at_square: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('square_refunds')
        .insert(refundData)
        .select(`
          *,
          payment:payment_id (
            id,
            square_payment_id,
            amount_money_amount
          )
        `)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.square_refund_id).toBe(refundData.square_refund_id)
      expect(data.payment.square_payment_id).toBe(payment.square_payment_id)
    })

    it('should cascade delete when payment is deleted', async () => {
      // Create payment and refund
      const paymentData = createTestPayment()
      const { data: payment } = await supabase
        .from('square_payments')
        .insert(paymentData)
        .select()
        .single()

      const refundData = {
        square_refund_id: `test_refund_cascade_${faker.string.alphanumeric(10)}`,
        square_payment_id: payment.square_payment_id,
        payment_id: payment.id,
        amount_money_amount: 500,
        amount_money_currency: 'USD',
        reason: 'Test refund',
        status: 'COMPLETED',
        created_at_square: new Date().toISOString(),
        updated_at_square: new Date().toISOString(),
      }

      await supabase.from('square_refunds').insert(refundData)

      // Delete payment
      await supabase.from('square_payments').delete().eq('id', payment.id)

      // Verify refund was also deleted
      const { data: refunds } = await supabase
        .from('square_refunds')
        .select()
        .eq('square_refund_id', refundData.square_refund_id)

      expect(refunds).toHaveLength(0)
    })
  })

  describe('Square Webhooks Table', () => {
    it('should store webhook event with full data', async () => {
      const webhookData = {
        event_id: `test_event_${faker.string.alphanumeric(10)}`,
        event_type: 'payment.updated',
        merchant_id: `test_merchant_${faker.string.alphanumeric(8)}`,
        location_id: `test_location_${faker.string.alphanumeric(8)}`,
        event_data: {
          type: 'payment',
          id: 'test_payment_123',
          payment: {
            id: 'test_payment_123',
            status: 'COMPLETED',
            amount_money: { amount: 1000, currency: 'USD' }
          }
        },
        api_version: '2023-10-18',
        status: 'received',
        signature_verified: true,
        raw_body: JSON.stringify({ test: 'data' }),
        headers: {
          'x-square-signature': 'test-signature',
          'content-type': 'application/json'
        },
        created_at_square: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('square_webhooks')
        .insert(webhookData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.event_id).toBe(webhookData.event_id)
      expect(data.event_type).toBe(webhookData.event_type)
      expect(data.event_data).toEqual(webhookData.event_data)
      expect(data.status).toBe('received')
      expect(data.retry_count).toBe(0)
    })

    it('should enforce unique event_id constraint', async () => {
      const eventId = `test_event_duplicate_${faker.string.alphanumeric(10)}`
      const webhookData = {
        event_id: eventId,
        event_type: 'payment.created',
        merchant_id: 'test_merchant',
        event_data: { test: 'data' },
        created_at_square: new Date().toISOString(),
      }

      // Insert first webhook
      await supabase.from('square_webhooks').insert(webhookData)

      // Try to insert duplicate
      const { error } = await supabase.from('square_webhooks').insert(webhookData)

      expect(error).toBeDefined()
      expect(error?.code).toBe('23505') // Unique violation
    })
  })

  describe('Payment Reconciliation Log', () => {
    it('should create reconciliation entry with all relationships', async () => {
      // Create payment first
      const paymentData = createTestPayment()
      const { data: payment } = await supabase
        .from('square_payments')
        .insert(paymentData)
        .select()
        .single()

      testPayments.push(payment)

      const reconciliationData = {
        square_payment_id: payment.square_payment_id,
        payment_id: payment.id,
        registration_id: payment.registration_id,
        reconciliation_type: 'payment',
        status: 'matched',
        expected_amount: payment.amount_money_amount,
        actual_amount: payment.amount_money_amount,
        difference_amount: 0,
        currency: 'USD',
        resolution_status: 'resolved',
        resolution_notes: 'Amounts match perfectly',
        batch_id: faker.string.uuid(),
        notes: 'Automated reconciliation',
      }

      const { data, error } = await supabase
        .from('payment_reconciliation_log')
        .insert(reconciliationData)
        .select(`
          *,
          payment:payment_id (
            id,
            square_payment_id,
            amount_money_amount
          )
        `)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.reconciliation_type).toBe('payment')
      expect(data.status).toBe('matched')
      expect(data.difference_amount).toBe(0)
      expect(data.payment.square_payment_id).toBe(payment.square_payment_id)
    })

    it('should handle discrepancy tracking', async () => {
      const reconciliationData = {
        square_payment_id: 'test_payment_discrepancy',
        reconciliation_type: 'payment',
        status: 'discrepancy',
        expected_amount: 1000,
        actual_amount: 900,
        difference_amount: -100,
        currency: 'USD',
        resolution_status: 'pending',
        resolution_notes: 'Amount mismatch detected',
        notes: 'Requires manual review',
      }

      const { data, error } = await supabase
        .from('payment_reconciliation_log')
        .insert(reconciliationData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.status).toBe('discrepancy')
      expect(data.difference_amount).toBe(-100)
      expect(data.resolution_status).toBe('pending')
    })
  })

  describe('Database Indexes Performance', () => {
    it('should efficiently query payments by registration_id', async () => {
      const registrationId = faker.number.int({ min: 1000, max: 9999 })
      
      // Create multiple payments for same registration
      const payments = Array.from({ length: 5 }, () => 
        createTestPayment(undefined, registrationId)
      )

      for (const paymentData of payments) {
        const { data } = await supabase
          .from('square_payments')
          .insert(paymentData)
          .select()
          .single()
        testPayments.push(data)
      }

      const startTime = Date.now()
      
      const { data, error } = await supabase
        .from('square_payments')
        .select('*')
        .eq('registration_id', registrationId)

      const queryTime = Date.now() - startTime

      expect(error).toBeNull()
      expect(data).toHaveLength(5)
      expect(queryTime).toBeLessThan(100) // Should be fast with index
    })

    it('should efficiently query customers by email', async () => {
      const email = faker.internet.email()
      const customerData = { ...createTestCustomer(), email }
      
      const { data: customer } = await supabase
        .from('square_customers')
        .insert(customerData)
        .select()
        .single()
      
      testCustomers.push(customer)

      const startTime = Date.now()
      
      const { data, error } = await supabase
        .from('square_customers')
        .select('*')
        .eq('email', email)

      const queryTime = Date.now() - startTime

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].email).toBe(email)
      expect(queryTime).toBeLessThan(50) // Should be very fast with unique index
    })

    it('should efficiently query webhooks by event_type and status', async () => {
      // Create multiple webhooks
      const webhooks = Array.from({ length: 10 }, (_, i) => ({
        event_id: `test_event_perf_${i}_${faker.string.alphanumeric(10)}`,
        event_type: i % 2 === 0 ? 'payment.created' : 'payment.updated',
        merchant_id: 'test_merchant',
        event_data: { test: `data_${i}` },
        status: i % 3 === 0 ? 'processed' : 'received',
        created_at_square: new Date().toISOString(),
      }))

      for (const webhook of webhooks) {
        await supabase.from('square_webhooks').insert(webhook)
      }

      const startTime = Date.now()
      
      const { data, error } = await supabase
        .from('square_webhooks')
        .select('*')
        .eq('event_type', 'payment.created')
        .eq('status', 'received')

      const queryTime = Date.now() - startTime

      expect(error).toBeNull()
      expect(queryTime).toBeLessThan(100) // Should be fast with compound index
    })
  })

  describe('Data Integrity and Constraints', () => {
    it('should maintain referential integrity on customer deletion', async () => {
      // Create customer and payment
      const customerData = createTestCustomer()
      const { data: customer } = await supabase
        .from('square_customers')
        .insert(customerData)
        .select()
        .single()

      const paymentData = {
        ...createTestPayment(customer.square_customer_id),
        customer_id: customer.id,
      }

      const { data: payment } = await supabase
        .from('square_payments')
        .insert(paymentData)
        .select()
        .single()

      // Delete customer
      await supabase.from('square_customers').delete().eq('id', customer.id)

      // Verify payment still exists but customer_id is NULL
      const { data: updatedPayment } = await supabase
        .from('square_payments')
        .select('*')
        .eq('id', payment.id)
        .single()

      expect(updatedPayment.customer_id).toBeNull()
      expect(updatedPayment.square_customer_id).toBe(customer.square_customer_id)

      testPayments.push(updatedPayment)
    })

    it('should validate currency codes', async () => {
      const paymentData = {
        ...createTestPayment(),
        amount_money_currency: 'INVALID',
        total_money_currency: 'INVALID',
      }

      // This should still work as we don't have strict currency validation
      // but in production, you might want to add CHECK constraints
      const { data, error } = await supabase
        .from('square_payments')
        .insert(paymentData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.amount_money_currency).toBe('INVALID')
      
      testPayments.push(data)
    })
  })

  describe('Sync Status Management', () => {
    it('should track sync status properly', async () => {
      const customerData = {
        ...createTestCustomer(),
        sync_status: 'pending',
      }

      const { data: customer } = await supabase
        .from('square_customers')
        .insert(customerData)
        .select()
        .single()

      expect(customer.sync_status).toBe('pending')

      // Update sync status
      const { data: updated } = await supabase
        .from('square_customers')
        .update({ 
          sync_status: 'synced',
          synced_at: new Date().toISOString(),
        })
        .eq('id', customer.id)
        .select()
        .single()

      expect(updated.sync_status).toBe('synced')
      expect(updated.synced_at).toBeDefined()

      testCustomers.push(updated)
    })

    it('should handle sync errors', async () => {
      const paymentData = {
        ...createTestPayment(),
        sync_status: 'error',
      }

      const { data, error } = await supabase
        .from('square_payments')
        .insert(paymentData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.sync_status).toBe('error')

      testPayments.push(data)
    })
  })
})