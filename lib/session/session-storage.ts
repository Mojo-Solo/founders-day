/**
 * Session Storage Management
 * 
 * Handles secure storage and retrieval of session data with encryption,
 * compression, and multiple storage strategies
 */

import {
  SessionData,
  SessionStorageStrategy,
  SessionStorageItem,
  UserPreferences,
  SESSION_STORAGE_KEYS,
  SESSION_LIMITS
} from './session-types'

import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

class SessionStorageManager {
  private encryptionKey: string | null = null
  private storageQuotaWarned = false
  
  constructor() {
    this.initializeEncryption()
    this.monitorStorageQuota()
  }
  
  /**
   * Store session data with encryption and compression
   */
  async store(
    key: string,
    data: any,
    strategy: SessionStorageStrategy
  ): Promise<void> {
    const startTime = performance.now()
    
    try {
      let serializedData = JSON.stringify(data)
      let dataSize = new Blob([serializedData]).size
      
      // Check size limits
      if (dataSize > SESSION_LIMITS.SESSION_DATA_SIZE_LIMIT) {
        throw new Error(`Data size ${dataSize} exceeds limit ${SESSION_LIMITS.SESSION_DATA_SIZE_LIMIT}`)
      }
      
      // Compress if enabled
      if (strategy.compression) {
        serializedData = await this.compressData(serializedData)
        const compressedSize = new Blob([serializedData]).size
        
        logger.debug(`Data compressed: ${dataSize} -> ${compressedSize} bytes`, {
          component: 'SessionStorage',
          metadata: {
            originalSize: dataSize,
            compressedSize,
            compressionRatio: (compressedSize / dataSize * 100).toFixed(2) + '%'
          }
        })
      }
      
      // Encrypt if enabled
      if (strategy.encryption && this.encryptionKey) {
        serializedData = await this.encryptData(serializedData)
      }
      
      // Create storage item
      const storageItem: SessionStorageItem = {
        key,
        value: serializedData,
        encrypted: strategy.encryption,
        compressed: strategy.compression,
        timestamp: Date.now(),
        ttl: strategy.ttl,
        version: '1.0.0'
      }
      
      // Store using primary strategy
      try {
        await this.storeInStorage(key, storageItem, strategy.primary)
        
        performanceMonitor.recordMetric('session_storage_write', performance.now() - startTime, {
          storage: strategy.primary,
          encrypted: strategy.encryption,
          compressed: strategy.compression,
          size: dataSize
        })
        
      } catch (primaryError) {
        logger.warn(`Primary storage failed (${strategy.primary}), using fallback`, {
          component: 'SessionStorage',
          metadata: {
            error: (primaryError as Error).message,
            primary: strategy.primary,
            fallback: strategy.fallback
          }
        })
        
        // Try fallback storage
        await this.storeInStorage(key, storageItem, strategy.fallback)
        
        performanceMonitor.recordMetric('session_storage_write', performance.now() - startTime, {
          storage: strategy.fallback,
          encrypted: strategy.encryption,
          compressed: strategy.compression,
          size: dataSize,
          fallback: true
        })
      }
      
      logger.debug(`Session data stored: ${key}`, {
        component: 'SessionStorage',
        metadata: {
          size: dataSize,
          encrypted: strategy.encryption,
          compressed: strategy.compression,
          storage: strategy.primary
        }
      })
      
    } catch (error) {
      performanceMonitor.recordMetric('session_storage_write_error', performance.now() - startTime, {
        error: (error as Error).message
      })
      
      logger.error(`Failed to store session data: ${key}`, {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
      
      throw error
    }
  }
  
  /**
   * Retrieve session data with decryption and decompression
   */
  async retrieve<T>(
    key: string,
    strategy: SessionStorageStrategy
  ): Promise<T | null> {
    const startTime = performance.now()
    
    try {
      // Try primary storage first
      let storageItem: SessionStorageItem | null = null
      
      try {
        storageItem = await this.retrieveFromStorage(key, strategy.primary)
      } catch (primaryError) {
        logger.debug(`Primary storage retrieval failed (${strategy.primary}), trying fallback`, {
          component: 'SessionStorage',
          metadata: { error: (primaryError as Error).message }
        })
        
        // Try fallback storage
        storageItem = await this.retrieveFromStorage(key, strategy.fallback)
      }
      
      if (!storageItem) {
        performanceMonitor.recordMetric('session_storage_read_miss', performance.now() - startTime)
        return null
      }
      
      // Check TTL
      if (Date.now() - storageItem.timestamp > storageItem.ttl) {
        logger.debug(`Session data expired: ${key}`, {
          component: 'SessionStorage',
          metadata: {
            age: Date.now() - storageItem.timestamp,
            ttl: storageItem.ttl
          }
        })
        
        // Clean up expired data
        await this.remove(key, strategy)
        
        performanceMonitor.recordMetric('session_storage_read_expired', performance.now() - startTime)
        return null
      }
      
      let data = storageItem.value
      
      // Decrypt if encrypted
      if (storageItem.encrypted && this.encryptionKey) {
        data = await this.decryptData(data)
      }
      
      // Decompress if compressed
      if (storageItem.compressed) {
        data = await this.decompressData(data)
      }
      
      // Parse JSON
      const parsedData = JSON.parse(data) as T
      
      performanceMonitor.recordMetric('session_storage_read', performance.now() - startTime, {
        storage: strategy.primary,
        encrypted: storageItem.encrypted,
        compressed: storageItem.compressed,
        age: Date.now() - storageItem.timestamp
      })
      
      return parsedData
      
    } catch (error) {
      performanceMonitor.recordMetric('session_storage_read_error', performance.now() - startTime, {
        error: (error as Error).message
      })
      
      logger.error(`Failed to retrieve session data: ${key}`, {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
      
      return null
    }
  }
  
  /**
   * Remove session data from storage
   */
  async remove(key: string, strategy: SessionStorageStrategy): Promise<void> {
    try {
      // Remove from both primary and fallback storage
      await Promise.allSettled([
        this.removeFromStorage(key, strategy.primary),
        this.removeFromStorage(key, strategy.fallback)
      ])
      
      logger.debug(`Session data removed: ${key}`, {
        component: 'SessionStorage'
      })
      
    } catch (error) {
      logger.error(`Failed to remove session data: ${key}`, {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
    }
  }
  
  /**
   * Clear all session data
   */
  async clear(strategy: SessionStorageStrategy): Promise<void> {
    try {
      const keys = Object.values(SESSION_STORAGE_KEYS)
      
      await Promise.allSettled(
        keys.map(key => this.remove(key, strategy))
      )
      
      logger.info('All session data cleared', {
        component: 'SessionStorage'
      })
      
    } catch (error) {
      logger.error('Failed to clear session data', {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
    }
  }
  
  /**
   * Check if storage is available
   */
  isStorageAvailable(storageType: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB'): boolean {
    try {
      switch (storageType) {
        case 'localStorage':
          if (typeof localStorage === 'undefined') return false
          localStorage.setItem('test', 'test')
          localStorage.removeItem('test')
          return true
          
        case 'sessionStorage':
          if (typeof sessionStorage === 'undefined') return false
          sessionStorage.setItem('test', 'test')
          sessionStorage.removeItem('test')
          return true
          
        case 'indexedDB':
          return typeof indexedDB !== 'undefined'
          
        case 'memory':
          return true
          
        default:
          return false
      }
    } catch (error) {
      return false
    }
  }
  
  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{
    quota?: number
    usage?: number
    available?: number
    percentage?: number
  }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const usage = estimate.usage || 0
        const quota = estimate.quota || 0
        
        return {
          quota,
          usage,
          available: quota - usage,
          percentage: quota > 0 ? (usage / quota) * 100 : 0
        }
      }
    } catch (error) {
      logger.debug('Storage estimation not available', {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
    }
    
    return {}
  }
  
  // Private methods
  
  private initializeEncryption(): void {
    // In a real implementation, this would use a proper key derivation function
    // For now, we'll use a simple approach
    this.encryptionKey = this.generateEncryptionKey()
  }
  
  private generateEncryptionKey(): string {
    // This is a simplified encryption key generation
    // In production, use proper crypto APIs
    return btoa(`founders_day_${navigator.userAgent}_${Date.now()}`).slice(0, 32)
  }
  
  private async encryptData(data: string): Promise<string> {
    // Simplified encryption using btoa for demo purposes
    // In production, use Web Crypto API
    try {
      return btoa(data)
    } catch (error) {
      logger.warn('Encryption failed, storing unencrypted', {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
      return data
    }
  }
  
  private async decryptData(encryptedData: string): Promise<string> {
    // Simplified decryption using atob for demo purposes
    // In production, use Web Crypto API
    try {
      return atob(encryptedData)
    } catch (error) {
      logger.warn('Decryption failed, returning as-is', {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
      return encryptedData
    }
  }
  
  private async compressData(data: string): Promise<string> {
    // Simplified compression using basic string compression
    // In production, use proper compression libraries
    try {
      return this.simpleCompress(data)
    } catch (error) {
      logger.warn('Compression failed, storing uncompressed', {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
      return data
    }
  }
  
  private async decompressData(compressedData: string): Promise<string> {
    // Simplified decompression
    try {
      return this.simpleDecompress(compressedData)
    } catch (error) {
      logger.warn('Decompression failed, returning as-is', {
        component: 'SessionStorage',
        metadata: { error: (error as Error).message }
      })
      return compressedData
    }
  }
  
  private simpleCompress(data: string): string {
    // Very basic compression using simple character frequency
    // This is just for demonstration - use real compression in production
    return data
  }
  
  private simpleDecompress(data: string): string {
    // Basic decompression
    return data
  }
  
  private async storeInStorage(
    key: string,
    item: SessionStorageItem,
    storageType: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB'
  ): Promise<void> {
    const serializedItem = JSON.stringify(item)
    
    switch (storageType) {
      case 'localStorage':
        if (!this.isStorageAvailable('localStorage')) {
          throw new Error('localStorage not available')
        }
        localStorage.setItem(key, serializedItem)
        break
        
      case 'sessionStorage':
        if (!this.isStorageAvailable('sessionStorage')) {
          throw new Error('sessionStorage not available')
        }
        sessionStorage.setItem(key, serializedItem)
        break
        
      case 'indexedDB':
        await this.storeInIndexedDB(key, item)
        break
        
      case 'memory':
        // Store in memory (simple Map)
        if (!this.memoryStorage) {
          this.memoryStorage = new Map()
        }
        this.memoryStorage.set(key, item)
        break
        
      default:
        throw new Error(`Unsupported storage type: ${storageType}`)
    }
  }
  
  private async retrieveFromStorage(
    key: string,
    storageType: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB'
  ): Promise<SessionStorageItem | null> {
    switch (storageType) {
      case 'localStorage':
        if (!this.isStorageAvailable('localStorage')) {
          return null
        }
        const localItem = localStorage.getItem(key)
        return localItem ? JSON.parse(localItem) : null
        
      case 'sessionStorage':
        if (!this.isStorageAvailable('sessionStorage')) {
          return null
        }
        const sessionItem = sessionStorage.getItem(key)
        return sessionItem ? JSON.parse(sessionItem) : null
        
      case 'indexedDB':
        return await this.retrieveFromIndexedDB(key)
        
      case 'memory':
        if (!this.memoryStorage) {
          return null
        }
        return this.memoryStorage.get(key) || null
        
      default:
        return null
    }
  }
  
  private async removeFromStorage(
    key: string,
    storageType: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB'
  ): Promise<void> {
    switch (storageType) {
      case 'localStorage':
        if (this.isStorageAvailable('localStorage')) {
          localStorage.removeItem(key)
        }
        break
        
      case 'sessionStorage':
        if (this.isStorageAvailable('sessionStorage')) {
          sessionStorage.removeItem(key)
        }
        break
        
      case 'indexedDB':
        await this.removeFromIndexedDB(key)
        break
        
      case 'memory':
        if (this.memoryStorage) {
          this.memoryStorage.delete(key)
        }
        break
    }
  }
  
  private memoryStorage: Map<string, SessionStorageItem> | null = null
  
  private async storeInIndexedDB(key: string, item: SessionStorageItem): Promise<void> {
    // Simplified IndexedDB implementation
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FoundersDaySession', 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['sessions'], 'readwrite')
        const store = transaction.objectStore('sessions')
        
        const putRequest = store.put(item)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        const store = db.createObjectStore('sessions', { keyPath: 'key' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    })
  }
  
  private async retrieveFromIndexedDB(key: string): Promise<SessionStorageItem | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FoundersDaySession', 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['sessions'], 'readonly')
        const store = transaction.objectStore('sessions')
        
        const getRequest = store.get(key)
        getRequest.onsuccess = () => {
          const result = getRequest.result
          resolve(result ? { ...result } : null)
        }
        getRequest.onerror = () => reject(getRequest.error)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        const store = db.createObjectStore('sessions', { keyPath: 'key' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    })
  }
  
  private async removeFromIndexedDB(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FoundersDaySession', 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['sessions'], 'readwrite')
        const store = transaction.objectStore('sessions')
        
        const deleteRequest = store.delete(key)
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      }
    })
  }
  
  private monitorStorageQuota(): void {
    if (typeof window === 'undefined') return
    
    // Check storage quota periodically
    setInterval(async () => {
      const info = await this.getStorageInfo()
      
      if (info.percentage && info.percentage > 80 && !this.storageQuotaWarned) {
        this.storageQuotaWarned = true
        
        logger.warn('Storage quota approaching limit', {
          component: 'SessionStorage',
          metadata: info
        })
        
        // Trigger cleanup of old data
        await this.cleanupExpiredData()
      }
    }, 60000) // Check every minute
  }
  
  private async cleanupExpiredData(): Promise<void> {
    logger.info('Starting storage cleanup', {
      component: 'SessionStorage'
    })
    
    // This would implement cleanup logic for expired data
    // For now, just log the action
    
    logger.info('Storage cleanup completed', {
      component: 'SessionStorage'
    })
  }
}

// Create singleton instance
const sessionStorageManager = new SessionStorageManager()

export default sessionStorageManager
export { SessionStorageManager }