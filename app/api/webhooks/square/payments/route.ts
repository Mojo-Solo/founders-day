/**
 * Square Payment Webhooks API Route
 * 
 * Dedicated webhook endpoint for Square payment events.
 * Handles payment status updates, completions, failures, and refunds.
 * 
 * Route: POST /api/webhooks/square/payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateWebhook } from '../../../../../lib/middleware/webhook-auth'
import webhookQueue from '../../../../../lib/middleware/webhook-queue'
import { WebhookPriority } from '../../../../../lib/middleware/webhook-queue'
import logger from '../../../../../lib/monitoring/logger'

/**
 * Payment webhook event types and their priorities
 */
const PAYMENT_EVENT_PRIORITIES = {
  'payment.created': WebhookPriority.HIGH,
  'payment.updated': WebhookPriority.HIGH,
  'payment.completed': WebhookPriority.HIGH,
  'payment.failed': WebhookPriority.HIGH,
  'refund.created': WebhookPriority.HIGH,
  'refund.updated': WebhookPriority.NORMAL,
  'refund.completed': WebhookPriority.NORMAL,
  'refund.failed': WebhookPriority.HIGH,
  'dispute.created': WebhookPriority.CRITICAL,
  'dispute.state_changed': WebhookPriority.CRITICAL,
  'terminal.checkout.created': WebhookPriority.NORMAL,
  'terminal.checkout.updated': WebhookPriority.NORMAL,
} as const

/**
 * Payment webhook processor function
 */
async function processPaymentWebhook(eventData: any) {
  const { event_type, data } = eventData
  const startTime = Date.now()

  logger.info('Processing Square payment webhook', {
    eventType: event_type,
    eventId: eventData.event_id || 'unknown',
    timestamp: eventData.created_at,
  })

  try {
    switch (event_type) {
      case 'payment.created':
        return await handlePaymentCreated(data)
      
      case 'payment.updated':
        return await handlePaymentUpdated(data)
      
      case 'payment.completed':
        return await handlePaymentCompleted(data)
      
      case 'payment.failed':
        return await handlePaymentFailed(data)
      
      case 'refund.created':
        return await handleRefundCreated(data)
      
      case 'refund.updated':
        return await handleRefundUpdated(data)
      
      case 'refund.completed':
        return await handleRefundCompleted(data)
      
      case 'refund.failed':
        return await handleRefundFailed(data)
      
      case 'dispute.created':
        return await handleDisputeCreated(data)
      
      case 'dispute.state_changed':
        return await handleDisputeStateChanged(data)
      
      case 'terminal.checkout.created':
        return await handleTerminalCheckoutCreated(data)
      
      case 'terminal.checkout.updated':
        return await handleTerminalCheckoutUpdated(data)
      
      default:
        logger.warn('Unhandled payment webhook event type', {
          eventType: event_type,
          eventId: eventData.event_id,
        })
        return { success: true, message: 'Event type not handled but acknowledged' }
    }

  } catch (error) {
    logger.error('Payment webhook processing failed', {
      eventType: event_type,
      eventId: eventData.event_id,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    throw error
  }
}

// Event handlers

async function handlePaymentCreated(data: any) {
  const payment = data.object?.payment
  if (!payment) {
    throw new Error('No payment object in webhook data')
  }

  logger.info('Processing payment created event', {
    paymentId: payment.id,
    amount: payment.amount_money?.amount,
    status: payment.status,
  })

  // Store/update payment in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/upsert_square_payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_payment_id: payment.id,
      p_registration_id: payment.reference_id,
      p_amount_money_amount: payment.amount_money?.amount || 0,
      p_amount_money_currency: payment.amount_money?.currency || 'USD',
      p_total_money_amount: payment.total_money?.amount || 0,
      p_total_money_currency: payment.total_money?.currency || 'USD',
      p_status: payment.status || 'PENDING',
      p_source_type: payment.source_type || 'CARD',
      p_card_brand: payment.card_details?.card?.card_brand,
      p_card_last_4: payment.card_details?.card?.last_4,
      p_receipt_number: payment.receipt_number,
      p_receipt_url: payment.receipt_url,
      p_reference_id: payment.reference_id,
      p_note: payment.note,
      p_buyer_email_address: payment.buyer_email_address,
      p_application_details_square_product: payment.application_details?.square_product,
      p_application_details_application_id: payment.application_details?.application_id,
      p_location_id: payment.location_id,
      p_created_at_square: payment.created_at ? new Date(payment.created_at) : new Date(),
      p_updated_at_square: payment.updated_at ? new Date(payment.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  // Trigger registration status update if needed
  if (payment.reference_id && payment.status === 'COMPLETED') {
    await updateRegistrationPaymentStatus(payment.reference_id, 'completed', payment.id)
  }

  return { success: true, message: 'Payment created event processed' }
}

async function handlePaymentUpdated(data: any) {
  const payment = data.object?.payment
  if (!payment) {
    throw new Error('No payment object in webhook data')
  }

  logger.info('Processing payment updated event', {
    paymentId: payment.id,
    amount: payment.amount_money?.amount,
    status: payment.status,
  })

  // Update payment in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/update_square_payment_status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_payment_id: payment.id,
      p_status: payment.status,
      p_updated_at_square: payment.updated_at ? new Date(payment.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  return { success: true, message: 'Payment updated event processed' }
}

async function handlePaymentCompleted(data: any) {
  const payment = data.object?.payment
  if (!payment) {
    throw new Error('No payment object in webhook data')
  }

  logger.info('Processing payment completed event', {
    paymentId: payment.id,
    amount: payment.amount_money?.amount,
    referenceId: payment.reference_id,
  })

  // Update payment status in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/complete_square_payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_payment_id: payment.id,
      p_completed_at: payment.updated_at ? new Date(payment.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  // Update registration status
  if (payment.reference_id) {
    await updateRegistrationPaymentStatus(payment.reference_id, 'completed', payment.id)
  }

  // Send confirmation email (if enabled)
  if (payment.buyer_email_address) {
    await sendPaymentConfirmationEmail(payment)
  }

  return { success: true, message: 'Payment completed event processed' }
}

async function handlePaymentFailed(data: any) {
  const payment = data.object?.payment
  if (!payment) {
    throw new Error('No payment object in webhook data')
  }

  logger.warn('Processing payment failed event', {
    paymentId: payment.id,
    amount: payment.amount_money?.amount,
    referenceId: payment.reference_id,
    status: payment.status,
  })

  // Update payment status in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/fail_square_payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_payment_id: payment.id,
      p_failure_reason: payment.processing_fee?.[0]?.type || 'Unknown',
      p_failed_at: payment.updated_at ? new Date(payment.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  // Update registration status
  if (payment.reference_id) {
    await updateRegistrationPaymentStatus(payment.reference_id, 'failed', payment.id)
  }

  return { success: true, message: 'Payment failed event processed' }
}

async function handleRefundCreated(data: any) {
  const refund = data.object?.refund
  if (!refund) {
    throw new Error('No refund object in webhook data')
  }

  logger.info('Processing refund created event', {
    refundId: refund.id,
    paymentId: refund.payment_id,
    amount: refund.amount_money?.amount,
  })

  // Store refund in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/create_square_refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_refund_id: refund.id,
      p_square_payment_id: refund.payment_id,
      p_amount_money_amount: refund.amount_money?.amount || 0,
      p_amount_money_currency: refund.amount_money?.currency || 'USD',
      p_status: refund.status || 'PENDING',
      p_reason: refund.reason,
      p_location_id: refund.location_id,
      p_created_at_square: refund.created_at ? new Date(refund.created_at) : new Date(),
      p_updated_at_square: refund.updated_at ? new Date(refund.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  return { success: true, message: 'Refund created event processed' }
}

async function handleRefundUpdated(data: any) {
  const refund = data.object?.refund
  if (!refund) {
    throw new Error('No refund object in webhook data')
  }

  logger.info('Processing refund updated event', {
    refundId: refund.id,
    paymentId: refund.payment_id,
    status: refund.status,
  })

  // Update refund in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/update_square_refund_status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_refund_id: refund.id,
      p_status: refund.status,
      p_updated_at_square: refund.updated_at ? new Date(refund.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  return { success: true, message: 'Refund updated event processed' }
}

async function handleRefundCompleted(data: any) {
  const refund = data.object?.refund
  if (!refund) {
    throw new Error('No refund object in webhook data')
  }

  logger.info('Processing refund completed event', {
    refundId: refund.id,
    paymentId: refund.payment_id,
    amount: refund.amount_money?.amount,
  })

  // Update refund status in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/complete_square_refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_refund_id: refund.id,
      p_completed_at: refund.updated_at ? new Date(refund.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  return { success: true, message: 'Refund completed event processed' }
}

async function handleRefundFailed(data: any) {
  const refund = data.object?.refund
  if (!refund) {
    throw new Error('No refund object in webhook data')
  }

  logger.warn('Processing refund failed event', {
    refundId: refund.id,
    paymentId: refund.payment_id,
    status: refund.status,
  })

  // Update refund status in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/fail_square_refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_refund_id: refund.id,
      p_failed_at: refund.updated_at ? new Date(refund.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  return { success: true, message: 'Refund failed event processed' }
}

async function handleDisputeCreated(data: any) {
  const dispute = data.object?.dispute
  if (!dispute) {
    throw new Error('No dispute object in webhook data')
  }

  logger.warn('Processing dispute created event', {
    disputeId: dispute.id,
    paymentId: dispute.disputed_payment?.payment_id,
    amount: dispute.amount_money?.amount,
    reason: dispute.reason,
  })

  // Log dispute for immediate attention
  await fetch(`${process.env.DATABASE_URL}/rpc/create_square_dispute_log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_dispute_id: dispute.id,
      p_payment_id: dispute.disputed_payment?.payment_id,
      p_amount: dispute.amount_money?.amount || 0,
      p_currency: dispute.amount_money?.currency || 'USD',
      p_reason: dispute.reason,
      p_state: dispute.state,
      p_created_at: dispute.created_at ? new Date(dispute.created_at) : new Date(),
    }),
  })

  // Send alert notification
  logger.error('CRITICAL: Payment dispute created', {
    disputeId: dispute.id,
    paymentId: dispute.disputed_payment?.payment_id,
    amount: dispute.amount_money?.amount,
    reason: dispute.reason,
  })

  return { success: true, message: 'Dispute created event processed' }
}

async function handleDisputeStateChanged(data: any) {
  const dispute = data.object?.dispute
  if (!dispute) {
    throw new Error('No dispute object in webhook data')
  }

  logger.info('Processing dispute state changed event', {
    disputeId: dispute.id,
    paymentId: dispute.disputed_payment?.payment_id,
    newState: dispute.state,
  })

  // Update dispute state
  await fetch(`${process.env.DATABASE_URL}/rpc/update_square_dispute_state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_dispute_id: dispute.id,
      p_state: dispute.state,
      p_updated_at: dispute.updated_at ? new Date(dispute.updated_at) : new Date(),
    }),
  })

  return { success: true, message: 'Dispute state changed event processed' }
}

async function handleTerminalCheckoutCreated(data: any) {
  const checkout = data.object?.checkout
  if (!checkout) {
    throw new Error('No checkout object in webhook data')
  }

  logger.info('Processing terminal checkout created event', {
    checkoutId: checkout.id,
    amount: checkout.amount_money?.amount,
    status: checkout.status,
  })

  return { success: true, message: 'Terminal checkout created event processed' }
}

async function handleTerminalCheckoutUpdated(data: any) {
  const checkout = data.object?.checkout
  if (!checkout) {
    throw new Error('No checkout object in webhook data')
  }

  logger.info('Processing terminal checkout updated event', {
    checkoutId: checkout.id,
    amount: checkout.amount_money?.amount,
    status: checkout.status,
  })

  return { success: true, message: 'Terminal checkout updated event processed' }
}

// Helper functions

async function updateRegistrationPaymentStatus(
  registrationId: string, 
  status: string, 
  paymentId: string
) {
  try {
    const updateResult = await fetch(
      `${process.env.DATABASE_URL}/rpc/update_registration_payment_status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_registration_id: registrationId,
          p_payment_status: status,
          p_square_payment_id: paymentId,
        }),
      }
    )

    if (!updateResult.ok) {
      logger.error('Failed to update registration payment status', {
        registrationId,
        status,
        paymentId,
        error: await updateResult.text(),
      })
    }
  } catch (error) {
    logger.error('Error updating registration payment status', {
      registrationId,
      status,
      paymentId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function sendPaymentConfirmationEmail(payment: any) {
  try {
    // This would integrate with your email service
    logger.info('Payment confirmation email would be sent', {
      paymentId: payment.id,
      email: payment.buyer_email_address,
      amount: payment.amount_money?.amount,
    })
  } catch (error) {
    logger.error('Failed to send payment confirmation email', {
      paymentId: payment.id,
      email: payment.buyer_email_address,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Register payment webhook processor with the queue
 */
webhookQueue.registerProcessor({
  name: 'payment-webhook-processor',
  eventTypes: Object.keys(PAYMENT_EVENT_PRIORITIES),
  process: processPaymentWebhook,
  retryCount: 3,
  timeout: 30000, // 30 seconds
})

/**
 * POST handler for payment webhooks
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authenticate webhook
    const authResult = await authenticateWebhook(request)
    if (!authResult.success) {
      logger.warn('Payment webhook authentication failed', {
        error: authResult.error,
        clientIp: request.headers.get('x-forwarded-for') || 'unknown',
      })
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    const eventData = authResult.data

    // Validate event type
    const eventType = eventData.event_type
    if (!PAYMENT_EVENT_PRIORITIES.hasOwnProperty(eventType)) {
      logger.warn('Unknown payment webhook event type', {
        eventType,
        eventId: eventData.event_id,
      })
      return NextResponse.json(
        { success: true, message: 'Event type not supported' },
        { status: 200 }
      )
    }

    // Queue webhook for processing
    const priority = PAYMENT_EVENT_PRIORITIES[eventType as keyof typeof PAYMENT_EVENT_PRIORITIES]
    
    await webhookQueue.enqueue({
      id: eventData.event_id || `payment-${Date.now()}`,
      type: eventType,
      data: eventData,
      priority,
      metadata: {
        source: 'square-payments',
        receivedAt: new Date(),
        clientIp: request.headers.get('x-forwarded-for') || 'unknown',
      },
    })

    logger.info('Payment webhook queued successfully', {
      eventType,
      eventId: eventData.event_id,
      priority,
      duration: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      message: 'Webhook received and queued',
      eventId: eventData.event_id,
    })

  } catch (error) {
    logger.error('Payment webhook processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}