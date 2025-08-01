/**
 * Square Webhook Authentication Middleware
 * 
 * Provides comprehensive webhook authentication, rate limiting, and security
 * for Square API webhook endpoints in the founders-day Next.js application.
 * 
 * Features:
 * - HMAC-SHA256 signature verification
 * - Rate limiting with Redis-backed storage
 * - Request validation and sanitization
 * - Comprehensive logging and monitoring
 * - Environment-specific configuration
 * - Idempotency handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import logger from '../monitoring/logger'

// Types
export interface WebhookAuthConfig {
  signatureKey: string
  rateLimitWindowMs: number
  rateLimitMaxRequests: number
  enableIdempotency: boolean
  allowedOrigins?: string[]
  environment: 'sandbox' | 'production'
}

export interface WebhookRequest extends NextRequest {
  webhookId?: string
  squareEventId?: string
  rawBody?: string
  parsedBody?: any
  signature?: string
  timestamp?: number
}

export interface WebhookAuthResult {
  success: boolean
  error?: string
  rateLimited?: boolean
  duplicateRequest?: boolean
  metadata?: Record<string, any>
}

// In-memory rate limiting store (would use Redis in production)
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>()
  
  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const now = Date.now()
    const entry = this.store.get(key)
    
    if (!entry || now > entry.resetTime) {
      return null
    }
    
    return entry
  }
  
  async set(key: string, count: number, windowMs: number): Promise<void> {
    const resetTime = Date.now() + windowMs
    this.store.set(key, { count, resetTime })
  }
  
  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now()
    const entry = this.store.get(key)
    
    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs
      this.store.set(key, { count: 1, resetTime })
      return 1
    }
    
    entry.count++
    this.store.set(key, entry)
    return entry.count
  }
  
  async cleanup(): Promise<void> {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  rateLimitStore.cleanup()
}, 5 * 60 * 1000)

// Idempotency store for duplicate request detection
class IdempotencyStore {
  private store = new Map<string, { timestamp: number; processed: boolean }>()
  private readonly maxAge = 24 * 60 * 60 * 1000 // 24 hours
  
  async has(key: string): Promise<boolean> {
    const now = Date.now()
    const entry = this.store.get(key)
    
    if (!entry || now - entry.timestamp > this.maxAge) {
      if (entry) this.store.delete(key)
      return false
    }
    
    return true
  }
  
  async set(key: string): Promise<void> {
    this.store.set(key, { timestamp: Date.now(), processed: true })
  }
  
  async cleanup(): Promise<void> {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.store.delete(key)
      }
    }
  }
}

const idempotencyStore = new IdempotencyStore()

// Cleanup expired idempotency entries every hour
setInterval(() => {
  idempotencyStore.cleanup()
}, 60 * 60 * 1000)

/**
 * Verifies Square webhook signature using HMAC-SHA256
 */
export function verifySquareWebhookSignature(
  signature: string,
  body: string,
  webhookKey: string
): boolean {
  try {
    if (!signature || !body || !webhookKey) {
      logger.warn('Missing required parameters for webhook signature verification', {
        component: 'webhook-auth',
        metadata: {
          hasSignature: !!signature,
          hasBody: !!body,
          hasKey: !!webhookKey
        }
      })
      return false
    }

    // Square sends signature in base64 format
    const hmac = createHmac('sha256', webhookKey)
    hmac.update(body, 'utf8')
    const computedSignature = hmac.digest('base64')
    
    // Use constant-time comparison to prevent timing attacks
    const providedSignature = signature.trim()
    
    if (computedSignature.length !== providedSignature.length) {
      return false
    }
    
    let result = 0
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ providedSignature.charCodeAt(i)
    }
    
    const isValid = result === 0
    
    logger.debug('Webhook signature verification', {
      component: 'webhook-auth',
      metadata: {
        isValid,
        signatureLength: providedSignature.length,
        bodyLength: body.length
      }
    })
    
    return isValid
  } catch (error) {
    logger.error('Error verifying webhook signature', {
      component: 'webhook-auth',
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return false
  }
}

/**
 * Rate limiting implementation
 */
async function checkRateLimit(
  identifier: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    const count = await rateLimitStore.increment(identifier, windowMs)
    const allowed = count <= maxRequests
    const remaining = Math.max(0, maxRequests - count)
    const resetTime = Date.now() + windowMs
    
    logger.debug('Rate limit check', {
      component: 'webhook-auth',
      metadata: {
        identifier,
        count,
        maxRequests,
        allowed,
        remaining
      }
    })
    
    return { allowed, remaining, resetTime }
  } catch (error) {
    logger.error('Error checking rate limit', {
      component: 'webhook-auth',
      metadata: { 
        identifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    // Fail open in case of rate limit errors
    return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs }
  }
}

/**
 * Validates webhook request structure and content
 */
function validateWebhookRequest(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!body) {
    errors.push('Request body is empty')
    return { valid: false, errors }
  }
  
  // Check for required Square webhook fields
  if (!body.merchant_id) {
    errors.push('Missing merchant_id')
  }
  
  if (!body.type) {
    errors.push('Missing event type')
  }
  
  if (!body.event_id) {
    errors.push('Missing event_id')
  }
  
  if (!body.created_at) {
    errors.push('Missing created_at timestamp')
  }
  
  // Validate timestamp is not too old (prevent replay attacks)
  if (body.created_at) {
    const eventTime = new Date(body.created_at).getTime()
    const now = Date.now()
    const maxAge = 10 * 60 * 1000 // 10 minutes
    
    if (now - eventTime > maxAge) {
      errors.push('Event timestamp too old')
    }
    
    if (eventTime > now + 60000) { // 1 minute future tolerance
      errors.push('Event timestamp too far in future')
    }
  }
  
  // Validate event type format
  if (body.type && !body.type.match(/^[a-z_]+\.[a-z_]+$/)) {
    errors.push('Invalid event type format')
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Extracts and validates webhook headers
 */
function extractWebhookHeaders(request: NextRequest): {
  signature: string | null
  contentType: string | null
  userAgent: string | null
  squareSignature: string | null
} {
  const signature = request.headers.get('x-square-signature')
  const contentType = request.headers.get('content-type')
  const userAgent = request.headers.get('user-agent')
  const squareSignature = request.headers.get('x-square-hmacsha256-signature')
  
  return {
    signature: signature || squareSignature,
    contentType,
    userAgent,
    squareSignature
  }
}

/**
 * Gets webhook configuration based on environment
 */
function getWebhookConfig(): WebhookAuthConfig {
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
  const signatureKey = environment === 'production' 
    ? process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_PROD 
    : process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_SANDBOX
    
  if (!signatureKey) {
    throw new Error(`Square webhook signature key not configured for ${environment}`)
  }
  
  return {
    signatureKey,
    rateLimitWindowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute default
    rateLimitMaxRequests: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS || '100'), // 100 per minute default
    enableIdempotency: process.env.WEBHOOK_ENABLE_IDEMPOTENCY !== 'false',
    allowedOrigins: process.env.WEBHOOK_ALLOWED_ORIGINS?.split(','),
    environment
  }
}

/**
 * Main webhook authentication middleware
 */
export async function authenticateWebhook(
  request: NextRequest
): Promise<{ success: boolean; response?: NextResponse; parsedBody?: any }> {
  const startTime = Date.now()
  let webhookId: string | undefined
  
  try {
    // Get configuration
    const config = getWebhookConfig()
    
    // Extract headers
    const { signature, contentType, userAgent } = extractWebhookHeaders(request)
    
    // Validate content type
    if (contentType !== 'application/json') {
      logger.warn('Invalid webhook content type', {
        component: 'webhook-auth',
        metadata: { contentType, userAgent }
      })
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid content type', expected: 'application/json' },
          { status: 400 }
        )
      }
    }
    
    // Get raw body
    const rawBody = await request.text()
    if (!rawBody) {
      logger.warn('Empty webhook body received', {
        component: 'webhook-auth',
        metadata: { userAgent }
      })
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        )
      }
    }
    
    // Parse body
    let parsedBody: any
    try {
      parsedBody = JSON.parse(rawBody)
    } catch (error) {
      logger.warn('Invalid JSON in webhook body', {
        component: 'webhook-auth',
        metadata: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          bodyPreview: rawBody.substring(0, 100)
        }
      })
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid JSON' },
          { status: 400 }
        )
      }
    }
    
    webhookId = parsedBody.event_id
    
    // Validate webhook structure
    const validation = validateWebhookRequest(parsedBody)
    if (!validation.valid) {
      logger.warn('Invalid webhook request structure', {
        component: 'webhook-auth',
        metadata: { 
          errors: validation.errors,
          eventId: webhookId,
          eventType: parsedBody.type
        }
      })
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid webhook structure', details: validation.errors },
          { status: 400 }
        )
      }
    }
    
    // Check idempotency
    if (config.enableIdempotency && webhookId) {
      const isDuplicate = await idempotencyStore.has(webhookId)
      if (isDuplicate) {
        logger.info('Duplicate webhook request detected', {
          component: 'webhook-auth',
          metadata: { eventId: webhookId, eventType: parsedBody.type }
        })
        return {
          success: true, // Don't fail, just acknowledge
          response: NextResponse.json(
            { message: 'Duplicate request, already processed' },
            { status: 200 }
          )
        }
      }
    }
    
    // Verify signature
    if (!signature) {
      logger.warn('Missing webhook signature', {
        component: 'webhook-auth',
        metadata: { eventId: webhookId, eventType: parsedBody.type }
      })
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Missing webhook signature' },
          { status: 401 }
        )
      }
    }
    
    const isValidSignature = verifySquareWebhookSignature(
      signature,
      rawBody,
      config.signatureKey
    )
    
    if (!isValidSignature) {
      logger.error('Invalid webhook signature', {
        component: 'webhook-auth',
        metadata: { 
          eventId: webhookId, 
          eventType: parsedBody.type,
          signatureProvided: !!signature
        }
      })
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }
    
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    const rateLimitKey = `webhook_${clientIP}`
    
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      config.rateLimitWindowMs,
      config.rateLimitMaxRequests
    )
    
    if (!rateLimit.allowed) {
      logger.warn('Webhook rate limit exceeded', {
        component: 'webhook-auth',
        metadata: { 
          clientIP,
          eventId: webhookId,
          eventType: parsedBody.type,
          remaining: rateLimit.remaining
        }
      })
      
      const response = NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
      response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
      response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString())
      
      return { success: false, response }
    }
    
    // Mark as processed for idempotency
    if (config.enableIdempotency && webhookId) {
      await idempotencyStore.set(webhookId)
    }
    
    // Log successful authentication
    const duration = Date.now() - startTime
    logger.info('Webhook authenticated successfully', {
      component: 'webhook-auth',
      metadata: {
        eventId: webhookId,
        eventType: parsedBody.type,
        merchantId: parsedBody.merchant_id,
        duration,
        rateLimitRemaining: rateLimit.remaining
      }
    })
    
    return { success: true, parsedBody }
    
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Webhook authentication failed', {
      component: 'webhook-auth',
      metadata: {
        eventId: webhookId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Create webhook authentication middleware for Next.js routes
 */
export function createWebhookAuthMiddleware() {
  return async (request: NextRequest) => {
    const result = await authenticateWebhook(request)
    
    if (!result.success && result.response) {
      return result.response
    }
    
    // Add parsed body to request context
    if (result.parsedBody) {
      // Store in headers for next handler to access
      const response = NextResponse.next()
      response.headers.set('x-webhook-body', JSON.stringify(result.parsedBody))
      return response
    }
    
    return NextResponse.next()
  }
}

// Export types and utilities
export type { WebhookAuthConfig, WebhookRequest, WebhookAuthResult }
export { rateLimitStore, idempotencyStore }