/**
 * Square Webhook API Route
 * 
 * Main endpoint for receiving Square webhook notifications.
 * Handles authentication, validation, and queuing of webhook events.
 * 
 * Route: POST /api/webhooks/square
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateWebhook } from '../../../../lib/middleware/webhook-auth'
import webhookQueue from '../../../../lib/middleware/webhook-queue'
import { webhookProcessors } from '../../../../lib/services/webhook-processor'
import { WebhookPriority } from '../../../../lib/middleware/webhook-queue'
import logger from '../../../../lib/monitoring/logger'

// Register all webhook processors with the queue
Object.values(webhookProcessors).forEach(processor => {
  webhookQueue.registerProcessor(processor)
})

/**
 * POST handler for Square webhooks
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let eventId: string | undefined
  let eventType: string | undefined
  
  try {
    logger.info('Received Square webhook', {
      component: 'webhook-api',
      metadata: {
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        contentType: request.headers.get('content-type')
      }
    })
    
    // Authenticate and validate webhook
    const authResult = await authenticateWebhook(request)
    
    if (!authResult.success) {
      // Authentication middleware already logged the error
      return authResult.response || NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }
    
    if (!authResult.parsedBody) {
      logger.error('No parsed body from authentication', {
        component: 'webhook-api'
      })
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    const webhookEvent = authResult.parsedBody
    eventId = webhookEvent.event_id
    eventType = webhookEvent.type
    
    logger.info('Webhook authenticated successfully', {
      component: 'webhook-api',
      metadata: {
        eventId,
        eventType,
        merchantId: webhookEvent.merchant_id
      }
    })
    
    // Determine event priority
    let priority = WebhookPriority.NORMAL
    
    // Critical events that affect user experience
    if (eventType.startsWith('payment.')) {
      priority = WebhookPriority.HIGH
    } else if (eventType.includes('refund') || eventType.includes('dispute')) {
      priority = WebhookPriority.CRITICAL
    } else if (eventType.startsWith('customer.')) {
      priority = WebhookPriority.NORMAL
    } else {
      priority = WebhookPriority.LOW
    }
    
    // Queue the webhook for processing
    const jobId = await webhookQueue.enqueue(
      eventId,
      eventType,
      webhookEvent,
      priority
    )
    
    const processingTime = Date.now() - startTime
    
    logger.info('Webhook queued successfully', {
      component: 'webhook-api',
      metadata: {
        eventId,
        eventType,
        jobId,
        priority,
        processingTime
      }
    })
    
    // Return success response to Square
    return NextResponse.json({
      message: 'Webhook received and queued for processing',
      eventId,
      jobId,
      processingTime
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Event-ID': eventId,
        'X-Job-ID': jobId
      }
    })
    
  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Webhook processing failed', {
      component: 'webhook-api',
      metadata: {
        eventId,
        eventType,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    })
    
    // Return error response
    return NextResponse.json({
      error: 'Internal server error',
      eventId,
      processingTime
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Event-ID': eventId || 'unknown'
      }
    })
  }
}

/**
 * GET handler for webhook status/health check
 */
export async function GET(request: NextRequest) {
  try {
    const stats = webhookQueue.getStats()
    
    return NextResponse.json({
      status: 'healthy',
      queue: {
        ...stats,
        isProcessing: true
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: '1.0.0'
    })
    
  } catch (error) {
    logger.error('Webhook health check failed', {
      component: 'webhook-api',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Handle unsupported methods
 */
export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}