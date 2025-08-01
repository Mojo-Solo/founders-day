/**
 * Performance Optimization Initialization
 * 
 * Centralized initialization for all performance optimization features:
 * - Cache management
 * - API caching
 * - Service worker registration
 * - Bundle optimization
 * - Image optimization
 * - CDN management
 * - Performance monitoring integration
 */

import cacheManager from '../cache/cache-manager'
import apiCache from '../cache/api-cache'
import bundleOptimizer from './bundle-optimizer'
import imageOptimizer from './image-optimizer'
import cdnManager from './cdn-manager'
import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

export interface PerformanceConfig {
  enableServiceWorker?: boolean
  enableAPICache?: boolean
  enableImageOptimization?: boolean
  enableCDN?: boolean
  enableBundleOptimization?: boolean
  preloadCriticalAssets?: boolean
  cacheStrategies?: {
    static?: number
    dynamic?: number
    api?: number
  }
}

class PerformanceInitializer {
  private isInitialized = false
  private config: PerformanceConfig = {}
  
  /**
   * Initialize all performance optimizations
   */
  async initialize(config: PerformanceConfig = {}): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Performance optimizer already initialized', {
        component: 'PerformanceInitializer'
      })
      return
    }
    
    this.config = {
      enableServiceWorker: true,
      enableAPICache: true,
      enableImageOptimization: true,
      enableCDN: true,
      enableBundleOptimization: true,
      preloadCriticalAssets: true,
      cacheStrategies: {
        static: 24 * 60 * 60 * 1000, // 24 hours
        dynamic: 60 * 60 * 1000,     // 1 hour
        api: 30 * 60 * 1000          // 30 minutes
      },
      ...config
    }
    
    const startTime = performance.now()
    
    logger.info('Initializing performance optimizations...', {
      component: 'PerformanceInitializer',
      metadata: { config: this.config }
    })
    
    try {
      // Initialize in parallel for better performance
      await Promise.all([
        this.initializeServiceWorker(),
        this.initializeAPICache(),
        this.initializeImageOptimization(),
        this.initializeCDN(),
        this.initializeBundleOptimization(),
        this.setupPerformanceMonitoring()
      ])
      
      // Preload critical assets after other initialization
      if (this.config.preloadCriticalAssets) {
        await this.preloadCriticalAssets()
      }
      
      this.isInitialized = true
      
      const initTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('performance_init_time', initTime, {
        success: true,
        features: Object.keys(this.config).filter(key => this.config[key as keyof PerformanceConfig])
      })
      
      logger.info(`Performance optimizations initialized successfully in ${initTime.toFixed(2)}ms`, {
        component: 'PerformanceInitializer',
        metadata: {
          initTime,
          enabledFeatures: Object.keys(this.config).filter(key => this.config[key as keyof PerformanceConfig])
        }
      })
      
      // Setup cleanup on page unload
      this.setupCleanup()
      
    } catch (error) {
      const initTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('performance_init_error', initTime, {
        success: false,
        error: (error as Error).message
      })
      
      logger.error('Failed to initialize performance optimizations', {
        component: 'PerformanceInitializer',
        metadata: { initTime }
      }, error as Error)
      
      throw error
    }
  }
  
  /**
   * Initialize service worker
   */
  private async initializeServiceWorker(): Promise<void> {
    if (!this.config.enableServiceWorker || typeof window === 'undefined') {
      return
    }
    
    if (!('serviceWorker' in navigator)) {
      logger.warn('Service Worker not supported', {
        component: 'PerformanceInitializer'
      })
      return
    }
    
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })
      
      logger.info('Service Worker registered successfully', {
        component: 'PerformanceInitializer',
        metadata: {
          scope: registration.scope,
          updateViaCache: registration.updateViaCache
        }
      })
      
      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              logger.info('New service worker available', {
                component: 'PerformanceInitializer'
              })
              
              // Optionally notify user about update
              this.notifyServiceWorkerUpdate()
            }
          })
        }
      })
      
      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data)
      })
      
    } catch (error) {
      logger.error('Service Worker registration failed', {
        component: 'PerformanceInitializer'
      }, error as Error)
    }
  }
  
  /**
   * Initialize API cache
   */
  private async initializeAPICache(): Promise<void> {
    if (!this.config.enableAPICache) {
      return
    }
    
    // API cache is automatically initialized when imported
    logger.debug('API cache initialized', {
      component: 'PerformanceInitializer'
    })
  }
  
  /**
   * Initialize image optimization
   */
  private async initializeImageOptimization(): Promise<void> {
    if (!this.config.enableImageOptimization) {
      return
    }
    
    // Update image optimizer configuration
    imageOptimizer.updateConfig({
      breakpoints: [640, 768, 1024, 1280, 1536],
      formats: ['avif', 'webp', 'jpeg'],
      quality: 80,
      devicePixelRatios: [1, 2]
    })
    
    // Add image optimization CSS
    if (typeof document !== 'undefined') {
      const styleSheet = document.createElement('style')
      styleSheet.textContent = this.generateImageOptimizationCSS()
      document.head.appendChild(styleSheet)
    }
    
    logger.debug('Image optimization initialized', {
      component: 'PerformanceInitializer'
    })
  }
  
  /**
   * Initialize CDN management
   */
  private async initializeCDN(): Promise<void> {
    if (!this.config.enableCDN) {
      return
    }
    
    // CDN manager is automatically initialized when imported
    logger.debug('CDN management initialized', {
      component: 'PerformanceInitializer'
    })
  }
  
  /**
   * Initialize bundle optimization
   */
  private async initializeBundleOptimization(): Promise<void> {
    if (!this.config.enableBundleOptimization) {
      return
    }
    
    // Preload critical resources
    bundleOptimizer.preloadCriticalResources()
    
    logger.debug('Bundle optimization initialized', {
      component: 'PerformanceInitializer'
    })
  }
  
  /**
   * Setup performance monitoring
   */
  private async setupPerformanceMonitoring(): Promise<void> {
    // Set up performance monitoring for our optimization features
    performanceMonitor.recordMetric('performance_optimizer_loaded', performance.now(), {
      timestamp: Date.now()
    })
    
    // Monitor cache hit rates
    setInterval(() => {
      if (typeof window !== 'undefined') {
        const cacheStats = cacheManager.getStats()
        const apiCacheStats = apiCache.getStats()
        const imageStats = imageOptimizer.getStats()
        const bundleStats = bundleOptimizer.getBundleStats()
        const cdnStats = cdnManager.getStats()
        
        performanceMonitor.recordMetric('cache_hit_rate', cacheStats.hitRate, {
          type: 'browser_cache'
        })
        
        performanceMonitor.recordMetric('image_success_rate', imageStats.successRate, {
          type: 'image_optimization'
        })
        
        logger.debug('Performance optimization metrics', {
          component: 'PerformanceInitializer',
          metadata: {
            cache: cacheStats,
            apiCache: apiCacheStats,
            images: imageStats,
            bundles: bundleStats,
            cdn: cdnStats
          }
        })
      }
    }, 60000) // Every minute
  }
  
  /**
   * Preload critical assets
   */
  private async preloadCriticalAssets(): Promise<void> {
    const criticalAssets = [
      { type: 'image' as const, path: '/favicon.ico', priority: 'high' as const },
      { type: 'document' as const, path: '/manifest.json', priority: 'high' as const }
    ]
    
    // Preload critical images
    const criticalImagePaths = [
      '/images/founders/bill-w.jpg',
      '/images/founders/dr-bob.jpg'
    ]
    
    await Promise.all([
      cdnManager.preloadAssets(criticalAssets),
      imageOptimizer.preloadImages(criticalImagePaths)
    ])
    
    logger.info('Critical assets preloaded', {
      component: 'PerformanceInitializer',
      metadata: {
        assets: criticalAssets.length,
        images: criticalImagePaths.length
      }
    })
  }
  
  /**
   * Handle service worker messages
   */
  private handleServiceWorkerMessage(data: any): void {
    if (data && data.type) {
      switch (data.type) {
        case 'registration-sync-success':
          logger.info('Registration synced successfully', {
            component: 'PerformanceInitializer',
            metadata: data.data
          })
          break
          
        case 'volunteer-sync-success':
          logger.info('Volunteer application synced successfully', {
            component: 'PerformanceInitializer',
            metadata: data.data
          })
          break
          
        default:
          logger.debug('Service worker message received', {
            component: 'PerformanceInitializer',
            metadata: data
          })
      }
    }
  }
  
  /**
   * Notify user about service worker update
   */
  private notifyServiceWorkerUpdate(): void {
    // In a real app, you might show a toast notification
    logger.info('New version available - reload to update', {
      component: 'PerformanceInitializer'
    })
  }
  
  /**
   * Generate CSS for image optimization
   */
  private generateImageOptimizationCSS(): string {
    return `
      .lazy {
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
      }
      
      .lazy.loading {
        opacity: 0.5;
      }
      
      .lazy.loaded {
        opacity: 1;
      }
      
      .lazy.error {
        opacity: 0.3;
        background-color: #f3f4f6;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' /%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: center;
        background-size: 2rem 2rem;
      }
      
      img {
        height: auto;
        max-width: 100%;
      }
      
      picture {
        display: block;
      }
      
      /* Progressive enhancement for supported formats */
      @supports (object-fit: cover) {
        img {
          object-fit: cover;
        }
      }
      
      /* Reduce motion for accessibility */
      @media (prefers-reduced-motion: reduce) {
        .lazy {
          transition: none;
        }
      }
    `
  }
  
  /**
   * Setup cleanup on page unload
   */
  private setupCleanup(): void {
    if (typeof window === 'undefined') return
    
    window.addEventListener('beforeunload', () => {
      this.cleanup()
    })
    
    // Cleanup on visibility change (for SPAs)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.cleanup()
      }
    })
  }
  
  /**
   * Get performance statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      config: this.config,
      cache: cacheManager.getStats(),
      apiCache: apiCache.getStats(),
      images: imageOptimizer.getStats(),
      bundles: bundleOptimizer.getBundleStats(),
      cdn: cdnManager.getStats()
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    logger.info('Performance configuration updated', {
      component: 'PerformanceInitializer',
      metadata: { newConfig }
    })
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    logger.debug('Cleaning up performance optimizations', {
      component: 'PerformanceInitializer'
    })
    
    // Cleanup individual modules
    bundleOptimizer.cleanup()
    imageOptimizer.destroy()
    cdnManager.destroy()
    cacheManager.destroy()
    apiCache.destroy()
  }
  
  /**
   * Reset all optimizations (useful for testing)
   */
  reset(): void {
    this.cleanup()
    this.isInitialized = false
    this.config = {}
    
    logger.info('Performance optimizations reset', {
      component: 'PerformanceInitializer'
    })
  }
}

// Create singleton instance
const performanceInitializer = new PerformanceInitializer()

// Auto-initialize on import in browser environment
if (typeof window !== 'undefined') {
  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      performanceInitializer.initialize()
    })
  } else {
    // DOM is already ready
    performanceInitializer.initialize()
  }
}

// Attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).performanceOptimizer = performanceInitializer
}

export default performanceInitializer
export { PerformanceInitializer }

// Convenience functions for manual initialization
export async function initializePerformanceOptimizations(config?: PerformanceConfig): Promise<void> {
  return performanceInitializer.initialize(config)
}

export function getPerformanceStats() {
  return performanceInitializer.getStats()
}