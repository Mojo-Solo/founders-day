/**
 * Webhook Processing Queue System
 * 
 * Provides reliable asynchronous processing of Square webhooks with:
 * - Queue-based processing with retry logic
 * - Dead letter queue for failed messages
 * - Priority handling for critical events
 * - Comprehensive error handling and logging
 * - Database persistence for reliability
 */

import logger from '../monitoring/logger'

// Types
export interface WebhookJob {
  id: string
  eventId: string
  eventType: string
  payload: any
  priority: WebhookPriority
  attempts: number
  maxAttempts: number
  createdAt: Date
  scheduledAt: Date
  lastAttemptAt?: Date
  lastError?: string
  status: WebhookJobStatus
  processingTime?: number
  metadata?: Record<string, any>
}

export enum WebhookPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum WebhookJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter'
}

export interface WebhookProcessor {
  eventType: string
  handler: (payload: any, job: WebhookJob) => Promise<WebhookProcessResult>
  priority?: WebhookPriority
  maxAttempts?: number
  retryDelayMs?: number
}

export interface WebhookProcessResult {
  success: boolean
  error?: string
  metadata?: Record<string, any>
  shouldRetry?: boolean
}

export interface QueueConfig {
  maxConcurrency: number
  defaultMaxAttempts: number
  defaultRetryDelayMs: number
  processingTimeoutMs: number
  cleanupIntervalMs: number
  deadLetterRetentionMs: number
}

// In-memory queue implementation (would use Redis/Bull in production)
class InMemoryWebhookQueue {
  private jobs = new Map<string, WebhookJob>()
  private processors = new Map<string, WebhookProcessor>()
  private processing = new Set<string>()
  private config: QueueConfig
  private isProcessing = false
  private processingInterval?: NodeJS.Timeout
  private cleanupInterval?: NodeJS.Timeout
  
  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency || 5,
      defaultMaxAttempts: config.defaultMaxAttempts || 3,
      defaultRetryDelayMs: config.defaultRetryDelayMs || 5000,
      processingTimeoutMs: config.processingTimeoutMs || 30000,
      cleanupIntervalMs: config.cleanupIntervalMs || 60000,
      deadLetterRetentionMs: config.deadLetterRetentionMs || 7 * 24 * 60 * 60 * 1000 // 7 days
    }
    
    this.startProcessing()
    this.startCleanup()
  }
  
  /**
   * Register a webhook processor for a specific event type
   */
  registerProcessor(processor: WebhookProcessor): void {
    this.processors.set(processor.eventType, processor)
    
    logger.info('Webhook processor registered', {
      component: 'webhook-queue',
      metadata: {
        eventType: processor.eventType,
        priority: processor.priority || WebhookPriority.NORMAL,
        maxAttempts: processor.maxAttempts || this.config.defaultMaxAttempts
      }
    })
  }
  
  /**
   * Add a webhook job to the queue
   */
  async enqueue(eventId: string, eventType: string, payload: any, priority: WebhookPriority = WebhookPriority.NORMAL): Promise<string> {
    const processor = this.processors.get(eventType)
    const jobId = `${eventType}_${eventId}_${Date.now()}`
    
    const job: WebhookJob = {
      id: jobId,
      eventId,
      eventType,
      payload,
      priority: processor?.priority || priority,
      attempts: 0,
      maxAttempts: processor?.maxAttempts || this.config.defaultMaxAttempts,
      createdAt: new Date(),
      scheduledAt: new Date(),
      status: WebhookJobStatus.PENDING,
      metadata: {
        userAgent: payload.user_agent,
        merchantId: payload.merchant_id,
        locationId: payload.location_id
      }
    }
    
    this.jobs.set(jobId, job)
    
    logger.info('Webhook job enqueued', {
      component: 'webhook-queue',
      metadata: {
        jobId,
        eventId,
        eventType,
        priority,
        queueSize: this.jobs.size
      }
    })
    
    return jobId
  }
  
  /**
   * Get the next job to process based on priority and schedule
   */
  private getNextJob(): WebhookJob | null {
    const now = new Date()
    const availableJobs = Array.from(this.jobs.values())
      .filter(job => 
        job.status === WebhookJobStatus.PENDING &&
        job.scheduledAt <= now &&
        !this.processing.has(job.id)
      )
      .sort((a, b) => {
        // Sort by priority first, then by scheduled time
        if (a.priority !== b.priority) {
          return b.priority - a.priority // Higher priority first
        }
        return a.scheduledAt.getTime() - b.scheduledAt.getTime() // Earlier first
      })
    
    return availableJobs[0] || null
  }
  
  /**
   * Process a single webhook job
   */
  private async processJob(job: WebhookJob): Promise<void> {
    const startTime = Date.now()
    this.processing.add(job.id)
    
    // Update job status
    job.status = WebhookJobStatus.PROCESSING
    job.attempts++
    job.lastAttemptAt = new Date()
    
    logger.info('Processing webhook job', {
      component: 'webhook-queue',
      metadata: {
        jobId: job.id,
        eventId: job.eventId,
        eventType: job.eventType,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts
      }
    })
    
    try {
      const processor = this.processors.get(job.eventType)
      
      if (!processor) {
        throw new Error(`No processor registered for event type: ${job.eventType}`)
      }
      
      // Set processing timeout
      const timeoutPromise = new Promise<WebhookProcessResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Processing timeout after ${this.config.processingTimeoutMs}ms`))
        }, this.config.processingTimeoutMs)
      })
      
      // Process the job
      const processingPromise = processor.handler(job.payload, job)
      const result = await Promise.race([processingPromise, timeoutPromise])
      
      job.processingTime = Date.now() - startTime
      
      if (result.success) {
        job.status = WebhookJobStatus.COMPLETED
        job.metadata = { ...job.metadata, ...result.metadata }
        
        logger.info('Webhook job completed successfully', {
          component: 'webhook-queue',
          metadata: {
            jobId: job.id,
            eventId: job.eventId,
            eventType: job.eventType,
            processingTime: job.processingTime,
            attempts: job.attempts
          }
        })
        
        // Store completion record in database
        await this.storeJobResult(job, result)
        
      } else {
        throw new Error(result.error || 'Processing failed')
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      job.lastError = errorMessage
      job.processingTime = Date.now() - startTime
      
      logger.error('Webhook job processing failed', {
        component: 'webhook-queue',
        metadata: {
          jobId: job.id,
          eventId: job.eventId,
          eventType: job.eventType,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          error: errorMessage,
          processingTime: job.processingTime
        }
      })
      
      // Determine if we should retry
      const shouldRetry = job.attempts < job.maxAttempts
      
      if (shouldRetry) {
        // Schedule retry with exponential backoff
        const retryDelayMs = this.calculateRetryDelay(job.attempts)
        job.scheduledAt = new Date(Date.now() + retryDelayMs)
        job.status = WebhookJobStatus.PENDING
        
        logger.info('Webhook job scheduled for retry', {
          component: 'webhook-queue',
          metadata: {
            jobId: job.id,
            eventId: job.eventId,
            retryAttempt: job.attempts + 1,
            retryDelayMs,
            scheduledAt: job.scheduledAt
          }
        })
        
      } else {
        // Move to dead letter queue
        job.status = WebhookJobStatus.DEAD_LETTER
        
        logger.error('Webhook job moved to dead letter queue', {
          component: 'webhook-queue',
          metadata: {
            jobId: job.id,
            eventId: job.eventId,
            eventType: job.eventType,
            finalError: errorMessage,
            totalAttempts: job.attempts
          }
        })
        
        // Store dead letter record
        await this.storeDeadLetterJob(job)
      }
    } finally {
      this.processing.delete(job.id)
    }
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempts: number): number {
    const baseDelay = this.config.defaultRetryDelayMs
    const maxDelay = 5 * 60 * 1000 // 5 minutes max
    
    // Exponential backoff: delay = baseDelay * (2 ^ (attempts - 1))
    const delay = baseDelay * Math.pow(2, attempts - 1)
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay
    
    return Math.min(delay + jitter, maxDelay)
  }
  
  /**
   * Start the main processing loop
   */
  private startProcessing(): void {
    if (this.isProcessing) return
    
    this.isProcessing = true
    
    const processLoop = async () => {
      try {
        // Process jobs up to max concurrency
        while (this.processing.size < this.config.maxConcurrency) {
          const job = this.getNextJob()
          if (!job) break
          
          // Process job asynchronously
          this.processJob(job).catch(error => {
            logger.error('Unexpected error in job processing', {
              component: 'webhook-queue',
              metadata: {
                jobId: job.id,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            })
          })
        }
      } catch (error) {
        logger.error('Error in processing loop', {
          component: 'webhook-queue',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    }
    
    // Run processing loop every second
    this.processingInterval = setInterval(processLoop, 1000)
    
    logger.info('Webhook queue processing started', {
      component: 'webhook-queue',
      metadata: {
        maxConcurrency: this.config.maxConcurrency,
        defaultRetryDelayMs: this.config.defaultRetryDelayMs
      }
    })
  }
  
  /**
   * Start cleanup of old jobs
   */
  private startCleanup(): void {
    const cleanup = async () => {
      try {
        const now = Date.now()
        let removedCount = 0
        
        for (const [jobId, job] of this.jobs.entries()) {
          const jobAge = now - job.createdAt.getTime()
          
          // Remove completed jobs after 1 hour
          if (job.status === WebhookJobStatus.COMPLETED && jobAge > 60 * 60 * 1000) {
            this.jobs.delete(jobId)
            removedCount++
          }
          
          // Remove dead letter jobs after retention period
          if (job.status === WebhookJobStatus.DEAD_LETTER && jobAge > this.config.deadLetterRetentionMs) {
            this.jobs.delete(jobId)
            removedCount++
          }
        }
        
        if (removedCount > 0) {
          logger.info('Webhook queue cleanup completed', {
            component: 'webhook-queue',
            metadata: {
              removedJobs: removedCount,
              remainingJobs: this.jobs.size
            }
          })
        }
      } catch (error) {
        logger.error('Error during queue cleanup', {
          component: 'webhook-queue',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    }
    
    this.cleanupInterval = setInterval(cleanup, this.config.cleanupIntervalMs)
  }
  
  /**
   * Store job result in database (placeholder - implement with your database)
   */
  private async storeJobResult(job: WebhookJob, result: WebhookProcessResult): Promise<void> {
    try {
      // TODO: Implement database storage
      // Example: await db.square_webhooks.update(job.eventId, { 
      //   processing_status: 'PROCESSED',
      //   processing_result: result.metadata 
      // })
      
      logger.debug('Job result stored', {
        component: 'webhook-queue',
        metadata: {
          jobId: job.id,
          eventId: job.eventId,
          success: result.success
        }
      })
    } catch (error) {
      logger.error('Failed to store job result', {
        component: 'webhook-queue',
        metadata: {
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  }
  
  /**
   * Store dead letter job for later analysis
   */
  private async storeDeadLetterJob(job: WebhookJob): Promise<void> {
    try {
      // TODO: Implement database storage for dead letter jobs
      // Example: await db.webhook_dead_letters.create({
      //   event_id: job.eventId,
      //   event_type: job.eventType,
      //   payload: job.payload,
      //   final_error: job.lastError,
      //   total_attempts: job.attempts
      // })
      
      logger.debug('Dead letter job stored', {
        component: 'webhook-queue',
        metadata: {
          jobId: job.id,
          eventId: job.eventId,
          eventType: job.eventType
        }
      })
    } catch (error) {
      logger.error('Failed to store dead letter job', {
        component: 'webhook-queue',
        metadata: {
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  }
  
  /**
   * Get queue statistics
   */
  getStats(): {
    total: number
    byStatus: Record<WebhookJobStatus, number>
    byEventType: Record<string, number>
    processing: number
    avgProcessingTime: number
  } {
    const jobs = Array.from(this.jobs.values())
    const stats = {
      total: jobs.length,
      byStatus: {
        [WebhookJobStatus.PENDING]: 0,
        [WebhookJobStatus.PROCESSING]: 0,
        [WebhookJobStatus.COMPLETED]: 0,
        [WebhookJobStatus.FAILED]: 0,
        [WebhookJobStatus.DEAD_LETTER]: 0
      },
      byEventType: {} as Record<string, number>,
      processing: this.processing.size,
      avgProcessingTime: 0
    }
    
    let totalProcessingTime = 0
    let processedJobs = 0
    
    for (const job of jobs) {
      stats.byStatus[job.status]++
      stats.byEventType[job.eventType] = (stats.byEventType[job.eventType] || 0) + 1
      
      if (job.processingTime) {
        totalProcessingTime += job.processingTime
        processedJobs++
      }
    }
    
    stats.avgProcessingTime = processedJobs > 0 ? totalProcessingTime / processedJobs : 0
    
    return stats
  }
  
  /**
   * Shutdown the queue gracefully
   */
  async shutdown(): Promise<void> {
    this.isProcessing = false
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    
    // Wait for current jobs to complete
    const maxWaitTime = 30000 // 30 seconds
    const startTime = Date.now()
    
    while (this.processing.size > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    logger.info('Webhook queue shutdown completed', {
      component: 'webhook-queue',
      metadata: {
        remainingJobs: this.processing.size,
        totalJobs: this.jobs.size
      }
    })
  }
}

// Global queue instance
const webhookQueue = new InMemoryWebhookQueue()

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down webhook queue...')
  await webhookQueue.shutdown()
})

process.on('SIGINT', async () => {
  logger.info('Shutting down webhook queue...')
  await webhookQueue.shutdown()
})

export default webhookQueue
export { InMemoryWebhookQueue, WebhookJob, WebhookProcessor, WebhookProcessResult, WebhookPriority, WebhookJobStatus }