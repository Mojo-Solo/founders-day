/**
 * Square Webhook Processing Service
 * 
 * Handles the actual processing logic for different Square webhook events.
 * Integrates with the database to update payment and customer records.
 * 
 * Features:
 * - Event-specific processing handlers
 * - Database integration for payments and customers
 * - Comprehensive error handling and logging
 * - Idempotency and data consistency
 * - Support for all Square webhook event types
 */

import logger from '../monitoring/logger'
import { WebhookProcessor, WebhookProcessResult, WebhookPriority, WebhookJob } from '../middleware/webhook-queue'

// Types for Square webhook events
export interface SquareWebhookEvent {
  merchant_id: string
  type: string
  event_id: string
  created_at: string
  data: {
    type: string
    id: string
    object: any
  }
}

export interface PaymentWebhookData {
  id: string
  created_at: string
  updated_at: string
  amount_money: {
    amount: number
    currency: string
  }
  status: string
  source_type: string
  card_details?: {
    card: {
      card_brand: string
      last_4: string
      exp_month: number
      exp_year: number
      fingerprint: string
    }
    avs_status?: string
    cvv_status?: string
  }
  location_id: string
  order_id?: string
  customer_id?: string
  reference_id?: string
  receipt_number?: string
  receipt_url?: string
  processing_fee?: Array<{
    amount_money: {
      amount: number
      currency: string
    }
    type: string
  }>
  application_details?: {
    square_product: string
    application_id: string
  }
  risk_evaluation?: {
    created_at: string
    risk_level: string
  }
}

export interface CustomerWebhookData {
  id: string
  created_at: string
  updated_at: string
  given_name?: string
  family_name?: string
  company_name?: string
  nickname?: string
  email_address?: string
  phone_number?: string
  address?: {
    address_line_1?: string
    address_line_2?: string
    locality?: string
    administrative_district_level_1?: string
    postal_code?: string
    country?: string
  }
  preferences?: {
    email_unsubscribed?: boolean
  }
  creation_source?: string
  group_ids?: string[]
  segments_ids?: string[]
  version?: number
}

/**
 * Database service interface (implement with your database client)
 */
interface DatabaseService {
  // Payment operations
  upsertPayment(paymentData: any): Promise<void>
  updatePaymentStatus(paymentId: string, status: string, metadata?: any): Promise<void>
  getPaymentBySquareId(squarePaymentId: string): Promise<any | null>
  
  // Customer operations
  upsertCustomer(customerData: any): Promise<void>
  getCustomerBySquareId(squareCustomerId: string): Promise<any | null>
  updateCustomerSpending(customerId: string): Promise<void>
  
  // Webhook operations
  upsertWebhookEvent(eventData: any): Promise<void>
  markWebhookProcessed(eventId: string, result: any): Promise<void>
  
  // Registration operations
  updateRegistrationPayment(registrationId: string, paymentData: any): Promise<void>
  getRegistrationByOrderId(orderId: string): Promise<any | null>
}

// Mock database service - replace with actual implementation
const createDatabaseService = (): DatabaseService => ({
  async upsertPayment(paymentData: any): Promise<void> {
    logger.debug('Database: Upserting payment', {
      component: 'webhook-processor',
      metadata: { paymentId: paymentData.square_payment_id }
    })
    // TODO: Implement actual database upsert
  },
  
  async updatePaymentStatus(paymentId: string, status: string, metadata?: any): Promise<void> {
    logger.debug('Database: Updating payment status', {
      component: 'webhook-processor',
      metadata: { paymentId, status }
    })
    // TODO: Implement actual database update
  },
  
  async getPaymentBySquareId(squarePaymentId: string): Promise<any | null> {
    logger.debug('Database: Getting payment by Square ID', {
      component: 'webhook-processor',
      metadata: { squarePaymentId }
    })
    // TODO: Implement actual database query
    return null
  },
  
  async upsertCustomer(customerData: any): Promise<void> {
    logger.debug('Database: Upserting customer', {
      component: 'webhook-processor',
      metadata: { customerId: customerData.square_customer_id }
    })
    // TODO: Implement actual database upsert
  },
  
  async getCustomerBySquareId(squareCustomerId: string): Promise<any | null> {
    logger.debug('Database: Getting customer by Square ID', {
      component: 'webhook-processor',
      metadata: { squareCustomerId }
    })
    // TODO: Implement actual database query
    return null
  },
  
  async updateCustomerSpending(customerId: string): Promise<void> {
    logger.debug('Database: Updating customer spending', {
      component: 'webhook-processor',
      metadata: { customerId }
    })
    // TODO: Implement actual database update
  },
  
  async upsertWebhookEvent(eventData: any): Promise<void> {
    logger.debug('Database: Upserting webhook event', {
      component: 'webhook-processor',
      metadata: { eventId: eventData.square_event_id }
    })
    // TODO: Implement actual database upsert
  },
  
  async markWebhookProcessed(eventId: string, result: any): Promise<void> {
    logger.debug('Database: Marking webhook as processed', {
      component: 'webhook-processor',
      metadata: { eventId }
    })
    // TODO: Implement actual database update
  },
  
  async updateRegistrationPayment(registrationId: string, paymentData: any): Promise<void> {
    logger.debug('Database: Updating registration payment', {
      component: 'webhook-processor',
      metadata: { registrationId }
    })
    // TODO: Implement actual database update
  },
  
  async getRegistrationByOrderId(orderId: string): Promise<any | null> {
    logger.debug('Database: Getting registration by order ID', {
      component: 'webhook-processor',
      metadata: { orderId }
    })
    // TODO: Implement actual database query
    return null
  }
})

const db = createDatabaseService()

/**
 * Payment Created Event Processor
 */
const processPaymentCreated: WebhookProcessor = {
  eventType: 'payment.created',
  priority: WebhookPriority.HIGH,
  maxAttempts: 5,
  handler: async (payload: SquareWebhookEvent, job: WebhookJob): Promise<WebhookProcessResult> => {
    try {
      const paymentData: PaymentWebhookData = payload.data.object
      
      logger.info('Processing payment.created webhook', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          paymentId: paymentData.id,
          amount: paymentData.amount_money.amount,
          status: paymentData.status
        }
      })
      
      // Store webhook event
      await db.upsertWebhookEvent({
        square_event_id: payload.event_id,
        event_type: payload.type,
        merchant_id: payload.merchant_id,
        event_data: payload,
        processing_status: 'PROCESSING',
        created_at_square: new Date(payload.created_at)
      })
      
      // Calculate processing fee
      let processingFee = 0
      if (paymentData.processing_fee) {
        processingFee = paymentData.processing_fee.reduce((sum, fee) => 
          sum + fee.amount_money.amount, 0
        )
      }
      
      // Prepare payment record
      const paymentRecord = {
        square_payment_id: paymentData.id,
        square_order_id: paymentData.order_id,
        square_customer_id: paymentData.customer_id,
        square_location_id: paymentData.location_id,
        amount_money: paymentData.amount_money.amount / 100, // Convert cents to dollars
        currency: paymentData.amount_money.currency,
        processing_fee: processingFee / 100,
        net_amount: (paymentData.amount_money.amount - processingFee) / 100,
        status: paymentData.status.toUpperCase(),
        square_status: paymentData.status,
        created_at_square: new Date(paymentData.created_at),
        updated_at_square: new Date(paymentData.updated_at),
        receipt_number: paymentData.receipt_number,
        receipt_url: paymentData.receipt_url,
        reference_id: paymentData.reference_id,
        webhook_event_id: payload.event_id,
        raw_square_data: paymentData
      }
      
      // Add card details if present
      if (paymentData.card_details) {
        paymentRecord.card_brand = paymentData.card_details.card.card_brand
        paymentRecord.card_last_4 = paymentData.card_details.card.last_4
        paymentRecord.card_exp_month = paymentData.card_details.card.exp_month
        paymentRecord.card_exp_year = paymentData.card_details.card.exp_year
        paymentRecord.card_fingerprint = paymentData.card_details.card.fingerprint
        paymentRecord.payment_type = 'CARD'
      }
      
      // Add risk evaluation if present
      if (paymentData.risk_evaluation) {
        paymentRecord.risk_evaluation = paymentData.risk_evaluation
      }
      
      // Upsert payment record
      await db.upsertPayment(paymentRecord)
      
      // Update registration if order ID is present
      if (paymentData.order_id) {
        const registration = await db.getRegistrationByOrderId(paymentData.order_id)
        if (registration) {
          await db.updateRegistrationPayment(registration.id, {
            square_payment_id: paymentData.id,
            payment_status: 'paid',
            card_brand: paymentRecord.card_brand,
            card_last_4: paymentRecord.card_last_4,
            receipt_url: paymentData.receipt_url
          })
        }
      }
      
      // Update customer spending if customer ID is present
      if (paymentData.customer_id) {
        await db.updateCustomerSpending(paymentData.customer_id)
      }
      
      // Mark webhook as processed
      await db.markWebhookProcessed(payload.event_id, {
        payment_id: paymentData.id,
        status: 'processed',
        processing_time: job.processingTime
      })
      
      logger.info('Payment created webhook processed successfully', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          paymentId: paymentData.id,
          processingTime: job.processingTime
        }
      })
      
      return {
        success: true,
        metadata: {
          paymentId: paymentData.id,
          amount: paymentData.amount_money.amount,
          processingFee
        }
      }
      
    } catch (error) {
      logger.error('Failed to process payment.created webhook', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          paymentId: payload.data?.object?.id
        }
      })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true
      }
    }
  }
}

/**
 * Payment Updated Event Processor
 */
const processPaymentUpdated: WebhookProcessor = {
  eventType: 'payment.updated',
  priority: WebhookPriority.HIGH,
  maxAttempts: 5,
  handler: async (payload: SquareWebhookEvent, job: WebhookJob): Promise<WebhookProcessResult> => {
    try {
      const paymentData: PaymentWebhookData = payload.data.object
      
      logger.info('Processing payment.updated webhook', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          paymentId: paymentData.id,
          status: paymentData.status
        }
      })
      
      // Store webhook event
      await db.upsertWebhookEvent({
        square_event_id: payload.event_id,
        event_type: payload.type,
        merchant_id: payload.merchant_id,
        event_data: payload,
        processing_status: 'PROCESSING',
        created_at_square: new Date(payload.created_at)
      })
      
      // Get existing payment
      const existingPayment = await db.getPaymentBySquareId(paymentData.id)
      
      if (!existingPayment) {
        // Payment doesn't exist, treat as creation
        logger.warn('Payment not found for update, treating as creation', {
          component: 'webhook-processor',
          metadata: {
            eventId: payload.event_id,
            paymentId: paymentData.id
          }
        })
        
        return await processPaymentCreated.handler(payload, job)
      }
      
      // Update payment status and metadata
      await db.updatePaymentStatus(paymentData.id, paymentData.status.toUpperCase(), {
        updated_at_square: new Date(paymentData.updated_at),
        raw_square_data: paymentData,
        webhook_event_id: payload.event_id
      })
      
      // Update registration status if needed
      if (paymentData.order_id) {
        const registration = await db.getRegistrationByOrderId(paymentData.order_id)
        if (registration) {
          let registrationStatus = registration.status
          
          // Map payment status to registration status
          switch (paymentData.status.toLowerCase()) {
            case 'completed':
              registrationStatus = 'confirmed'
              break
            case 'canceled':
            case 'failed':
              registrationStatus = 'cancelled'
              break
          }
          
          await db.updateRegistrationPayment(registration.id, {
            payment_status: paymentData.status.toLowerCase(),
            status: registrationStatus
          })
        }
      }
      
      // Mark webhook as processed
      await db.markWebhookProcessed(payload.event_id, {
        payment_id: paymentData.id,
        status: 'processed',
        update_type: 'status_change',
        new_status: paymentData.status
      })
      
      logger.info('Payment updated webhook processed successfully', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          paymentId: paymentData.id,
          newStatus: paymentData.status
        }
      })
      
      return {
        success: true,
        metadata: {
          paymentId: paymentData.id,
          newStatus: paymentData.status,
          updateType: 'status_change'
        }
      }
      
    } catch (error) {
      logger.error('Failed to process payment.updated webhook', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          paymentId: payload.data?.object?.id
        }
      })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true
      }
    }
  }
}

/**
 * Customer Created Event Processor
 */
const processCustomerCreated: WebhookProcessor = {
  eventType: 'customer.created',
  priority: WebhookPriority.NORMAL,
  maxAttempts: 3,
  handler: async (payload: SquareWebhookEvent, job: WebhookJob): Promise<WebhookProcessResult> => {
    try {
      const customerData: CustomerWebhookData = payload.data.object
      
      logger.info('Processing customer.created webhook', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          customerId: customerData.id,
          email: customerData.email_address
        }
      })
      
      // Store webhook event
      await db.upsertWebhookEvent({
        square_event_id: payload.event_id,
        event_type: payload.type,
        merchant_id: payload.merchant_id,
        event_data: payload,
        processing_status: 'PROCESSING',
        created_at_square: new Date(payload.created_at)
      })
      
      // Prepare customer record
      const customerRecord = {
        square_customer_id: customerData.id,
        given_name: customerData.given_name,
        family_name: customerData.family_name,
        company_name: customerData.company_name,
        nickname: customerData.nickname,
        email_address: customerData.email_address,
        phone_number: customerData.phone_number,
        address: customerData.address,
        preferences: customerData.preferences,
        groups: customerData.group_ids,
        segment_ids: customerData.segments_ids,
        created_at_square: new Date(customerData.created_at),
        updated_at_square: new Date(customerData.updated_at),
        version: customerData.version || 0,
        registration_count: 0,
        total_spent: 0,
        is_vip: false
      }
      
      // Upsert customer record
      await db.upsertCustomer(customerRecord)
      
      // Mark webhook as processed
      await db.markWebhookProcessed(payload.event_id, {
        customer_id: customerData.id,
        status: 'processed'
      })
      
      logger.info('Customer created webhook processed successfully', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          customerId: customerData.id
        }
      })
      
      return {
        success: true,
        metadata: {
          customerId: customerData.id,
          email: customerData.email_address
        }
      }
      
    } catch (error) {
      logger.error('Failed to process customer.created webhook', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          customerId: payload.data?.object?.id
        }
      })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true
      }
    }
  }
}

/**
 * Customer Updated Event Processor
 */
const processCustomerUpdated: WebhookProcessor = {
  eventType: 'customer.updated',
  priority: WebhookPriority.NORMAL,
  maxAttempts: 3,
  handler: async (payload: SquareWebhookEvent, job: WebhookJob): Promise<WebhookProcessResult> => {
    try {
      const customerData: CustomerWebhookData = payload.data.object
      
      logger.info('Processing customer.updated webhook', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          customerId: customerData.id
        }
      })
      
      // Store webhook event
      await db.upsertWebhookEvent({
        square_event_id: payload.event_id,
        event_type: payload.type,
        merchant_id: payload.merchant_id,
        event_data: payload,
        processing_status: 'PROCESSING',
        created_at_square: new Date(payload.created_at)
      })
      
      // Check if customer exists
      const existingCustomer = await db.getCustomerBySquareId(customerData.id)
      
      if (!existingCustomer) {
        // Customer doesn't exist, treat as creation
        logger.warn('Customer not found for update, treating as creation', {
          component: 'webhook-processor',
          metadata: {
            eventId: payload.event_id,
            customerId: customerData.id
          }
        })
        
        return await processCustomerCreated.handler(payload, job)
      }
      
      // Update customer record
      const customerRecord = {
        square_customer_id: customerData.id,
        given_name: customerData.given_name,
        family_name: customerData.family_name,
        company_name: customerData.company_name,
        nickname: customerData.nickname,
        email_address: customerData.email_address,
        phone_number: customerData.phone_number,
        address: customerData.address,
        preferences: customerData.preferences,
        groups: customerData.group_ids,
        segment_ids: customerData.segments_ids,
        updated_at_square: new Date(customerData.updated_at),
        version: customerData.version || existingCustomer.version
      }
      
      await db.upsertCustomer(customerRecord)
      
      // Mark webhook as processed
      await db.markWebhookProcessed(payload.event_id, {
        customer_id: customerData.id,
        status: 'processed',
        update_type: 'customer_update'
      })
      
      logger.info('Customer updated webhook processed successfully', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          customerId: customerData.id
        }
      })
      
      return {
        success: true,
        metadata: {
          customerId: customerData.id,
          updateType: 'customer_update'
        }
      }
      
    } catch (error) {
      logger.error('Failed to process customer.updated webhook', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          customerId: payload.data?.object?.id
        }
      })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true
      }
    }
  }
}

/**
 * Generic Event Processor for unhandled events
 */
const processGenericEvent: WebhookProcessor = {
  eventType: 'generic',
  priority: WebhookPriority.LOW,
  maxAttempts: 1,
  handler: async (payload: SquareWebhookEvent, job: WebhookJob): Promise<WebhookProcessResult> => {
    try {
      logger.info('Processing generic webhook event', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          eventType: payload.type
        }
      })
      
      // Store webhook event for analysis
      await db.upsertWebhookEvent({
        square_event_id: payload.event_id,
        event_type: payload.type,
        merchant_id: payload.merchant_id,
        event_data: payload,
        processing_status: 'PROCESSED',
        created_at_square: new Date(payload.created_at)
      })
      
      // Mark as processed (no action needed)
      await db.markWebhookProcessed(payload.event_id, {
        status: 'processed',
        action: 'logged_only'
      })
      
      return {
        success: true,
        metadata: {
          eventType: payload.type,
          action: 'logged_only'
        }
      }
      
    } catch (error) {
      logger.error('Failed to process generic webhook event', {
        component: 'webhook-processor',
        metadata: {
          eventId: payload.event_id,
          eventType: payload.type,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: false // Don't retry generic events
      }
    }
  }
}

// Export all processors
export const webhookProcessors = {
  'payment.created': processPaymentCreated,
  'payment.updated': processPaymentUpdated,
  'customer.created': processCustomerCreated,
  'customer.updated': processCustomerUpdated,
  'generic': processGenericEvent
}

export {
  processPaymentCreated,
  processPaymentUpdated,
  processCustomerCreated,
  processCustomerUpdated,
  processGenericEvent
}

export type { SquareWebhookEvent, PaymentWebhookData, CustomerWebhookData, DatabaseService }