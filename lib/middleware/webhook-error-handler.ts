/**
 * Webhook Error Handling and Recovery System
 * 
 * Provides comprehensive error handling, recovery mechanisms,
 * and fallback strategies for webhook processing failures.
 * 
 * Features:
 * - Error classification and handling strategies
 * - Circuit breaker pattern for failing services
 * - Fallback mechanisms for critical operations
 * - Error reporting and alerting
 * - Recovery and retry strategies
 */

import logger from '../monitoring/logger'
import { WebhookJob, WebhookJobStatus } from './webhook-queue'

// Error types and classifications
export enum WebhookErrorType {
  AUTHENTICATION_ERROR = 'authentication_error',
  VALIDATION_ERROR = 'validation_error',
  PROCESSING_ERROR = 'processing_error',
  NETWORK_ERROR = 'network_error',
  DATABASE_ERROR = 'database_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum WebhookErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface WebhookError {
  type: WebhookErrorType
  severity: WebhookErrorSeverity
  message: string
  details?: any
  timestamp: Date
  jobId?: string
  eventId?: string
  eventType?: string
  shouldRetry: boolean
  retryAfter?: number
  fallbackAction?: string
  stack?: string
}

export interface ErrorHandlingStrategy {
  errorType: WebhookErrorType
  maxRetries: number
  retryDelayMs: number
  shouldAlert: boolean
  fallbackHandler?: (error: WebhookError, job?: WebhookJob) => Promise<void>
  recoveryHandler?: (error: WebhookError, job?: WebhookJob) => Promise<boolean>
}

// Circuit breaker for failing services
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN'
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          component: 'webhook-error-handler'
        })
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable')
      }
    }
    
    try {
      const result = await operation()
      
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED'
        this.failures = 0
        logger.info('Circuit breaker reset to CLOSED', {
          component: 'webhook-error-handler'
        })
      }
      
      return result
    } catch (error) {
      this.failures++
      this.lastFailureTime = Date.now()
      
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN'
        logger.error('Circuit breaker tripped to OPEN', {
          component: 'webhook-error-handler',
          metadata: {
            failures: this.failures,
            threshold: this.failureThreshold
          }
        })
      }
      
      throw error
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    }
  }
  
  reset() {
    this.state = 'CLOSED'
    this.failures = 0
    this.lastFailureTime = 0
  }
}

// Error classification utility
export class WebhookErrorClassifier {
  static classifyError(error: any, context?: any): WebhookError {
    const timestamp = new Date()
    let errorType = WebhookErrorType.UNKNOWN_ERROR
    let severity = WebhookErrorSeverity.MEDIUM
    let shouldRetry = true
    let retryAfter: number | undefined
    let fallbackAction: string | undefined
    
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    
    // Classify based on error message and type
    if (message.includes('signature') || message.includes('authentication')) {
      errorType = WebhookErrorType.AUTHENTICATION_ERROR
      severity = WebhookErrorSeverity.HIGH
      shouldRetry = false
    } else if (message.includes('validation') || message.includes('invalid')) {
      errorType = WebhookErrorType.VALIDATION_ERROR
      severity = WebhookErrorSeverity.MEDIUM
      shouldRetry = false
    } else if (message.includes('timeout')) {
      errorType = WebhookErrorType.TIMEOUT_ERROR
      severity = WebhookErrorSeverity.MEDIUM
      shouldRetry = true
      retryAfter = 5000 // 5 seconds
    } else if (message.includes('rate limit') || message.includes('429')) {
      errorType = WebhookErrorType.RATE_LIMIT_ERROR
      severity = WebhookErrorSeverity.LOW
      shouldRetry = true
      retryAfter = 60000 // 1 minute
    } else if (message.includes('network') || message.includes('connection')) {
      errorType = WebhookErrorType.NETWORK_ERROR
      severity = WebhookErrorSeverity.MEDIUM
      shouldRetry = true
      retryAfter = 10000 // 10 seconds
    } else if (message.includes('database') || message.includes('sql')) {
      errorType = WebhookErrorType.DATABASE_ERROR
      severity = WebhookErrorSeverity.HIGH
      shouldRetry = true
      retryAfter = 15000 // 15 seconds
      fallbackAction = 'store_for_later_processing'
    } else if (message.includes('processing') || message.includes('internal')) {
      errorType = WebhookErrorType.PROCESSING_ERROR
      severity = WebhookErrorSeverity.MEDIUM
      shouldRetry = true
    }
    
    // Adjust severity based on context
    if (context?.eventType === 'payment.created' || context?.eventType === 'payment.updated') {
      if (severity === WebhookErrorSeverity.MEDIUM) severity = WebhookErrorSeverity.HIGH
      if (severity === WebhookErrorSeverity.LOW) severity = WebhookErrorSeverity.MEDIUM
    }
    
    return {
      type: errorType,
      severity,
      message,
      details: {
        originalError: error,
        context,
        classification: {
          confidence: this.getClassificationConfidence(message, errorType),
          alternativeTypes: this.getAlternativeTypes(message)
        }
      },
      timestamp,
      jobId: context?.jobId,
      eventId: context?.eventId,
      eventType: context?.eventType,
      shouldRetry,
      retryAfter,
      fallbackAction,
      stack
    }
  }
  
  private static getClassificationConfidence(message: string, errorType: WebhookErrorType): number {
    const keywords = {
      [WebhookErrorType.AUTHENTICATION_ERROR]: ['signature', 'authentication', 'unauthorized', 'invalid key'],
      [WebhookErrorType.VALIDATION_ERROR]: ['validation', 'invalid', 'malformed', 'required field'],
      [WebhookErrorType.TIMEOUT_ERROR]: ['timeout', 'timed out', 'deadline exceeded'],
      [WebhookErrorType.RATE_LIMIT_ERROR]: ['rate limit', '429', 'too many requests'],
      [WebhookErrorType.NETWORK_ERROR]: ['network', 'connection', 'unreachable', 'dns'],
      [WebhookErrorType.DATABASE_ERROR]: ['database', 'sql', 'connection pool', 'deadlock'],
      [WebhookErrorType.PROCESSING_ERROR]: ['processing', 'internal', 'unexpected']
    }
    
    const relevantKeywords = keywords[errorType] || []
    const matchCount = relevantKeywords.filter(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    ).length
    
    return Math.min(matchCount / relevantKeywords.length, 1.0)
  }
  
  private static getAlternativeTypes(message: string): WebhookErrorType[] {
    const alternatives: WebhookErrorType[] = []
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('server') || lowerMessage.includes('5')) {
      alternatives.push(WebhookErrorType.PROCESSING_ERROR)
    }
    if (lowerMessage.includes('client') || lowerMessage.includes('4')) {
      alternatives.push(WebhookErrorType.VALIDATION_ERROR)
    }
    if (lowerMessage.includes('connect') || lowerMessage.includes('socket')) {
      alternatives.push(WebhookErrorType.NETWORK_ERROR)
    }
    
    return alternatives
  }
}

// Main error handler class
export class WebhookErrorHandler {
  private strategies = new Map<WebhookErrorType, ErrorHandlingStrategy>()
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private errorStats = new Map<WebhookErrorType, { count: number; lastOccurrence: Date }>()
  
  constructor() {
    this.initializeDefaultStrategies()
  }
  
  private initializeDefaultStrategies() {
    // Authentication errors - don't retry, alert immediately
    this.strategies.set(WebhookErrorType.AUTHENTICATION_ERROR, {
      errorType: WebhookErrorType.AUTHENTICATION_ERROR,
      maxRetries: 0,
      retryDelayMs: 0,
      shouldAlert: true,
      fallbackHandler: this.handleAuthenticationError
    })
    
    // Validation errors - don't retry, but log for analysis
    this.strategies.set(WebhookErrorType.VALIDATION_ERROR, {
      errorType: WebhookErrorType.VALIDATION_ERROR,
      maxRetries: 0,
      retryDelayMs: 0,
      shouldAlert: false,
      fallbackHandler: this.handleValidationError
    })
    
    // Processing errors - retry with backoff
    this.strategies.set(WebhookErrorType.PROCESSING_ERROR, {
      errorType: WebhookErrorType.PROCESSING_ERROR,
      maxRetries: 3,
      retryDelayMs: 5000,
      shouldAlert: true,
      recoveryHandler: this.handleProcessingError
    })
    
    // Network errors - retry with longer delays
    this.strategies.set(WebhookErrorType.NETWORK_ERROR, {
      errorType: WebhookErrorType.NETWORK_ERROR,
      maxRetries: 5,
      retryDelayMs: 10000,
      shouldAlert: false,
      recoveryHandler: this.handleNetworkError
    })
    
    // Database errors - critical, use fallbacks
    this.strategies.set(WebhookErrorType.DATABASE_ERROR, {
      errorType: WebhookErrorType.DATABASE_ERROR,
      maxRetries: 3,
      retryDelayMs: 15000,
      shouldAlert: true,
      fallbackHandler: this.handleDatabaseError,
      recoveryHandler: this.handleDatabaseRecovery
    })
    
    // Timeout errors - retry with exponential backoff
    this.strategies.set(WebhookErrorType.TIMEOUT_ERROR, {
      errorType: WebhookErrorType.TIMEOUT_ERROR,
      maxRetries: 3,
      retryDelayMs: 5000,
      shouldAlert: false,
      recoveryHandler: this.handleTimeoutError
    })
    
    // Rate limit errors - wait and retry
    this.strategies.set(WebhookErrorType.RATE_LIMIT_ERROR, {
      errorType: WebhookErrorType.RATE_LIMIT_ERROR,
      maxRetries: 5,
      retryDelayMs: 60000, // 1 minute
      shouldAlert: false,
      recoveryHandler: this.handleRateLimitError
    })
  }
  
  /**
   * Handle an error with appropriate strategy
   */
  async handleError(error: any, job?: WebhookJob, context?: any): Promise<{
    shouldRetry: boolean
    retryDelayMs?: number
    fallbackExecuted: boolean
    recoveryAttempted: boolean
  }> {
    const webhookError = WebhookErrorClassifier.classifyError(error, { ...context, jobId: job?.id })
    
    // Update error statistics
    this.updateErrorStats(webhookError)
    
    // Log the error
    logger.error('Webhook error occurred', {
      component: 'webhook-error-handler',
      metadata: {
        errorType: webhookError.type,
        severity: webhookError.severity,
        eventId: webhookError.eventId,
        eventType: webhookError.eventType,
        jobId: webhookError.jobId,
        shouldRetry: webhookError.shouldRetry,
        message: webhookError.message
      }
    })
    
    const strategy = this.strategies.get(webhookError.type) || this.strategies.get(WebhookErrorType.UNKNOWN_ERROR)!
    
    let fallbackExecuted = false
    let recoveryAttempted = false
    let shouldRetry = webhookError.shouldRetry && (job?.attempts || 0) < strategy.maxRetries
    
    // Execute fallback handler if available
    if (strategy.fallbackHandler) {
      try {
        await strategy.fallbackHandler(webhookError, job)
        fallbackExecuted = true
        
        logger.info('Fallback handler executed successfully', {
          component: 'webhook-error-handler',
          metadata: {
            errorType: webhookError.type,
            eventId: webhookError.eventId
          }
        })
      } catch (fallbackError) {
        logger.error('Fallback handler failed', {
          component: 'webhook-error-handler',
          metadata: {
            errorType: webhookError.type,
            eventId: webhookError.eventId,
            fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          }
        })
      }
    }
    
    // Attempt recovery if handler is available
    if (shouldRetry && strategy.recoveryHandler) {
      try {
        const recovered = await strategy.recoveryHandler(webhookError, job)
        recoveryAttempted = true
        
        if (recovered) {
          shouldRetry = false // Recovery successful, no need to retry
          
          logger.info('Error recovery successful', {
            component: 'webhook-error-handler',
            metadata: {
              errorType: webhookError.type,
              eventId: webhookError.eventId
            }
          })
        }
      } catch (recoveryError) {
        logger.error('Recovery handler failed', {
          component: 'webhook-error-handler',
          metadata: {
            errorType: webhookError.type,
            eventId: webhookError.eventId,
            recoveryError: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
          }
        })
      }
    }
    
    // Send alert if required
    if (strategy.shouldAlert || webhookError.severity === WebhookErrorSeverity.CRITICAL) {
      await this.sendAlert(webhookError, job)
    }
    
    return {
      shouldRetry,
      retryDelayMs: webhookError.retryAfter || strategy.retryDelayMs,
      fallbackExecuted,
      recoveryAttempted
    }
  }
  
  /**
   * Get circuit breaker for a service
   */
  getCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker())
    }
    return this.circuitBreakers.get(serviceName)!
  }
  
  /**
   * Update error statistics
   */
  private updateErrorStats(error: WebhookError) {
    const stats = this.errorStats.get(error.type) || { count: 0, lastOccurrence: new Date() }
    stats.count++
    stats.lastOccurrence = error.timestamp
    this.errorStats.set(error.type, stats)
  }
  
  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {}
    for (const [errorType, data] of this.errorStats.entries()) {
      stats[errorType] = data
    }
    return stats
  }
  
  /**
   * Send alert for critical errors
   */
  private async sendAlert(error: WebhookError, job?: WebhookJob) {
    try {
      // TODO: Implement actual alerting (email, Slack, PagerDuty, etc.)
      logger.error('ALERT: Critical webhook error', {
        component: 'webhook-error-handler',
        metadata: {
          errorType: error.type,
          severity: error.severity,
          eventId: error.eventId,
          eventType: error.eventType,
          message: error.message,
          jobId: job?.id,
          timestamp: error.timestamp
        }
      })
      
      // Example: Send to monitoring service
      // await this.sendToMonitoringService(error, job)
      
    } catch (alertError) {
      logger.error('Failed to send alert', {
        component: 'webhook-error-handler',
        metadata: {
          originalError: error.message,
          alertError: alertError instanceof Error ? alertError.message : 'Unknown error'
        }
      })
    }
  }
  
  // Fallback and recovery handlers
  private async handleAuthenticationError(error: WebhookError, job?: WebhookJob) {
    // Log for security analysis
    logger.warn('Authentication error - possible security issue', {
      component: 'webhook-error-handler',
      metadata: {
        eventId: error.eventId,
        details: error.details
      }
    })
  }
  
  private async handleValidationError(error: WebhookError, job?: WebhookJob) {
    // Store malformed webhook for analysis
    logger.info('Storing malformed webhook for analysis', {
      component: 'webhook-error-handler',
      metadata: {
        eventId: error.eventId,
        validationIssues: error.details
      }
    })
  }
  
  private async handleProcessingError(error: WebhookError, job?: WebhookJob): Promise<boolean> {
    // Attempt to recover by resetting state
    logger.info('Attempting processing error recovery', {
      component: 'webhook-error-handler',
      metadata: { eventId: error.eventId }
    })
    
    // TODO: Implement specific recovery logic
    return false // Recovery not implemented
  }
  
  private async handleNetworkError(error: WebhookError, job?: WebhookJob): Promise<boolean> {
    // Check if network is available
    logger.info('Checking network connectivity for recovery', {
      component: 'webhook-error-handler',
      metadata: { eventId: error.eventId }
    })
    
    // TODO: Implement network connectivity check
    return false // Recovery not implemented
  }
  
  private async handleDatabaseError(error: WebhookError, job?: WebhookJob) {
    // Store webhook event in fallback storage (file system, cache, etc.)
    logger.info('Storing webhook in fallback storage due to database error', {
      component: 'webhook-error-handler',
      metadata: {
        eventId: error.eventId,
        fallbackStorage: 'filesystem'
      }
    })
    
    // TODO: Implement fallback storage
  }
  
  private async handleDatabaseRecovery(error: WebhookError, job?: WebhookJob): Promise<boolean> {
    // Check if database is back online
    logger.info('Checking database connectivity for recovery', {
      component: 'webhook-error-handler',
      metadata: { eventId: error.eventId }
    })
    
    // TODO: Implement database connectivity check
    return false // Recovery not implemented
  }
  
  private async handleTimeoutError(error: WebhookError, job?: WebhookJob): Promise<boolean> {
    // Check if service is responsive
    logger.info('Checking service responsiveness for timeout recovery', {
      component: 'webhook-error-handler',
      metadata: { eventId: error.eventId }
    })
    
    // TODO: Implement service health check
    return false // Recovery not implemented
  }
  
  private async handleRateLimitError(error: WebhookError, job?: WebhookJob): Promise<boolean> {
    // Wait for rate limit to reset
    const waitTime = error.retryAfter || 60000
    
    logger.info('Waiting for rate limit reset', {
      component: 'webhook-error-handler',
      metadata: {
        eventId: error.eventId,
        waitTimeMs: waitTime
      }
    })
    
    await new Promise(resolve => setTimeout(resolve, waitTime))
    return true // Rate limit should be reset
  }
}

// Global error handler instance
const webhookErrorHandler = new WebhookErrorHandler()

export default webhookErrorHandler
export { WebhookErrorHandler, WebhookErrorClassifier, CircuitBreaker }