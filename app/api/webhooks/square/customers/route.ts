/**
 * Square Customer Webhooks API Route
 * 
 * Dedicated webhook endpoint for Square customer events.
 * Handles customer profile updates, creations, and deletions.
 * 
 * Route: POST /api/webhooks/square/customers
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateWebhook } from '../../../../../lib/middleware/webhook-auth'
import webhookQueue from '../../../../../lib/middleware/webhook-queue'
import { WebhookPriority } from '../../../../../lib/middleware/webhook-queue'
import logger from '../../../../../lib/monitoring/logger'

/**
 * Customer webhook event types and their priorities
 */
const CUSTOMER_EVENT_PRIORITIES = {
  'customer.created': WebhookPriority.NORMAL,
  'customer.updated': WebhookPriority.NORMAL,
  'customer.deleted': WebhookPriority.NORMAL,
  'customer.card.created': WebhookPriority.LOW,
  'customer.card.updated': WebhookPriority.LOW,
  'customer.card.deleted': WebhookPriority.LOW,
} as const

/**
 * Customer webhook processor function
 */
async function processCustomerWebhook(eventData: any) {
  const { event_type, data } = eventData
  const startTime = Date.now()

  logger.info('Processing Square customer webhook', {
    eventType: event_type,
    eventId: eventData.event_id || 'unknown',
    timestamp: eventData.created_at,
  })

  try {
    switch (event_type) {
      case 'customer.created':
        return await handleCustomerCreated(data)
      
      case 'customer.updated':
        return await handleCustomerUpdated(data)
      
      case 'customer.deleted':
        return await handleCustomerDeleted(data)
      
      case 'customer.card.created':
        return await handleCustomerCardCreated(data)
      
      case 'customer.card.updated':
        return await handleCustomerCardUpdated(data)
      
      case 'customer.card.deleted':
        return await handleCustomerCardDeleted(data)
      
      default:
        logger.warn('Unhandled customer webhook event type', {
          eventType: event_type,
          eventId: eventData.event_id,
        })
        return { success: true, message: 'Event type not handled but acknowledged' }
    }

  } catch (error) {
    logger.error('Customer webhook processing failed', {
      eventType: event_type,
      eventId: eventData.event_id,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    throw error
  }
}

// Event handlers

async function handleCustomerCreated(data: any) {
  const customer = data.object?.customer
  if (!customer) {
    throw new Error('No customer object in webhook data')
  }

  logger.info('Processing customer created event', {
    customerId: customer.id,
    email: customer.email_address,
    givenName: customer.given_name,
    familyName: customer.family_name,
  })

  // Store/update customer in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/upsert_square_customer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_customer_id: customer.id,
      p_email: customer.email_address,
      p_given_name: customer.given_name,
      p_family_name: customer.family_name,
      p_phone_number: customer.phone_number,
      p_company_name: customer.company_name,
      p_address_line_1: customer.address?.address_line_1,
      p_address_line_2: customer.address?.address_line_2,
      p_locality: customer.address?.locality,
      p_administrative_district_level_1: customer.address?.administrative_district_level_1,
      p_postal_code: customer.address?.postal_code,
      p_country: customer.address?.country || 'US',
      p_created_at_square: customer.created_at ? new Date(customer.created_at) : new Date(),
      p_updated_at_square: customer.updated_at ? new Date(customer.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  // Check if this customer is linked to any pending registrations
  await linkCustomerToPendingRegistrations(customer.id, customer.email_address)

  return { success: true, message: 'Customer created event processed' }
}

async function handleCustomerUpdated(data: any) {
  const customer = data.object?.customer
  if (!customer) {
    throw new Error('No customer object in webhook data')
  }

  logger.info('Processing customer updated event', {
    customerId: customer.id,
    email: customer.email_address,
    givenName: customer.given_name,
    familyName: customer.family_name,
  })

  // Update customer in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/upsert_square_customer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_customer_id: customer.id,
      p_email: customer.email_address,
      p_given_name: customer.given_name,
      p_family_name: customer.family_name,
      p_phone_number: customer.phone_number,
      p_company_name: customer.company_name,
      p_address_line_1: customer.address?.address_line_1,
      p_address_line_2: customer.address?.address_line_2,
      p_locality: customer.address?.locality,
      p_administrative_district_level_1: customer.address?.administrative_district_level_1,
      p_postal_code: customer.address?.postal_code,
      p_country: customer.address?.country || 'US',
      p_created_at_square: customer.created_at ? new Date(customer.created_at) : new Date(),
      p_updated_at_square: customer.updated_at ? new Date(customer.updated_at) : new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  // Update any linked registrations with new customer info
  await updateLinkedRegistrations(customer.id, customer)

  return { success: true, message: 'Customer updated event processed' }
}

async function handleCustomerDeleted(data: any) {
  const customer = data.object?.customer
  if (!customer) {
    throw new Error('No customer object in webhook data')
  }

  logger.info('Processing customer deleted event', {
    customerId: customer.id,
    email: customer.email_address,
  })

  // Mark customer as deleted in database (soft delete)
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/soft_delete_square_customer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_square_customer_id: customer.id,
      p_deleted_at: new Date(),
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database update failed: ${await dbResult.text()}`)
  }

  // Handle orphaned registrations
  await handleOrphanedRegistrations(customer.id)

  return { success: true, message: 'Customer deleted event processed' }
}

async function handleCustomerCardCreated(data: any) {
  const card = data.object?.card
  if (!card) {
    throw new Error('No card object in webhook data')
  }

  logger.info('Processing customer card created event', {
    cardId: card.id,
    customerId: card.customer_id,
    last4: card.last_4,
    cardBrand: card.card_brand,
  })

  // Store card information in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/upsert_square_customer_card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_card_id: card.id,
      p_square_customer_id: card.customer_id,
      p_card_brand: card.card_brand,
      p_last_4: card.last_4,
      p_exp_month: card.exp_month,
      p_exp_year: card.exp_year,
      p_cardholder_name: card.cardholder_name,
      p_billing_address_line_1: card.billing_address?.address_line_1,
      p_billing_address_line_2: card.billing_address?.address_line_2,
      p_billing_address_locality: card.billing_address?.locality,
      p_billing_address_administrative_district_level_1: card.billing_address?.administrative_district_level_1,
      p_billing_address_postal_code: card.billing_address?.postal_code,
      p_billing_address_country: card.billing_address?.country,
      p_fingerprint: card.fingerprint,
      p_enabled: card.enabled !== false,
      p_created_at: new Date(),
    }),
  })

  if (!dbResult.ok) {
    logger.error('Failed to store customer card', {
      cardId: card.id,
      customerId: card.customer_id,
      error: await dbResult.text(),
    })
  }

  return { success: true, message: 'Customer card created event processed' }
}

async function handleCustomerCardUpdated(data: any) {
  const card = data.object?.card
  if (!card) {
    throw new Error('No card object in webhook data')
  }

  logger.info('Processing customer card updated event', {
    cardId: card.id,
    customerId: card.customer_id,
    last4: card.last_4,
    enabled: card.enabled,
  })

  // Update card information in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/update_square_customer_card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_card_id: card.id,
      p_exp_month: card.exp_month,
      p_exp_year: card.exp_year,
      p_cardholder_name: card.cardholder_name,
      p_billing_address_line_1: card.billing_address?.address_line_1,
      p_billing_address_line_2: card.billing_address?.address_line_2,
      p_billing_address_locality: card.billing_address?.locality,
      p_billing_address_administrative_district_level_1: card.billing_address?.administrative_district_level_1,
      p_billing_address_postal_code: card.billing_address?.postal_code,
      p_billing_address_country: card.billing_address?.country,
      p_enabled: card.enabled !== false,
      p_updated_at: new Date(),
    }),
  })

  if (!dbResult.ok) {
    logger.error('Failed to update customer card', {
      cardId: card.id,
      customerId: card.customer_id,
      error: await dbResult.text(),
    })
  }

  return { success: true, message: 'Customer card updated event processed' }
}

async function handleCustomerCardDeleted(data: any) {
  const card = data.object?.card
  if (!card) {
    throw new Error('No card object in webhook data')
  }

  logger.info('Processing customer card deleted event', {
    cardId: card.id,
    customerId: card.customer_id,
    last4: card.last_4,
  })

  // Mark card as deleted in database
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/delete_square_customer_card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_card_id: card.id,
      p_deleted_at: new Date(),
    }),
  })

  if (!dbResult.ok) {
    logger.error('Failed to delete customer card', {
      cardId: card.id,
      customerId: card.customer_id,
      error: await dbResult.text(),
    })
  }

  return { success: true, message: 'Customer card deleted event processed' }
}

// Helper functions

async function linkCustomerToPendingRegistrations(customerId: string, email: string) {
  try {
    // Find any registrations with matching email that don't have a customer linked
    const linkResult = await fetch(
      `${process.env.DATABASE_URL}/rpc/link_customer_to_pending_registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_square_customer_id: customerId,
          p_email: email,
        }),
      }
    )

    if (!linkResult.ok) {
      logger.error('Failed to link customer to pending registrations', {
        customerId,
        email,
        error: await linkResult.text(),
      })
    } else {
      const linkedCount = await linkResult.json()
      if (linkedCount && linkedCount > 0) {
        logger.info('Linked customer to pending registrations', {
          customerId,
          email,
          linkedCount,
        })
      }
    }
  } catch (error) {
    logger.error('Error linking customer to pending registrations', {
      customerId,
      email,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function updateLinkedRegistrations(customerId: string, customer: any) {
  try {
    // Update registration records with new customer information
    const updateResult = await fetch(
      `${process.env.DATABASE_URL}/rpc/update_registrations_from_customer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_square_customer_id: customerId,
          p_customer_data: {
            email: customer.email_address,
            given_name: customer.given_name,
            family_name: customer.family_name,
            phone_number: customer.phone_number,
            company_name: customer.company_name,
            address: customer.address,
          },
        }),
      }
    )

    if (!updateResult.ok) {
      logger.error('Failed to update linked registrations', {
        customerId,
        error: await updateResult.text(),
      })
    } else {
      const updatedCount = await updateResult.json()
      if (updatedCount && updatedCount > 0) {
        logger.info('Updated linked registrations with customer data', {
          customerId,
          updatedCount,
        })
      }
    }
  } catch (error) {
    logger.error('Error updating linked registrations', {
      customerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function handleOrphanedRegistrations(customerId: string) {
  try {
    // Find registrations linked to this customer and handle appropriately
    const orphanResult = await fetch(
      `${process.env.DATABASE_URL}/rpc/handle_orphaned_registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_square_customer_id: customerId,
          p_action: 'unlink', // Options: 'unlink', 'soft_delete', 'archive'
        }),
      }
    )

    if (!orphanResult.ok) {
      logger.error('Failed to handle orphaned registrations', {
        customerId,
        error: await orphanResult.text(),
      })
    } else {
      const handledCount = await orphanResult.json()
      if (handledCount && handledCount > 0) {
        logger.info('Handled orphaned registrations', {
          customerId,
          handledCount,
        })
      }
    }
  } catch (error) {
    logger.error('Error handling orphaned registrations', {
      customerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Register customer webhook processor with the queue
 */
webhookQueue.registerProcessor({
  name: 'customer-webhook-processor',
  eventTypes: Object.keys(CUSTOMER_EVENT_PRIORITIES),
  process: processCustomerWebhook,
  retryCount: 3,
  timeout: 30000, // 30 seconds
})

/**
 * POST handler for customer webhooks
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authenticate webhook
    const authResult = await authenticateWebhook(request)
    if (!authResult.success) {
      logger.warn('Customer webhook authentication failed', {
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
    if (!CUSTOMER_EVENT_PRIORITIES.hasOwnProperty(eventType)) {
      logger.warn('Unknown customer webhook event type', {
        eventType,
        eventId: eventData.event_id,
      })
      return NextResponse.json(
        { success: true, message: 'Event type not supported' },
        { status: 200 }
      )
    }

    // Queue webhook for processing
    const priority = CUSTOMER_EVENT_PRIORITIES[eventType as keyof typeof CUSTOMER_EVENT_PRIORITIES]
    
    await webhookQueue.enqueue({
      id: eventData.event_id || `customer-${Date.now()}`,
      type: eventType,
      data: eventData,
      priority,
      metadata: {
        source: 'square-customers',
        receivedAt: new Date(),
        clientIp: request.headers.get('x-forwarded-for') || 'unknown',
      },
    })

    logger.info('Customer webhook queued successfully', {
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
    logger.error('Customer webhook processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}