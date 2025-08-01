/**
 * Bundle Size Optimization and Code Splitting Utilities
 * 
 * Features:
 * - Dynamic imports for large components
 * - Route-based code splitting
 * - Vendor chunk optimization
 * - Tree shaking utilities
 * - Bundle analysis helpers
 * - Progressive loading strategies
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react'
import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

// Interface for dynamic import options
interface DynamicImportOptions {
  loading?: ComponentType
  error?: ComponentType<{ error: Error; retry: () => void }>
  timeout?: number
  preload?: boolean
  chunkName?: string
}

// Interface for route-based splitting configuration
interface RouteConfig {
  path: string
  component: string
  preload?: boolean
  priority?: 'high' | 'medium' | 'low'
  dependencies?: string[]
}

class BundleOptimizer {
  private loadedChunks = new Set<string>()
  private preloadedChunks = new Set<string>()
  private chunkLoadPromises = new Map<string, Promise<any>>()
  
  /**
   * Dynamic import with performance monitoring and error handling
   */
  dynamicImport<T extends ComponentType<any> = ComponentType<any>>(
    importFunction: () => Promise<{ default: T }>,
    options: DynamicImportOptions = {}
  ): LazyExoticComponent<T> {
    const {
      timeout = 10000,
      chunkName = 'dynamic-chunk',
      preload = false
    } = options
    
    // Create lazy component with enhanced error handling
    const LazyComponent = lazy(() => {
      const startTime = performance.now()
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Dynamic import timeout after ${timeout}ms`))
        }, timeout)
      })
      
      // Race between import and timeout
      return Promise.race([
        importFunction(),
        timeoutPromise
      ]).then(
        (module) => {
          const loadTime = performance.now() - startTime
          
          // Track chunk loading performance
          performanceMonitor.recordMetric('chunk_load_time', loadTime, {
            chunkName,
            success: true
          })
          
          logger.debug(`Chunk loaded: ${chunkName}`, {
            component: 'BundleOptimizer',
            metadata: {
              loadTime,
              chunkName
            }
          })
          
          this.loadedChunks.add(chunkName)
          return module
        },
        (error) => {
          const loadTime = performance.now() - startTime
          
          performanceMonitor.recordMetric('chunk_load_error', loadTime, {
            chunkName,
            success: false,
            error: error.message
          })
          
          logger.error(`Chunk load failed: ${chunkName}`, {
            component: 'BundleOptimizer',
            metadata: {
              loadTime,
              chunkName,
              error: error.message
            }
          }, error)
          
          throw error
        }
      )
    })
    
    // Preload chunk if requested
    if (preload) {
      this.preloadChunk(importFunction, chunkName)
    }
    
    return LazyComponent
  }
  
  /**
   * Preload chunks for better performance
   */
  async preloadChunk(
    importFunction: () => Promise<any>,
    chunkName: string
  ): Promise<void> {
    if (this.preloadedChunks.has(chunkName) || this.loadedChunks.has(chunkName)) {
      return
    }
    
    // Check if already preloading
    if (this.chunkLoadPromises.has(chunkName)) {
      return this.chunkLoadPromises.get(chunkName)
    }
    
    logger.debug(`Preloading chunk: ${chunkName}`, {
      component: 'BundleOptimizer'
    })
    
    const preloadPromise = this.loadChunkWithRetry(importFunction, chunkName, 3)
    this.chunkLoadPromises.set(chunkName, preloadPromise)
    
    try {
      await preloadPromise
      this.preloadedChunks.add(chunkName)
      
      logger.debug(`Chunk preloaded successfully: ${chunkName}`, {
        component: 'BundleOptimizer'
      })
    } catch (error) {
      logger.warn(`Chunk preload failed: ${chunkName}`, {
        component: 'BundleOptimizer',
        metadata: { error: (error as Error).message }
      })
    } finally {
      this.chunkLoadPromises.delete(chunkName)
    }
  }
  
  /**
   * Load chunk with retry logic
   */
  private async loadChunkWithRetry(
    importFunction: () => Promise<any>,
    chunkName: string,
    maxRetries: number
  ): Promise<any> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = performance.now()
        const result = await importFunction()
        const loadTime = performance.now() - startTime
        
        performanceMonitor.recordMetric('chunk_preload_time', loadTime, {
          chunkName,
          attempt,
          success: true
        })
        
        return result
      } catch (error) {
        lastError = error as Error
        
        logger.debug(`Chunk load attempt ${attempt} failed: ${chunkName}`, {
          component: 'BundleOptimizer',
          metadata: {
            attempt,
            maxRetries,
            error: lastError.message
          }
        })
        
        // Exponential backoff for retries
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError
  }
  
  /**
   * Route-based code splitting helper
   */
  createRouteComponents(routes: RouteConfig[]): Record<string, LazyExoticComponent<any>> {
    const components: Record<string, LazyExoticComponent<any>> = {}
    
    routes.forEach(route => {
      const importFunction = () => import(
        /* webpackChunkName: "[request]" */
        /* webpackMode: "lazy" */
        route.component
      )
      
      components[route.path] = this.dynamicImport(importFunction, {
        chunkName: `route-${route.path.replace('/', '')}`,
        preload: route.preload || route.priority === 'high'
      })
      
      // Preload high priority routes
      if (route.priority === 'high') {
        setTimeout(() => {
          this.preloadChunk(importFunction, `route-${route.path}`)
        }, 100)
      }
    })
    
    return components
  }
  
  /**
   * Progressive loading with intersection observer
   */
  createProgressiveComponent<T extends ComponentType<any> = ComponentType<any>>(
    importFunction: () => Promise<{ default: T }>,
    options: DynamicImportOptions & {
      threshold?: number
      rootMargin?: string
    } = {}
  ): LazyExoticComponent<T> {
    const {
      threshold = 0.1,
      rootMargin = '50px',
      chunkName = 'progressive-chunk'
    } = options
    
    let hasBeenObserved = false
    
    const LazyComponent = lazy(async () => {
      // If component hasn't been observed yet, wait for intersection
      if (!hasBeenObserved && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
        await new Promise<void>((resolve) => {
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  hasBeenObserved = true
                  observer.disconnect()
                  resolve()
                }
              })
            },
            { threshold, rootMargin }
          )
          
          // Observe a placeholder element or document body
          const targetElement = document.querySelector(`[data-progressive-chunk="${chunkName}"]`) || document.body
          observer.observe(targetElement)
          
          // Fallback timeout
          setTimeout(() => {
            hasBeenObserved = true
            observer.disconnect()
            resolve()
          }, 5000)
        })
      }
      
      const startTime = performance.now()
      const module = await importFunction()
      const loadTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('progressive_chunk_load', loadTime, {
        chunkName,
        wasObserved: hasBeenObserved
      })
      
      return module
    })
    
    return LazyComponent
  }
  
  /**
   * Feature-based code splitting
   */
  createFeatureBundle<T extends ComponentType<any> = ComponentType<any>>(
    features: string[],
    importFunction: () => Promise<{ default: T }>,
    options: DynamicImportOptions = {}
  ): LazyExoticComponent<T> {
    const chunkName = `feature-${features.join('-')}`
    
    return this.dynamicImport(importFunction, {
      ...options,
      chunkName
    })
  }
  
  /**
   * Vendor chunk optimization helper
   */
  optimizeVendorChunks() {
    // Information about vendor chunk splitting strategies
    const vendorStrategies = {
      react: ['react', 'react-dom'],
      ui: ['@headlessui/react', '@heroicons/react'],
      forms: ['react-hook-form', 'zod'],
      animations: ['framer-motion'],
      monitoring: ['@sentry/nextjs', 'web-vitals'],
      utils: ['date-fns', 'clsx', 'tailwind-merge']
    }
    
    logger.info('Vendor chunk optimization strategies', {
      component: 'BundleOptimizer',
      metadata: { vendorStrategies }
    })
    
    return vendorStrategies
  }
  
  /**
   * Tree shaking helper - identify unused exports
   */
  analyzeTreeShaking() {
    const treeShakingTips = [
      'Use named imports instead of default imports where possible',
      'Avoid importing entire libraries when only specific functions are needed',
      'Use dynamic imports for large dependencies that are conditionally used',
      'Enable sideEffects: false in package.json for pure modules',
      'Use webpack-bundle-analyzer to identify large unused dependencies'
    ]
    
    logger.debug('Tree shaking optimization tips', {
      component: 'BundleOptimizer',
      metadata: { treeShakingTips }
    })
    
    return treeShakingTips
  }
  
  /**
   * Bundle analysis utilities
   */
  getBundleStats() {
    return {
      loadedChunks: Array.from(this.loadedChunks),
      preloadedChunks: Array.from(this.preloadedChunks),
      pendingChunks: Array.from(this.chunkLoadPromises.keys()),
      totalChunks: this.loadedChunks.size + this.preloadedChunks.size,
      cacheHitRate: this.preloadedChunks.size / (this.loadedChunks.size || 1) * 100
    }
  }
  
  /**
   * Resource hints for performance
   */
  generateResourceHints(): string[] {
    const hints: string[] = []
    
    // DNS prefetch for external domains
    const externalDomains = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdn.jsdelivr.net'
    ]
    
    externalDomains.forEach(domain => {
      hints.push(`<link rel="dns-prefetch" href="//${domain}">`)
    })
    
    // Preconnect for critical external resources
    hints.push(`<link rel="preconnect" href="//fonts.googleapis.com" crossorigin>`)
    hints.push(`<link rel="preconnect" href="//fonts.gstatic.com" crossorigin>`)
    
    return hints
  }
  
  /**
   * Critical resource preloading
   */
  preloadCriticalResources() {
    if (typeof window === 'undefined') return
    
    const criticalResources = [
      { href: '/favicon.ico', as: 'image' },
      { href: '/manifest.json', as: 'fetch', crossorigin: 'anonymous' }
    ]
    
    criticalResources.forEach(resource => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = resource.href
      link.as = resource.as
      if (resource.crossorigin) {
        link.crossOrigin = resource.crossorigin
      }
      
      document.head.appendChild(link)
    })
    
    logger.debug('Critical resources preloaded', {
      component: 'BundleOptimizer',
      metadata: { resourceCount: criticalResources.length }
    })
  }
  
  /**
   * Clean up loaded chunks (for SPA navigation)
   */
  cleanup() {
    this.loadedChunks.clear()
    this.preloadedChunks.clear()
    
    // Cancel pending chunk loads
    this.chunkLoadPromises.clear()
    
    logger.debug('Bundle optimizer cleaned up', {
      component: 'BundleOptimizer'
    })
  }
}

// Create singleton instance
const bundleOptimizer = new BundleOptimizer()

// Attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).bundleOptimizer = bundleOptimizer
}

export default bundleOptimizer
export { BundleOptimizer }

// Convenience functions for common use cases

/**
 * Quick dynamic import with sensible defaults
 */
export function lazyLoad<T extends ComponentType<any> = ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  chunkName?: string
): LazyExoticComponent<T> {
  return bundleOptimizer.dynamicImport(importFunction, {
    chunkName: chunkName || 'lazy-component'
  })
}

/**
 * Progressive loading component
 */
export function progressiveLoad<T extends ComponentType<any> = ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  chunkName?: string
): LazyExoticComponent<T> {
  return bundleOptimizer.createProgressiveComponent(importFunction, {
    chunkName: chunkName || 'progressive-component'
  })
}

/**
 * Feature-based bundle
 */
export function featureBundle<T extends ComponentType<any> = ComponentType<any>>(
  features: string[],
  importFunction: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return bundleOptimizer.createFeatureBundle(features, importFunction)
}