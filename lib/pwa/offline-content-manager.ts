/**
 * Offline Content Manager
 * 
 * Manages offline content storage and retrieval for PWA functionality:
 * - Critical event data storage
 * - Schedule and speaker information caching
 * - Form submission queuing
 * - Content synchronization
 * - Offline fallback data
 */

import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

interface OfflineContent {
  id: string
  type: 'schedule' | 'speakers' | 'content' | 'form-submission' | 'static'
  data: any
  timestamp: number
  expiry?: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  syncStatus: 'pending' | 'synced' | 'failed'
  retryCount: number
}

interface OfflineConfig {
  dbName: string
  dbVersion: number
  maxStorageSize: number // in MB
  syncRetryLimit: number
  defaultExpiry: number // in milliseconds
  enableCompression: boolean
}

interface StorageQuota {
  used: number
  available: number
  total: number
  percentage: number
}

class OfflineContentManager {
  private config: OfflineConfig
  private db: IDBDatabase | null = null
  private isInitialized = false
  private syncQueue: Set<string> = new Set()

  constructor(config?: Partial<OfflineConfig>) {
    this.config = {
      dbName: 'FoundersDayOffline',
      dbVersion: 2,
      maxStorageSize: 50, // 50MB
      syncRetryLimit: 3,
      defaultExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
      enableCompression: true,
      ...config
    }
  }

  /**
   * Initialize the offline content manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Offline Content Manager already initialized', {
        component: 'OfflineContentManager'
      })
      return
    }

    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      logger.warn('IndexedDB not available', {
        component: 'OfflineContentManager'
      })
      return
    }

    const startTime = performance.now()

    try {
      logger.info('Initializing Offline Content Manager...', {
        component: 'OfflineContentManager',
        metadata: { config: this.config }
      })

      // Open IndexedDB
      await this.openDatabase()

      // Start periodic cleanup
      this.startPeriodicCleanup()

      // Start sync process
      this.startSyncProcess()

      this.isInitialized = true

      const initTime = performance.now() - startTime

      performanceMonitor.recordMetric('offline_content_manager_init_time', initTime, {
        success: true
      })

      logger.info(`Offline Content Manager initialized in ${initTime.toFixed(2)}ms`, {
        component: 'OfflineContentManager',
        metadata: { initTime }
      })

    } catch (error) {
      const initTime = performance.now() - startTime

      performanceMonitor.recordMetric('offline_content_manager_init_error', initTime, {
        success: false,
        error: (error as Error).message
      })

      logger.error('Failed to initialize Offline Content Manager', {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })

      throw error
    }
  }

  /**
   * Store content for offline access
   */
  async storeContent(
    id: string,
    type: OfflineContent['type'],
    data: any,
    options?: {
      priority?: OfflineContent['priority']
      expiry?: number
      syncStatus?: OfflineContent['syncStatus']
    }
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const startTime = performance.now()

    try {
      const content: OfflineContent = {
        id,
        type,
        data: this.config.enableCompression ? this.compressData(data) : data,
        timestamp: Date.now(),
        expiry: options?.expiry || (Date.now() + this.config.defaultExpiry),
        priority: options?.priority || 'medium',
        syncStatus: options?.syncStatus || 'synced',
        retryCount: 0
      }

      // Check storage quota before storing
      const quota = await this.getStorageQuota()
      if (quota.percentage > 90) {
        await this.cleanup()
      }

      const transaction = this.db.transaction(['content'], 'readwrite')
      const store = transaction.objectStore('content')

      await new Promise<void>((resolve, reject) => {
        const request = store.put(content)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      const storeTime = performance.now() - startTime

      performanceMonitor.recordMetric('offline_content_store_time', storeTime, {
        type,
        priority: content.priority,
        dataSize: JSON.stringify(data).length
      })

      logger.debug(`Stored offline content: ${id}`, {
        component: 'OfflineContentManager',
        metadata: {
          type,
          priority: content.priority,
          storeTime
        }
      })

    } catch (error) {
      const storeTime = performance.now() - startTime

      performanceMonitor.recordMetric('offline_content_store_error', storeTime, {
        error: (error as Error).message
      })

      logger.error(`Failed to store offline content: ${id}`, {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })

      throw error
    }
  }

  /**
   * Retrieve content from offline storage
   */
  async getContent<T = any>(id: string): Promise<T | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const startTime = performance.now()

    try {
      const transaction = this.db.transaction(['content'], 'readonly')
      const store = transaction.objectStore('content')

      const content = await new Promise<OfflineContent | null>((resolve, reject) => {
        const request = store.get(id)
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
      })

      if (!content) {
        performanceMonitor.recordMetric('offline_content_retrieve_miss', performance.now() - startTime)
        return null
      }

      // Check if content has expired
      if (content.expiry && Date.now() > content.expiry) {
        await this.deleteContent(id)
        performanceMonitor.recordMetric('offline_content_retrieve_expired', performance.now() - startTime)
        return null
      }

      const retrieveTime = performance.now() - startTime

      performanceMonitor.recordMetric('offline_content_retrieve_time', retrieveTime, {
        type: content.type,
        hit: true
      })

      logger.debug(`Retrieved offline content: ${id}`, {
        component: 'OfflineContentManager',
        metadata: {
          type: content.type,
          age: Date.now() - content.timestamp,
          retrieveTime
        }
      })

      // Decompress data if needed
      const data = this.config.enableCompression ? this.decompressData(content.data) : content.data
      return data as T

    } catch (error) {
      const retrieveTime = performance.now() - startTime

      performanceMonitor.recordMetric('offline_content_retrieve_error', retrieveTime, {
        error: (error as Error).message
      })

      logger.error(`Failed to retrieve offline content: ${id}`, {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })

      return null
    }
  }

  /**
   * Get all content of a specific type
   */
  async getContentByType<T = any>(type: OfflineContent['type']): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const transaction = this.db.transaction(['content'], 'readonly')
      const store = transaction.objectStore('content')
      const index = store.index('type')

      const contents = await new Promise<OfflineContent[]>((resolve, reject) => {
        const request = index.getAll(type)
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })

      // Filter expired content and decompress
      const validContents = contents
        .filter(content => !content.expiry || Date.now() <= content.expiry)
        .map(content => this.config.enableCompression ? this.decompressData(content.data) : content.data)

      logger.debug(`Retrieved ${validContents.length} items of type: ${type}`, {
        component: 'OfflineContentManager',
        metadata: { type, count: validContents.length }
      })

      return validContents as T[]

    } catch (error) {
      logger.error(`Failed to retrieve content by type: ${type}`, {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })

      return []
    }
  }

  /**
   * Store form submission for background sync
   */
  async storeFormSubmission(
    formType: 'registration' | 'volunteer' | 'contact',
    formData: any
  ): Promise<string> {
    const submissionId = `${formType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    await this.storeContent(submissionId, 'form-submission', {
      formType,
      formData,
      submittedAt: Date.now()
    }, {
      priority: 'high',
      syncStatus: 'pending'
    })

    // Add to sync queue
    this.syncQueue.add(submissionId)

    logger.info(`Form submission queued for sync: ${submissionId}`, {
      component: 'OfflineContentManager',
      metadata: { formType }
    })

    return submissionId
  }

  /**
   * Get pending form submissions
   */
  async getPendingSubmissions(): Promise<OfflineContent[]> {
    if (!this.db) {
      return []
    }

    try {
      const transaction = this.db.transaction(['content'], 'readonly')
      const store = transaction.objectStore('content')
      const index = store.index('syncStatus')

      const pendingContents = await new Promise<OfflineContent[]>((resolve, reject) => {
        const request = index.getAll('pending')
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })

      return pendingContents.filter(content => content.type === 'form-submission')

    } catch (error) {
      logger.error('Failed to get pending submissions', {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })

      return []
    }
  }

  /**
   * Mark submission as synced
   */
  async markSubmissionSynced(id: string): Promise<void> {
    await this.updateSyncStatus(id, 'synced')
    this.syncQueue.delete(id)

    logger.debug(`Form submission marked as synced: ${id}`, {
      component: 'OfflineContentManager'
    })
  }

  /**
   * Mark submission as failed
   */
  async markSubmissionFailed(id: string): Promise<void> {
    if (!this.db) {
      return
    }

    try {
      const transaction = this.db.transaction(['content'], 'readwrite')
      const store = transaction.objectStore('content')

      const content = await new Promise<OfflineContent | null>((resolve, reject) => {
        const request = store.get(id)
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
      })

      if (content) {
        content.syncStatus = 'failed'
        content.retryCount++

        // If retry limit exceeded, remove from queue
        if (content.retryCount >= this.config.syncRetryLimit) {
          this.syncQueue.delete(id)
          logger.warn(`Form submission exceeded retry limit: ${id}`, {
            component: 'OfflineContentManager',
            metadata: { retryCount: content.retryCount }
          })
        }

        await new Promise<void>((resolve, reject) => {
          const putRequest = store.put(content)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        })
      }

    } catch (error) {
      logger.error(`Failed to mark submission as failed: ${id}`, {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })
    }
  }

  /**
   * Store critical event data for offline access
   */
  async storeCriticalData(): Promise<void> {
    if (!navigator.onLine) {
      logger.debug('Offline - skipping critical data storage', {
        component: 'OfflineContentManager'
      })
      return
    }

    try {
      // Store event schedule
      const scheduleResponse = await fetch('/api/schedule')
      if (scheduleResponse.ok) {
        const scheduleData = await scheduleResponse.json()
        await this.storeContent('event-schedule', 'schedule', scheduleData, {
          priority: 'critical',
          expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        })
      }

      // Store speaker information
      const speakersResponse = await fetch('/api/speakers')
      if (speakersResponse.ok) {
        const speakersData = await speakersResponse.json()
        await this.storeContent('event-speakers', 'speakers', speakersData, {
          priority: 'critical',
          expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        })
      }

      // Store essential content
      const contentResponse = await fetch('/api/public/content')
      if (contentResponse.ok) {
        const contentData = await contentResponse.json()
        await this.storeContent('essential-content', 'content', contentData, {
          priority: 'high',
          expiry: Date.now() + (12 * 60 * 60 * 1000) // 12 hours
        })
      }

      logger.info('Critical data stored for offline access', {
        component: 'OfflineContentManager'
      })

    } catch (error) {
      logger.error('Failed to store critical data', {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<StorageQuota> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const used = estimate.usage || 0
        const total = estimate.quota || 0
        const available = total - used
        const percentage = total > 0 ? (used / total) * 100 : 0

        return { used, available, total, percentage }
      }
    } catch (error) {
      logger.debug('Storage estimation not available', {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })
    }

    return { used: 0, available: 0, total: 0, percentage: 0 }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalItems: number
    itemsByType: Record<string, number>
    pendingSync: number
    totalSize: number
    quota: StorageQuota
  }> {
    if (!this.db) {
      return {
        totalItems: 0,
        itemsByType: {},
        pendingSync: 0,
        totalSize: 0,
        quota: { used: 0, available: 0, total: 0, percentage: 0 }
      }
    }

    try {
      const transaction = this.db.transaction(['content'], 'readonly')
      const store = transaction.objectStore('content')

      const allContents = await new Promise<OfflineContent[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })

      const itemsByType: Record<string, number> = {}
      let totalSize = 0
      let pendingSync = 0

      allContents.forEach(content => {
        itemsByType[content.type] = (itemsByType[content.type] || 0) + 1
        totalSize += JSON.stringify(content).length

        if (content.syncStatus === 'pending') {
          pendingSync++
        }
      })

      const quota = await this.getStorageQuota()

      return {
        totalItems: allContents.length,
        itemsByType,
        pendingSync,
        totalSize,
        quota
      }

    } catch (error) {
      logger.error('Failed to get offline storage stats', {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })

      return {
        totalItems: 0,
        itemsByType: {},
        pendingSync: 0,
        totalSize: 0,
        quota: { used: 0, available: 0, total: 0, percentage: 0 }
      }
    }
  }

  // Private methods

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create content store
        if (!db.objectStoreNames.contains('content')) {
          const store = db.createObjectStore('content', { keyPath: 'id' })
          store.createIndex('type', 'type', { unique: false })
          store.createIndex('priority', 'priority', { unique: false })
          store.createIndex('syncStatus', 'syncStatus', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  private async deleteContent(id: string): Promise<void> {
    if (!this.db) {
      return
    }

    try {
      const transaction = this.db.transaction(['content'], 'readwrite')
      const store = transaction.objectStore('content')

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      logger.debug(`Deleted offline content: ${id}`, {
        component: 'OfflineContentManager'
      })

    } catch (error) {
      logger.error(`Failed to delete offline content: ${id}`, {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })
    }
  }

  private async updateSyncStatus(id: string, status: OfflineContent['syncStatus']): Promise<void> {
    if (!this.db) {
      return
    }

    try {
      const transaction = this.db.transaction(['content'], 'readwrite')
      const store = transaction.objectStore('content')

      const content = await new Promise<OfflineContent | null>((resolve, reject) => {
        const request = store.get(id)
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
      })

      if (content) {
        content.syncStatus = status

        await new Promise<void>((resolve, reject) => {
          const putRequest = store.put(content)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        })
      }

    } catch (error) {
      logger.error(`Failed to update sync status: ${id}`, {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })
    }
  }

  private async cleanup(): Promise<void> {
    if (!this.db) {
      return
    }

    try {
      const transaction = this.db.transaction(['content'], 'readwrite')
      const store = transaction.objectStore('content')

      const allContents = await new Promise<OfflineContent[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })

      // Remove expired content
      const now = Date.now()
      const expiredContent = allContents.filter(content => 
        content.expiry && now > content.expiry
      )

      // Remove low priority content if still over limit
      const quota = await this.getStorageQuota()
      if (quota.percentage > 85) {
        const lowPriorityContent = allContents
          .filter(content => content.priority === 'low')
          .sort((a, b) => a.timestamp - b.timestamp) // oldest first
          .slice(0, Math.max(10, Math.floor(allContents.length * 0.1)))

        expiredContent.push(...lowPriorityContent)
      }

      // Delete content
      for (const content of expiredContent) {
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = store.delete(content.id)
          deleteRequest.onsuccess = () => resolve()
          deleteRequest.onerror = () => reject(deleteRequest.error)
        })
      }

      if (expiredContent.length > 0) {
        logger.info(`Cleaned up ${expiredContent.length} offline content items`, {
          component: 'OfflineContentManager',
          metadata: { cleanedCount: expiredContent.length }
        })
      }

    } catch (error) {
      logger.error('Failed to cleanup offline content', {
        component: 'OfflineContentManager',
        metadata: { error: (error as Error).message }
      })
    }
  }

  private startPeriodicCleanup(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanup()
    }, 60 * 60 * 1000)
  }

  private startSyncProcess(): void {
    // Attempt to sync pending items every 5 minutes when online
    setInterval(async () => {
      if (navigator.onLine && this.syncQueue.size > 0) {
        await this.processSyncQueue()
      }
    }, 5 * 60 * 1000)

    // Sync when coming online
    window.addEventListener('online', () => {
      setTimeout(() => this.processSyncQueue(), 1000)
    })
  }

  private async processSyncQueue(): Promise<void> {
    const pendingItems = Array.from(this.syncQueue)

    for (const itemId of pendingItems) {
      try {
        const content = await this.getContent<any>(itemId)
        if (content && content.formType) {
          // Try to sync the form submission
          const response = await this.syncFormSubmission(content)
          if (response.ok) {
            await this.markSubmissionSynced(itemId)
          } else {
            await this.markSubmissionFailed(itemId)
          }
        }
      } catch (error) {
        await this.markSubmissionFailed(itemId)
      }
    }
  }

  private async syncFormSubmission(submission: any): Promise<Response> {
    const endpoint = this.getSubmissionEndpoint(submission.formType)
    
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submission.formData)
    })
  }

  private getSubmissionEndpoint(formType: string): string {
    switch (formType) {
      case 'registration':
        return '/api/public/registrations'
      case 'volunteer':
        return '/api/public/volunteers'
      case 'contact':
        return '/api/public/contact'
      default:
        throw new Error(`Unknown form type: ${formType}`)
    }
  }

  private compressData(data: any): string {
    // Simple compression - in production, use a proper compression library
    return JSON.stringify(data)
  }

  private decompressData(compressedData: string): any {
    // Simple decompression
    return JSON.parse(compressedData)
  }

  /**
   * Destroy the offline content manager
   */
  destroy(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }

    this.syncQueue.clear()
    this.isInitialized = false

    logger.info('Offline Content Manager destroyed', {
      component: 'OfflineContentManager'
    })
  }
}

export default OfflineContentManager
export type { OfflineContent, OfflineConfig, StorageQuota }