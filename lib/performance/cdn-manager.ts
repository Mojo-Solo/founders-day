/**
 * CDN Integration and Asset Management System
 * 
 * Features:
 * - Multi-CDN support with failover
 * - Intelligent asset routing
 * - Performance monitoring for CDN endpoints
 * - Cache invalidation management
 * - Edge location optimization
 * - Asset versioning and fingerprinting
 */

import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

export interface CDNProvider {
  name: string
  baseUrl: string
  priority: number
  regions: string[]
  capabilities: CDNCapabilities
  healthCheck?: string
  apiKey?: string
}

export interface CDNCapabilities {
  imageOptimization: boolean
  videoStreaming: boolean
  edgeComputing: boolean
  customDomains: boolean
  realTimeAnalytics: boolean
  brotliCompression: boolean
}

export interface AssetConfig {
  type: 'image' | 'video' | 'document' | 'script' | 'style' | 'font'
  path: string
  version?: string
  optimization?: {
    format?: string
    quality?: number
    width?: number
    height?: number
  }
  cacheControl?: string
  priority?: 'high' | 'medium' | 'low'
  fallback?: string
}

class CDNManager {
  private providers: CDNProvider[] = []
  private healthStatus = new Map<string, boolean>()
  private performanceMetrics = new Map<string, number[]>()
  private failoverAttempts = new Map<string, number>()
  private assetCache = new Map<string, string>()
  
  // Default CDN providers
  private defaultProviders: CDNProvider[] = [
    {
      name: 'Vercel Edge Network',
      baseUrl: '/_next/static',
      priority: 1,
      regions: ['global'],
      capabilities: {
        imageOptimization: true,
        videoStreaming: false,
        edgeComputing: true,
        customDomains: true,
        realTimeAnalytics: true,
        brotliCompression: true
      }
    },
    {
      name: 'Cloudflare',
      baseUrl: 'https://cdn.example.com',
      priority: 2,
      regions: ['global'],
      capabilities: {
        imageOptimization: true,
        videoStreaming: true,
        edgeComputing: true,
        customDomains: true,
        realTimeAnalytics: true,
        brotliCompression: true
      }
    },
    {
      name: 'AWS CloudFront',
      baseUrl: 'https://d1234567890.cloudfront.net',
      priority: 3,
      regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
      capabilities: {
        imageOptimization: true,
        videoStreaming: true,
        edgeComputing: false,
        customDomains: true,
        realTimeAnalytics: false,
        brotliCompression: true
      }
    }
  ]
  
  constructor() {
    this.providers = [...this.defaultProviders]
    this.initializeHealthChecks()
    this.initializePerformanceMonitoring()
  }
  
  /**
   * Initialize health checks for CDN providers
   */
  private initializeHealthChecks(): void {
    if (typeof window === 'undefined') return
    
    // Initial health check
    this.checkAllProviderHealth()
    
    // Periodic health checks
    setInterval(() => {
      this.checkAllProviderHealth()
    }, 5 * 60 * 1000) // Every 5 minutes
  }
  
  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    if (typeof window === 'undefined') return
    
    // Monitor resource loading performance
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resource = entry as PerformanceResourceTiming
          this.recordCDNPerformance(resource.name, resource.duration)
        }
      })
      
      observer.observe({ entryTypes: ['resource'] })
    }
  }
  
  /**
   * Check health of all CDN providers
   */
  private async checkAllProviderHealth(): Promise<void> {
    const healthPromises = this.providers.map(provider => 
      this.checkProviderHealth(provider)
    )
    
    await Promise.allSettled(healthPromises)
    
    const healthyProviders = this.providers.filter(p => this.healthStatus.get(p.name))
    
    logger.info(`CDN health check completed: ${healthyProviders.length}/${this.providers.length} healthy`, {
      component: 'CDNManager',
      metadata: {
        healthyProviders: healthyProviders.map(p => p.name),
        unhealthyProviders: this.providers.filter(p => !this.healthStatus.get(p.name)).map(p => p.name)
      }
    })
  }
  
  /**
   * Check health of a specific CDN provider
   */
  private async checkProviderHealth(provider: CDNProvider): Promise<boolean> {
    try {
      const startTime = performance.now()
      const healthCheckUrl = provider.healthCheck || `${provider.baseUrl}/health`
      
      const response = await fetch(healthCheckUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      })
      
      const responseTime = performance.now() - startTime
      const isHealthy = response.ok || response.type === 'opaque' // no-cors returns opaque
      
      this.healthStatus.set(provider.name, isHealthy)
      this.recordCDNPerformance(provider.name, responseTime)
      
      if (isHealthy) {
        this.failoverAttempts.delete(provider.name)
      }
      
      return isHealthy
    } catch (error) {
      logger.warn(`CDN health check failed: ${provider.name}`, {
        component: 'CDNManager',
        metadata: { error: (error as Error).message }
      })
      
      this.healthStatus.set(provider.name, false)
      return false
    }
  }
  
  /**
   * Record CDN performance metrics
   */
  private recordCDNPerformance(providerName: string, responseTime: number): void {
    if (!this.performanceMetrics.has(providerName)) {
      this.performanceMetrics.set(providerName, [])
    }
    
    const metrics = this.performanceMetrics.get(providerName)!
    metrics.push(responseTime)
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift()
    }
    
    // Record in performance monitor
    performanceMonitor.recordMetric('cdn_response_time', responseTime, {
      provider: providerName
    })
  }
  
  /**
   * Get the best CDN provider for a given asset type
   */
  getBestProvider(assetType: AssetConfig['type'], region?: string): CDNProvider | null {
    const healthyProviders = this.providers.filter(provider => {
      const isHealthy = this.healthStatus.get(provider.name) !== false
      const supportsRegion = !region || provider.regions.includes(region) || provider.regions.includes('global')
      const hasCapability = this.hasRequiredCapability(provider, assetType)
      
      return isHealthy && supportsRegion && hasCapability
    })
    
    if (healthyProviders.length === 0) {
      logger.warn('No healthy CDN providers available', {
        component: 'CDNManager',
        metadata: { assetType, region }
      })
      return null
    }
    
    // Sort by priority and performance
    healthyProviders.sort((a, b) => {
      const aPerfScore = this.getPerformanceScore(a.name)
      const bPerfScore = this.getPerformanceScore(b.name)
      
      // First by priority, then by performance
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      
      return aPerfScore - bPerfScore
    })
    
    return healthyProviders[0]
  }
  
  /**
   * Check if provider has required capability for asset type
   */
  private hasRequiredCapability(provider: CDNProvider, assetType: AssetConfig['type']): boolean {
    switch (assetType) {
      case 'image':
        return provider.capabilities.imageOptimization
      case 'video':
        return provider.capabilities.videoStreaming
      default:
        return true // Basic capability for other assets
    }
  }
  
  /**
   * Get performance score for a provider
   */
  private getPerformanceScore(providerName: string): number {
    const metrics = this.performanceMetrics.get(providerName) || []
    
    if (metrics.length === 0) return 1000 // Default high score for untested providers
    
    // Calculate average response time
    const average = metrics.reduce((sum, time) => sum + time, 0) / metrics.length
    return average
  }
  
  /**
   * Generate optimized asset URL
   */
  getAssetURL(config: AssetConfig, region?: string): string {
    const cacheKey = `${config.path}-${JSON.stringify(config.optimization)}-${region}`
    
    // Check cache first
    if (this.assetCache.has(cacheKey)) {
      return this.assetCache.get(cacheKey)!
    }
    
    const provider = this.getBestProvider(config.type, region)
    
    if (!provider) {
      // Fallback to original path or fallback URL
      const fallbackUrl = config.fallback || config.path
      this.assetCache.set(cacheKey, fallbackUrl)
      return fallbackUrl
    }
    
    let assetUrl = `${provider.baseUrl}${config.path}`
    
    // Add version/fingerprint
    if (config.version) {
      const separator = assetUrl.includes('?') ? '&' : '?'
      assetUrl += `${separator}v=${config.version}`
    }
    
    // Add optimization parameters
    if (config.optimization && provider.capabilities.imageOptimization) {
      assetUrl = this.addOptimizationParams(assetUrl, config.optimization)
    }
    
    // Cache the result
    this.assetCache.set(cacheKey, assetUrl)
    
    logger.debug(`Generated CDN URL: ${config.path}`, {
      component: 'CDNManager',
      metadata: {
        provider: provider.name,
        assetUrl,
        region
      }
    })
    
    return assetUrl
  }
  
  /**
   * Add optimization parameters to URL
   */
  private addOptimizationParams(url: string, optimization: AssetConfig['optimization']): string {
    if (!optimization) return url
    
    const params = new URLSearchParams()
    
    if (optimization.format) params.set('format', optimization.format)
    if (optimization.quality) params.set('quality', optimization.quality.toString())
    if (optimization.width) params.set('width', optimization.width.toString())
    if (optimization.height) params.set('height', optimization.height.toString())
    
    const paramString = params.toString()
    if (!paramString) return url
    
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}${paramString}`
  }
  
  /**
   * Preload critical assets
   */
  async preloadAssets(configs: AssetConfig[], region?: string): Promise<void> {
    logger.info(`Preloading ${configs.length} critical assets`, {
      component: 'CDNManager'
    })
    
    const preloadPromises = configs.map(async (config) => {
      try {
        const assetUrl = this.getAssetURL(config, region)
        
        // Create preload link
        if (typeof document !== 'undefined') {
          const link = document.createElement('link')
          link.rel = 'preload'
          link.href = assetUrl
          link.as = this.getPreloadAs(config.type)
          
          if (config.type === 'font') {
            link.crossOrigin = 'anonymous'
          }
          
          document.head.appendChild(link)
        }
        
        return assetUrl
      } catch (error) {
        logger.warn(`Failed to preload asset: ${config.path}`, {
          component: 'CDNManager',
          metadata: { error: (error as Error).message }
        })
        
        return null
      }
    })
    
    const results = await Promise.allSettled(preloadPromises)
    const successful = results.filter(r => r.status === 'fulfilled').length
    
    logger.info(`Preloaded ${successful}/${configs.length} assets`, {
      component: 'CDNManager'
    })
  }
  
  /**
   * Get preload 'as' attribute for asset type
   */
  private getPreloadAs(assetType: AssetConfig['type']): string {
    const mapping: Record<AssetConfig['type'], string> = {
      image: 'image',
      video: 'video',
      document: 'document',
      script: 'script',
      style: 'style',
      font: 'font'
    }
    
    return mapping[assetType] || 'fetch'
  }
  
  /**
   * Invalidate CDN cache for specific assets
   */
  async invalidateCache(paths: string[]): Promise<void> {
    logger.info(`Invalidating CDN cache for ${paths.length} assets`, {
      component: 'CDNManager',
      metadata: { paths }
    })
    
    // Clear local cache
    paths.forEach(path => {
      for (const [key, value] of this.assetCache.entries()) {
        if (value.includes(path)) {
          this.assetCache.delete(key)
        }
      }
    })
    
    // In a real implementation, this would make API calls to CDN providers
    // to invalidate their edge caches
    
    logger.info('CDN cache invalidation completed', {
      component: 'CDNManager'
    })
  }
  
  /**
   * Get CDN statistics and health status
   */
  getStats() {
    const providerStats = this.providers.map(provider => ({
      name: provider.name,
      healthy: this.healthStatus.get(provider.name) !== false,
      averageResponseTime: this.getPerformanceScore(provider.name),
      priority: provider.priority,
      failoverAttempts: this.failoverAttempts.get(provider.name) || 0
    }))
    
    return {
      totalProviders: this.providers.length,
      healthyProviders: providerStats.filter(p => p.healthy).length,
      cachedAssets: this.assetCache.size,
      providerStats
    }
  }
  
  /**
   * Update CDN provider configuration
   */
  updateProvider(name: string, updates: Partial<CDNProvider>): void {
    const providerIndex = this.providers.findIndex(p => p.name === name)
    
    if (providerIndex !== -1) {
      this.providers[providerIndex] = { ...this.providers[providerIndex], ...updates }
      
      logger.info(`CDN provider updated: ${name}`, {
        component: 'CDNManager',
        metadata: { updates }
      })
    }
  }
  
  /**
   * Add new CDN provider
   */
  addProvider(provider: CDNProvider): void {
    this.providers.push(provider)
    this.providers.sort((a, b) => a.priority - b.priority)
    
    logger.info(`CDN provider added: ${provider.name}`, {
      component: 'CDNManager',
      metadata: { provider }
    })
    
    // Initial health check for new provider
    this.checkProviderHealth(provider)
  }
  
  /**
   * Remove CDN provider
   */
  removeProvider(name: string): void {
    const initialLength = this.providers.length
    this.providers = this.providers.filter(p => p.name !== name)
    
    if (this.providers.length < initialLength) {
      this.healthStatus.delete(name)
      this.performanceMetrics.delete(name)
      this.failoverAttempts.delete(name)
      
      logger.info(`CDN provider removed: ${name}`, {
        component: 'CDNManager'
      })
    }
  }
  
  /**
   * Clear all caches
   */
  clearCache(): void {
    this.assetCache.clear()
    
    logger.info('CDN cache cleared', {
      component: 'CDNManager'
    })
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.assetCache.clear()
    this.healthStatus.clear()
    this.performanceMetrics.clear()
    this.failoverAttempts.clear()
    
    logger.info('CDN manager destroyed', {
      component: 'CDNManager'
    })
  }
}

// Create singleton instance
const cdnManager = new CDNManager()

// Attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).cdnManager = cdnManager
}

export default cdnManager
export { CDNManager }

// Convenience functions

/**
 * Get optimized image URL
 */
export function getImageURL(
  path: string,
  options: {
    width?: number
    height?: number
    quality?: number
    format?: string
  } = {}
): string {
  return cdnManager.getAssetURL({
    type: 'image',
    path,
    optimization: options
  })
}

/**
 * Get static asset URL
 */
export function getStaticURL(path: string, version?: string): string {
  return cdnManager.getAssetURL({
    type: 'document',
    path,
    version
  })
}

/**
 * Preload critical images
 */
export function preloadImages(imagePaths: string[]): Promise<void> {
  const configs: AssetConfig[] = imagePaths.map(path => ({
    type: 'image',
    path,
    priority: 'high'
  }))
  
  return cdnManager.preloadAssets(configs)
}