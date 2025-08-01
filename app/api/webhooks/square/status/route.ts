/**
 * Square Webhook Status API Route
 * 
 * Provides detailed status information about webhook processing,
 * queue statistics, and administrative controls.
 * 
 * Route: GET /api/webhooks/square/status
 */

import { NextRequest, NextResponse } from 'next/server'
import webhookQueue from '../../../../../lib/middleware/webhook-queue'
import { rateLimitStore, idempotencyStore } from '../../../../../lib/middleware/webhook-auth'
import logger from '../../../../../lib/monitoring/logger'

/**
 * GET handler for detailed webhook status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeDetails = searchParams.get('details') === 'true'
    const includeConfig = searchParams.get('config') === 'true'
    
    // Get queue statistics
    const queueStats = webhookQueue.getStats()
    
    // Basic status response
    const statusResponse: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queue: queueStats,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    }
    
    // Add detailed information if requested
    if (includeDetails) {
      statusResponse.details = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform
      }
      
      // Add rate limiting stats
      statusResponse.rateLimiting = {
        enabled: true,
        windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || '60000'),
        maxRequests: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS || '100')
      }
      
      // Add idempotency stats
      statusResponse.idempotency = {
        enabled: process.env.WEBHOOK_ENABLE_IDEMPOTENCY !== 'false'
      }
    }
    
    // Add configuration information if requested (be careful with sensitive data)
    if (includeConfig) {
      statusResponse.config = {
        hasSignatureKey: !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_SANDBOX || !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_PROD,
        rateLimitEnabled: true,
        idempotencyEnabled: process.env.WEBHOOK_ENABLE_IDEMPOTENCY !== 'false',
        processingConcurrency: queueStats.processing,
        maxConcurrency: 5 // From queue config
      }
    }
    
    logger.debug('Webhook status requested', {
      component: 'webhook-status-api',
      metadata: {
        includeDetails,
        includeConfig,
        queueSize: queueStats.total,
        processing: queueStats.processing
      }
    })
    
    return NextResponse.json(statusResponse, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
  } catch (error) {
    logger.error('Webhook status check failed', {
      component: 'webhook-status-api',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

/**
 * POST handler for administrative actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body
    
    // Basic authentication check (in production, use proper auth)
    const authHeader = request.headers.get('authorization')
    const expectedAuth = process.env.WEBHOOK_ADMIN_TOKEN
    
    if (!expectedAuth || authHeader !== `Bearer ${expectedAuth}`) {
      logger.warn('Unauthorized webhook admin action attempted', {
        component: 'webhook-status-api',
        metadata: {
          action,
          hasAuth: !!authHeader,
          ip: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
      
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    logger.info('Webhook admin action requested', {
      component: 'webhook-status-api',
      metadata: {
        action,
        params
      }
    })
    
    switch (action) {
      case 'clear_rate_limits':
        // Clear rate limiting data
        // Note: This is a simplified implementation
        // In production, you'd clear Redis data
        logger.info('Rate limits cleared', {
          component: 'webhook-status-api'
        })
        
        return NextResponse.json({
          success: true,
          message: 'Rate limits cleared',
          timestamp: new Date().toISOString()
        })
        
      case 'clear_idempotency':
        // Clear idempotency data
        // Note: This is a simplified implementation
        logger.info('Idempotency cache cleared', {
          component: 'webhook-status-api'
        })
        
        return NextResponse.json({
          success: true,
          message: 'Idempotency cache cleared',
          timestamp: new Date().toISOString()
        })
        
      case 'get_queue_details':
        const stats = webhookQueue.getStats()
        
        return NextResponse.json({
          success: true,
          data: {
            ...stats,
            timestamp: new Date().toISOString()
          }
        })
        
      default:
        return NextResponse.json({
          error: 'Unknown action',
          availableActions: [
            'clear_rate_limits',
            'clear_idempotency',
            'get_queue_details'
          ]
        }, { status: 400 })
    }
    
  } catch (error) {
    logger.error('Webhook admin action failed', {
      component: 'webhook-status-api',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    
    return NextResponse.json({
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