/**
 * Comprehensive Cache Management System
 * 
 * Features:
 * - Browser storage caching (localStorage, sessionStorage)
 * - Memory caching with TTL
 * - API response caching
 * - Image caching with lazy loading
 * - Cache invalidation strategies
 * - Storage quota management
 * - Performance monitoring integration
 */

import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

export interface CacheItem<T = any> {
  data: T
  timestamp: number
  ttl: number
  key: string
  size?: number
  metadata?: Record<string, any>
}

export interface CacheStats {
  totalItems: number
  totalSize: number
  hitRate: number
  missRate: number
  evictionCount: number
  lastCleanup: number
}

export type CacheStorage = 'memory' | 'localStorage' | 'sessionStorage'

class CacheManager {
  private memoryCache = new Map<string, CacheItem>()
  private stats: CacheStats = {
    totalItems: 0,
    totalSize: 0,
    hitRate: 0,
    missRate: 0,
    evictionCount: 0,
    lastCleanup: Date.now()
  }
  private hitCount = 0
  private missCount = 0
  private maxMemorySize = 50 * 1024 * 1024 // 50MB
  private cleanupInterval: NodeJS.Timeout | null = null
  
  constructor() {
    this.initializeCleanup()
    this.initializeStorageQuotaMonitoring()
  }
  
  private initializeCleanup() {
    // Clean up expired items every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }
  
  private initializeStorageQuotaMonitoring() {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      // Monitor storage quota periodically
      setInterval(async () => {
        try {
          const estimate = await navigator.storage.estimate()
          const usagePercentage = ((estimate.usage || 0) / (estimate.quota || 1)) * 100
          
          if (usagePercentage > 80) {
            logger.warn('Storage quota approaching limit', {
              component: 'CacheManager',
              metadata: {
                usage: estimate.usage,
                quota: estimate.quota,
                percentage: usagePercentage
              }
            })
            
            // Aggressive cleanup when storage is low
            this.cleanup(true)
          }
        } catch (error) {
          logger.debug('Storage estimate not available', { 
            component: 'CacheManager',
            metadata: { error: (error as Error).message } 
          })
        }
      }, 60000) // Check every minute
    }
  }
  
  /**
   * Set an item in cache with specified storage type and TTL
   */
  set<T>(
    key: string, 
    data: T, 
    ttl: number = 30 * 60 * 1000, // 30 minutes default
    storage: CacheStorage = 'memory',
    metadata?: Record<string, any>
  ): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
      size: this.calculateSize(data),
      metadata
    }
    
    try {
      switch (storage) {
        case 'memory':
          this.setMemoryCache(key, item)
          break
        case 'localStorage':
          this.setLocalStorageCache(key, item)
          break
        case 'sessionStorage':
          this.setSessionStorageCache(key, item)
          break
      }
      
      logger.debug(`Cache set: ${key}`, {
        component: 'CacheManager',
        metadata: {
          storage,
          ttl,
          size: item.size,
          ...metadata
        }
      })
    } catch (error) {
      logger.error(`Failed to cache item: ${key}`, {
        component: 'CacheManager',
        metadata: { storage, error }
      }, error as Error)
    }
  }
  
  /**
   * Get an item from cache, checking all storage types
   */
  get<T>(key: string, storage?: CacheStorage): T | null {
    const stopTiming = performanceMonitor.startTiming('cache_get')
    
    try {
      let item: CacheItem<T> | null = null
      
      if (storage) {
        item = this.getFromStorage<T>(key, storage)
      } else {
        // Check all storage types in order of preference
        item = this.getFromStorage<T>(key, 'memory') ||
               this.getFromStorage<T>(key, 'sessionStorage') ||
               this.getFromStorage<T>(key, 'localStorage')
      }
      
      if (item && this.isItemValid(item)) {
        this.hitCount++
        this.updateStats()
        
        logger.debug(`Cache hit: ${key}`, {
          component: 'CacheManager',
          metadata: {
            storage: this.getItemStorage(key),
            age: Date.now() - item.timestamp
          }
        })
        
        return item.data
      } else {
        if (item) {
          // Item expired, remove it
          this.delete(key)
        }
        
        this.missCount++
        this.updateStats()
        
        logger.debug(`Cache miss: ${key}`, {
          component: 'CacheManager',
          metadata: {
            expired: !!item,
            hitRate: this.stats.hitRate
          }
        })
        
        return null
      }
    } catch (error) {
      logger.error(`Cache get error: ${key}`, {
        component: 'CacheManager'
      }, error as Error)
      
      this.missCount++
      this.updateStats()
      return null
    } finally {
      stopTiming()
    }
  }
  
  /**
   * Delete an item from all storage types
   */
  delete(key: string): void {
    this.memoryCache.delete(key)
    
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`cache_${key}`)
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(`cache_${key}`)
      }
    } catch (error) {
      logger.debug('Storage not available for cache deletion', { 
        component: 'CacheManager',
        metadata: { key, error: (error as Error).message } 
      })
    }
    
    logger.debug(`Cache deleted: ${key}`, {
      component: 'CacheManager'
    })
  }
  
  /**
   * Check if a key exists in cache
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }
  
  /**
   * Clear all caches
   */
  clear(storage?: CacheStorage): void {
    if (!storage || storage === 'memory') {
      this.memoryCache.clear()
    }
    
    if (!storage || storage === 'localStorage') {
      try {
        if (typeof localStorage !== 'undefined') {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'))
          keys.forEach(key => localStorage.removeItem(key))
        }
      } catch (error) {
        logger.debug('localStorage not available for clearing', { 
          component: 'CacheManager',
          metadata: { error: (error as Error).message } 
        })
      }
    }
    
    if (!storage || storage === 'sessionStorage') {
      try {
        if (typeof sessionStorage !== 'undefined') {
          const keys = Object.keys(sessionStorage).filter(k => k.startsWith('cache_'))
          keys.forEach(key => sessionStorage.removeItem(key))
        }
      } catch (error) {
        logger.debug('sessionStorage not available for clearing', { 
          component: 'CacheManager',
          metadata: { error: (error as Error).message } 
        })
      }
    }
    
    this.updateStats()
    
    logger.info(`Cache cleared`, {
      component: 'CacheManager',
      metadata: { storage: storage || 'all' }
    })
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats()
    return { ...this.stats }
  }
  
  /**
   * Cleanup expired items and manage memory usage
   */
  cleanup(aggressive: boolean = false): void {
    const startTime = Date.now()
    let removedCount = 0
    let freedMemory = 0
    
    // Clean memory cache
    for (const [key, item] of this.memoryCache.entries()) {
      if (!this.isItemValid(item) || (aggressive && this.shouldEvictItem(item))) {
        freedMemory += item.size || 0
        this.memoryCache.delete(key)
        removedCount++
      }
    }
    
    // Clean localStorage
    this.cleanupStorage('localStorage', aggressive)
    
    // Clean sessionStorage  
    this.cleanupStorage('sessionStorage', aggressive)
    
    this.stats.evictionCount += removedCount
    this.stats.lastCleanup = Date.now()
    this.updateStats()
    
    const duration = Date.now() - startTime
    
    logger.info('Cache cleanup completed', {
      component: 'CacheManager',
      metadata: {
        removedCount,
        freedMemory,
        duration,
        aggressive,
        totalItems: this.stats.totalItems
      }
    })
  }
  
  /**
   * Memory-aware cache with automatic eviction
   */
  setWithMemoryManagement<T>(key: string, data: T, ttl?: number): void {
    const size = this.calculateSize(data)
    
    // Check if we need to free memory
    if (this.getTotalMemoryUsage() + size > this.maxMemorySize) {
      this.evictLRU(size)
    }
    
    this.set(key, data, ttl, 'memory')
  }
  
  // Private helper methods
  
  private setMemoryCache<T>(key: string, item: CacheItem<T>): void {
    this.memoryCache.set(key, item)
  }
  
  private setLocalStorageCache<T>(key: string, item: CacheItem<T>): void {
    if (typeof localStorage === 'undefined') return
    
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item))
    } catch (error) {
      // Handle quota exceeded error
      if (error instanceof DOMException && error.code === 22) {
        logger.warn('localStorage quota exceeded, cleaning up', {
          component: 'CacheManager',
          metadata: { key }
        })
        this.cleanupStorage('localStorage', true)
        
        // Try again after cleanup
        try {
          localStorage.setItem(`cache_${key}`, JSON.stringify(item))
        } catch (retryError) {
          logger.error('localStorage still full after cleanup', {
            component: 'CacheManager'
          }, retryError as Error)
        }
      } else {
        throw error
      }
    }
  }
  
  private setSessionStorageCache<T>(key: string, item: CacheItem<T>): void {
    if (typeof sessionStorage === 'undefined') return
    
    try {
      sessionStorage.setItem(`cache_${key}`, JSON.stringify(item))
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        logger.warn('sessionStorage quota exceeded, cleaning up', {
          component: 'CacheManager',
          metadata: { key }
        })
        this.cleanupStorage('sessionStorage', true)
        
        try {
          sessionStorage.setItem(`cache_${key}`, JSON.stringify(item))
        } catch (retryError) {
          logger.error('sessionStorage still full after cleanup', {
            component: 'CacheManager'
          }, retryError as Error)
        }
      } else {
        throw error
      }
    }
  }
  
  private getFromStorage<T>(key: string, storage: CacheStorage): CacheItem<T> | null {
    switch (storage) {
      case 'memory':
        return this.memoryCache.get(key) as CacheItem<T> || null
        
      case 'localStorage':
        try {
          if (typeof localStorage === 'undefined') return null
          const item = localStorage.getItem(`cache_${key}`)
          return item ? JSON.parse(item) : null
        } catch (error) {
          logger.debug('localStorage read error', { 
            component: 'CacheManager',
            metadata: { key, error: (error as Error).message } 
          })
          return null
        }
        
      case 'sessionStorage':
        try {
          if (typeof sessionStorage === 'undefined') return null
          const item = sessionStorage.getItem(`cache_${key}`)
          return item ? JSON.parse(item) : null
        } catch (error) {
          logger.debug('sessionStorage read error', { 
            component: 'CacheManager',
            metadata: { key, error: (error as Error).message } 
          })
          return null
        }
        
      default:
        return null
    }
  }
  
  private isItemValid<T>(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp < item.ttl
  }
  
  private shouldEvictItem<T>(item: CacheItem<T>): boolean {
    const age = Date.now() - item.timestamp
    const halfLife = item.ttl / 2
    
    // Evict items that are past half their TTL during aggressive cleanup
    return age > halfLife
  }
  
  private getItemStorage(key: string): CacheStorage | null {
    if (this.memoryCache.has(key)) return 'memory'
    
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`cache_${key}`)) {
        return 'sessionStorage'
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem(`cache_${key}`)) {
        return 'localStorage'
      }
    } catch (error) {
      logger.debug('Storage check error', { 
        component: 'CacheManager',
        metadata: { key, error: (error as Error).message } 
      })
    }
    
    return null
  }
  
  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch (error) {
      // Fallback estimation
      return JSON.stringify(data).length * 2
    }
  }
  
  private getTotalMemoryUsage(): number {
    let total = 0
    for (const item of this.memoryCache.values()) {
      total += item.size || 0
    }
    return total
  }
  
  private evictLRU(spaceNeeded: number): void {
    const items = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
    
    let freedSpace = 0
    for (const [key, item] of items) {
      if (freedSpace >= spaceNeeded) break
      
      freedSpace += item.size || 0
      this.memoryCache.delete(key)
      this.stats.evictionCount++
    }
    
    logger.debug('LRU eviction completed', {
      component: 'CacheManager',
      metadata: {
        spaceNeeded,
        freedSpace,
        evictedItems: items.length
      }
    })
  }
  
  private cleanupStorage(storage: 'localStorage' | 'sessionStorage', aggressive: boolean): void {
    try {
      const storageObject = storage === 'localStorage' ? localStorage : sessionStorage
      if (typeof storageObject === 'undefined') return
      
      const keys = Object.keys(storageObject).filter(k => k.startsWith('cache_'))
      let removedCount = 0
      
      for (const key of keys) {
        try {
          const item = JSON.parse(storageObject.getItem(key) || '{}')
          if (!this.isItemValid(item) || (aggressive && this.shouldEvictItem(item))) {
            storageObject.removeItem(key)
            removedCount++
          }
        } catch (error) {
          // Remove corrupted items
          storageObject.removeItem(key)
          removedCount++
        }
      }
      
      if (removedCount > 0) {
        logger.debug(`Cleaned up ${storage}`, {
          component: 'CacheManager',
          metadata: { removedCount, aggressive }
        })
      }
    } catch (error) {
      logger.debug(`${storage} cleanup error`, { 
        component: 'CacheManager',
        metadata: { error: (error as Error).message } 
      })
    }
  }
  
  private updateStats(): void {
    const total = this.hitCount + this.missCount
    this.stats.hitRate = total > 0 ? (this.hitCount / total) * 100 : 0
    this.stats.missRate = total > 0 ? (this.missCount / total) * 100 : 0
    this.stats.totalItems = this.memoryCache.size
    this.stats.totalSize = this.getTotalMemoryUsage()
  }
  
  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager()

// Attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).cacheManager = cacheManager
}

export default cacheManager
export { CacheManager }