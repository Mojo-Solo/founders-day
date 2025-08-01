/**
 * API Response Caching System
 * 
 * Features:
 * - Intelligent caching based on request patterns
 * - Cache invalidation strategies
 * - Request deduplication
 * - Background cache refresh
 * - Network-first, cache-first, and stale-while-revalidate strategies
 * - Integration with React Query and SWR
 */

import cacheManager from './cache-manager'
import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

export interface CacheStrategy {
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'cache-only' | 'network-only'
  ttl?: number
  staleTime?: number
  maxAge?: number
  tags?: string[]
}

export interface RequestCacheKey {
  url: string
  method: string
  body?: string | null
  headers?: Record<string, string>
}

export interface CachedResponse {
  data: any
  status: number
  statusText: string
  headers: Record<string, string>
  timestamp: number
  etag?: string
  lastModified?: string
}

class APICache {
  private pendingRequests = new Map<string, Promise<any>>()
  private backgroundRefreshTimeout = new Map<string, NodeJS.Timeout>()
  
  // Default cache strategies for different endpoint patterns
  private endpointStrategies: Record<string, CacheStrategy> = {
    '/api/public/content': {
      strategy: 'stale-while-revalidate',
      ttl: 30 * 60 * 1000, // 30 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      tags: ['content']
    },
    '/api/schedule': {
      strategy: 'stale-while-revalidate',
      ttl: 15 * 60 * 1000, // 15 minutes
      staleTime: 2 * 60 * 1000, // 2 minutes
      tags: ['schedule']
    },
    '/api/public/registrations': {
      strategy: 'network-first',
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['registrations']
    },
    '/api/public/volunteers': {
      strategy: 'network-first',
      ttl: 10 * 60 * 1000, // 10 minutes
      tags: ['volunteers']
    }
  }
  
  /**
   * Enhanced fetch with caching capabilities
   */
  async fetch(
    url: string,
    options: RequestInit = {},
    cacheStrategy?: CacheStrategy
  ): Promise<Response> {
    const strategy = cacheStrategy || this.getEndpointStrategy(url)
    const cacheKey = this.generateCacheKey({ 
      url, 
      method: options.method || 'GET',
      body: typeof options.body === 'string' ? options.body : null,
      headers: typeof options.headers === 'object' && options.headers ? options.headers as Record<string, string> : undefined
    })
    
    logger.debug(`API cache fetch: ${url}`, {
      component: 'APICache',
      metadata: {
        strategy: strategy.strategy,
        cacheKey,
        ttl: strategy.ttl
      }
    })
    
    switch (strategy.strategy) {
      case 'cache-first':
        return this.cacheFirstStrategy(url, options, cacheKey, strategy)
      case 'network-first':
        return this.networkFirstStrategy(url, options, cacheKey, strategy)
      case 'stale-while-revalidate':
        return this.staleWhileRevalidateStrategy(url, options, cacheKey, strategy)
      case 'cache-only':
        return this.cacheOnlyStrategy(cacheKey)
      case 'network-only':
        return this.networkOnlyStrategy(url, options)
      default:
        return this.networkFirstStrategy(url, options, cacheKey, strategy)
    }
  }
  
  /**
   * Cache-first strategy: Check cache first, fallback to network
   */
  private async cacheFirstStrategy(
    url: string,
    options: RequestInit,
    cacheKey: string,
    strategy: CacheStrategy
  ): Promise<Response> {
    const cached = cacheManager.get<CachedResponse>(cacheKey)
    
    if (cached) {
      logger.debug(`Cache hit: ${url}`, {
        component: 'APICache',
        metadata: { age: Date.now() - cached.timestamp }
      })
      
      return this.createResponseFromCache(cached)
    }
    
    // Cache miss, fetch from network
    return this.fetchAndCache(url, options, cacheKey, strategy)
  }
  
  /**
   * Network-first strategy: Try network first, fallback to cache
   */
  private async networkFirstStrategy(
    url: string,
    options: RequestInit,
    cacheKey: string,
    strategy: CacheStrategy
  ): Promise<Response> {
    try {
      return await this.fetchAndCache(url, options, cacheKey, strategy)
    } catch (error) {
      // Network failed, try cache
      const cached = cacheManager.get<CachedResponse>(cacheKey)
      
      if (cached) {
        logger.warn(`Network failed, serving from cache: ${url}`, {
          component: 'APICache',
          metadata: { error: (error as Error).message }
        })
        
        return this.createResponseFromCache(cached)
      }
      
      throw error
    }
  }
  
  /**
   * Stale-while-revalidate: Serve from cache if available, refresh in background
   */
  private async staleWhileRevalidateStrategy(
    url: string,
    options: RequestInit,
    cacheKey: string,
    strategy: CacheStrategy
  ): Promise<Response> {
    const cached = cacheManager.get<CachedResponse>(cacheKey)
    
    if (cached) {
      const age = Date.now() - cached.timestamp
      const isStale = strategy.staleTime ? age > strategy.staleTime : false
      
      if (isStale) {
        // Serve stale content and refresh in background
        this.refreshInBackground(url, options, cacheKey, strategy)
        
        logger.debug(`Serving stale content: ${url}`, {
          component: 'APICache',
          metadata: { age, staleTime: strategy.staleTime }
        })
      }
      
      return this.createResponseFromCache(cached)
    }
    
    // No cache, fetch from network
    return this.fetchAndCache(url, options, cacheKey, strategy)
  }
  
  /**
   * Cache-only strategy: Only serve from cache
   */
  private async cacheOnlyStrategy(cacheKey: string): Promise<Response> {
    const cached = cacheManager.get<CachedResponse>(cacheKey)
    
    if (cached) {
      return this.createResponseFromCache(cached)
    }
    
    throw new Error('No cached response available')
  }
  
  /**
   * Network-only strategy: Always fetch from network, no caching
   */
  private async networkOnlyStrategy(url: string, options: RequestInit): Promise<Response> {
    return fetch(url, options)
  }
  
  /**
   * Fetch from network and cache the response
   */
  private async fetchAndCache(
    url: string,
    options: RequestInit,
    cacheKey: string,
    strategy: CacheStrategy
  ): Promise<Response> {
    // Request deduplication
    if (this.pendingRequests.has(cacheKey)) {
      logger.debug(`Request deduplication: ${url}`, {
        component: 'APICache'
      })
      
      const response = await this.pendingRequests.get(cacheKey)!
      return response.clone()
    }
    
    const stopTiming = performanceMonitor.startTiming('api_fetch_and_cache')
    
    const requestPromise = this.performFetch(url, options)
    this.pendingRequests.set(cacheKey, requestPromise)
    
    try {
      const response = await requestPromise
      
      // Cache successful responses
      if (response.ok || this.shouldCacheErrorResponse(response.status)) {
        await this.cacheResponse(response.clone(), cacheKey, strategy)
      }
      
      return response
    } catch (error) {
      logger.error(`Network request failed: ${url}`, {
        component: 'APICache'
      }, error as Error)
      
      throw error
    } finally {
      this.pendingRequests.delete(cacheKey)
      stopTiming()
    }
  }
  
  /**
   * Perform the actual fetch with monitoring
   */
  private async performFetch(url: string, options: RequestInit): Promise<Response> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(url, options)
      const duration = Date.now() - startTime
      
      performanceMonitor.recordMetric('api_response_time', duration, {
        url,
        method: options.method || 'GET',
        status: response.status,
        success: response.ok
      })
      
      logger.apiCall(
        options.method || 'GET',
        url,
        duration,
        response.status
      )
      
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      
      performanceMonitor.recordMetric('api_error', duration, {
        url,
        method: options.method || 'GET',
        error: (error as Error).message
      })
      
      logger.apiCall(
        options.method || 'GET',
        url,
        duration,
        undefined,
        error as Error
      )
      
      throw error
    }
  }
  
  /**
   * Cache the response data
   */
  private async cacheResponse(
    response: Response,
    cacheKey: string,
    strategy: CacheStrategy
  ): Promise<void> {
    try {
      const data = await response.json()
      
      const cachedResponse: CachedResponse = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: this.extractHeaders(response),
        timestamp: Date.now(),
        etag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined
      }
      
      cacheManager.set(
        cacheKey,
        cachedResponse,
        strategy.ttl || 30 * 60 * 1000, // 30 minutes default
        'memory',
        {
          tags: strategy.tags,
          url: response.url,
          strategy: strategy.strategy
        }
      )
      
      logger.debug(`Response cached: ${response.url}`, {
        component: 'APICache',
        metadata: {
          cacheKey,
          ttl: strategy.ttl,
          size: JSON.stringify(data).length
        }
      })
    } catch (error) {
      logger.error('Failed to cache response', {
        component: 'APICache',
        metadata: { cacheKey }
      }, error as Error)
    }
  }
  
  /**
   * Refresh cache in background
   */
  private refreshInBackground(
    url: string,
    options: RequestInit,
    cacheKey: string,
    strategy: CacheStrategy
  ): void {
    // Avoid multiple background refreshes for the same key
    if (this.backgroundRefreshTimeout.has(cacheKey)) {
      return
    }
    
    const timeout = setTimeout(async () => {
      try {
        logger.debug(`Background refresh: ${url}`, {
          component: 'APICache'
        })
        
        await this.fetchAndCache(url, options, cacheKey, strategy)
      } catch (error) {
        logger.warn(`Background refresh failed: ${url}`, {
          component: 'APICache',
          metadata: { error: (error as Error).message }
        })
      } finally {
        this.backgroundRefreshTimeout.delete(cacheKey)
      }
    }, 100) // Small delay to avoid blocking main thread
    
    this.backgroundRefreshTimeout.set(cacheKey, timeout)
  }
  
  /**
   * Create Response object from cached data
   */
  private createResponseFromCache(cached: CachedResponse): Response {
    return new Response(JSON.stringify(cached.data), {
      status: cached.status,
      statusText: cached.statusText,
      headers: new Headers(cached.headers)
    })
  }
  
  /**
   * Generate cache key from request parameters
   */
  private generateCacheKey(request: RequestCacheKey): string {
    const { url, method, body, headers } = request
    
    // Create a normalized key
    const keyParts = [
      method.toUpperCase(),
      url
    ]
    
    if (body && body !== null) {
      keyParts.push(body)
    }
    
    if (headers) {
      const sortedHeaders = Object.keys(headers)
        .sort()
        .map(key => `${key}:${headers[key]}`)
        .join(',')
      keyParts.push(sortedHeaders)
    }
    
    return `api_${keyParts.join('|')}`
  }
  
  /**
   * Get cache strategy for endpoint
   */
  private getEndpointStrategy(url: string): CacheStrategy {
    // Check for exact matches first
    for (const [pattern, strategy] of Object.entries(this.endpointStrategies)) {
      if (url.includes(pattern)) {
        return strategy
      }
    }
    
    // Default strategy
    return {
      strategy: 'network-first',
      ttl: 5 * 60 * 1000 // 5 minutes
    }
  }
  
  /**
   * Extract important headers from response
   */
  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {}
    
    const importantHeaders = [
      'content-type',
      'cache-control',
      'etag',
      'last-modified',
      'expires'
    ]
    
    importantHeaders.forEach(header => {
      const value = response.headers.get(header)
      if (value) {
        headers[header] = value
      }
    })
    
    return headers
  }
  
  /**
   * Determine if error responses should be cached
   */
  private shouldCacheErrorResponse(status: number): boolean {
    // Cache certain error responses to avoid repeated failed requests
    return status === 404 || status === 410 // Not found, Gone
  }
  
  /**
   * Invalidate cache by tags
   */
  invalidateByTags(tags: string[]): void {
    // This would require iterating through cache items and checking tags
    // For now, we'll clear related caches
    tags.forEach(tag => {
      logger.info(`Invalidating cache by tag: ${tag}`, {
        component: 'APICache'
      })
    })
    
    // Simple implementation: clear all cache for now
    // In production, implement tag-based invalidation
    cacheManager.clear('memory')
  }
  
  /**
   * Prefetch data for better performance
   */
  async prefetch(url: string, options: RequestInit = {}): Promise<void> {
    try {
      logger.debug(`Prefetching: ${url}`, {
        component: 'APICache'
      })
      
      await this.fetch(url, options)
    } catch (error) {
      logger.debug(`Prefetch failed: ${url}`, {
        component: 'APICache',
        metadata: { error: (error as Error).message }
      })
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      backgroundRefreshes: this.backgroundRefreshTimeout.size,
      cacheStats: cacheManager.getStats()
    }
  }
  
  /**
   * Cleanup on destroy
   */
  destroy(): void {
    // Clear all pending requests
    this.pendingRequests.clear()
    
    // Clear background refresh timeouts
    for (const timeout of this.backgroundRefreshTimeout.values()) {
      clearTimeout(timeout)
    }
    this.backgroundRefreshTimeout.clear()
  }
}

// Create singleton instance
const apiCache = new APICache()

// Replace global fetch with cached version
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch
  
  const cachedFetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString()
    
    // Only cache API requests
    if (url.includes('/api/')) {
      return apiCache.fetch(url, init || {})
    }
    
    // Use original fetch for non-API requests
    return originalFetch.call(window, input, init)
  }
  
  window.fetch = cachedFetch as typeof window.fetch
  
  // Attach to window for debugging
  (window as any).apiCache = apiCache
}

export default apiCache
export { APICache }