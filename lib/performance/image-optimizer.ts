/**
 * Image Optimization and Lazy Loading System
 * 
 * Features:
 * - Intelligent lazy loading with intersection observer
 * - Responsive image generation
 * - WebP/AVIF format optimization
 * - Progressive loading with blur placeholders
 * - Image compression and resizing
 * - Error handling and fallbacks
 * - Performance monitoring integration
 */

import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

export interface ImageOptions {
  src: string
  alt: string
  width?: number
  height?: number
  quality?: number
  formats?: ('webp' | 'avif' | 'jpeg' | 'png')[]
  sizes?: string
  priority?: boolean
  placeholder?: 'blur' | 'empty' | string
  blurDataURL?: string
  lazy?: boolean
  threshold?: number
  rootMargin?: string
  onLoad?: () => void
  onError?: (error: Error) => void
}

export interface ResponsiveImageConfig {
  breakpoints: number[]
  formats: string[]
  quality: number
  devicePixelRatios: number[]
}

class ImageOptimizer {
  private loadedImages = new Set<string>()
  private failedImages = new Set<string>()
  private imageCache = new Map<string, HTMLImageElement>()
  private intersectionObserver?: IntersectionObserver
  private loadingImages = new Map<string, Promise<HTMLImageElement>>()
  
  // Default configuration
  private config: ResponsiveImageConfig = {
    breakpoints: [640, 768, 1024, 1280, 1536],
    formats: ['avif', 'webp', 'jpeg'],
    quality: 75,
    devicePixelRatios: [1, 2]
  }
  
  constructor() {
    this.initializeIntersectionObserver()
    this.initializeImageCache()
  }
  
  /**
   * Initialize intersection observer for lazy loading
   */
  private initializeIntersectionObserver() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return
    }
    
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            const originalSrc = img.dataset.src
            
            if (originalSrc && !this.loadedImages.has(originalSrc)) {
              this.loadImage(img, originalSrc)
              this.intersectionObserver?.unobserve(img)
            }
          }
        })
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    )
  }
  
  /**
   * Initialize image cache management
   */
  private initializeImageCache() {
    // Clean up cache periodically
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.cleanupImageCache()
      }, 5 * 60 * 1000) // 5 minutes
    }
  }
  
  /**
   * Generate optimized image URLs
   */
  generateImageURL(
    src: string,
    width?: number,
    height?: number,
    format: string = 'webp',
    quality: number = 75
  ): string {
    // In a real implementation, this would integrate with a CDN or image service
    const params = new URLSearchParams()
    
    if (width) params.set('w', width.toString())
    if (height) params.set('h', height.toString())
    if (quality !== 75) params.set('q', quality.toString())
    if (format !== 'jpeg') params.set('f', format)
    
    const queryString = params.toString()
    const separator = src.includes('?') ? '&' : '?'
    
    return queryString ? `${src}${separator}${queryString}` : src
  }
  
  /**
   * Generate responsive image sources
   */
  generateSrcSet(
    src: string,
    width: number,
    format: string = 'webp',
    quality: number = 75
  ): string {
    const srcSet: string[] = []
    
    this.config.devicePixelRatios.forEach(ratio => {
      const scaledWidth = Math.round(width * ratio)
      const optimizedSrc = this.generateImageURL(src, scaledWidth, undefined, format, quality)
      srcSet.push(`${optimizedSrc} ${ratio}x`)
    })
    
    return srcSet.join(', ')
  }
  
  /**
   * Generate responsive image sources for different breakpoints
   */
  generateResponsiveSources(
    src: string,
    options: Partial<ImageOptions> = {}
  ): Array<{ media?: string; srcSet: string; type?: string }> {
    const sources: Array<{ media?: string; srcSet: string; type?: string }> = []
    const { formats = ['webp', 'jpeg'], quality = 75 } = options
    
    formats.forEach(format => {
      this.config.breakpoints.forEach((breakpoint, index) => {
        const media = index < this.config.breakpoints.length - 1 
          ? `(max-width: ${breakpoint}px)` 
          : undefined
        
        const srcSet = this.generateSrcSet(src, breakpoint, format, quality)
        
        sources.push({
          media,
          srcSet,
          type: this.getMimeType(format)
        })
      })
    })
    
    return sources
  }
  
  /**
   * Get MIME type for format
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'avif': 'image/avif',
      'webp': 'image/webp',
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml'
    }
    
    return mimeTypes[format.toLowerCase()] || 'image/jpeg'
  }
  
  /**
   * Load image with performance monitoring
   */
  async loadImage(
    imgElement: HTMLImageElement,
    src: string,
    options: Partial<ImageOptions> = {}
  ): Promise<HTMLImageElement> {
    // Check if already loading
    if (this.loadingImages.has(src)) {
      return this.loadingImages.get(src)!
    }
    
    // Check cache first
    if (this.imageCache.has(src)) {
      const cachedImg = this.imageCache.get(src)!
      imgElement.src = cachedImg.src
      this.loadedImages.add(src)
      return cachedImg
    }
    
    const startTime = performance.now()
    
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        const loadTime = performance.now() - startTime
        
        // Update the actual image element
        imgElement.src = img.src
        imgElement.classList.remove('loading')
        imgElement.classList.add('loaded')
        
        // Cache the loaded image
        this.imageCache.set(src, img)
        this.loadedImages.add(src)
        
        // Record performance metrics
        performanceMonitor.recordMetric('image_load_time', loadTime, {
          src,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: this.estimateImageSize(img)
        })
        
        logger.debug(`Image loaded: ${src}`, {
          component: 'ImageOptimizer',
          metadata: {
            loadTime,
            width: img.naturalWidth,
            height: img.naturalHeight
          }
        })
        
        options.onLoad?.()
        resolve(img)
      }
      
      img.onerror = (error) => {
        const loadTime = performance.now() - startTime
        
        this.failedImages.add(src)
        imgElement.classList.remove('loading')
        imgElement.classList.add('error')
        
        // Record error metrics
        performanceMonitor.recordMetric('image_load_error', loadTime, {
          src,
          error: 'Image load failed'
        })
        
        logger.error(`Image load failed: ${src}`, {
          component: 'ImageOptimizer',
          metadata: { loadTime }
        }, new Error('Image load failed'))
        
        const errorEvent = new Error(`Failed to load image: ${src}`)
        options.onError?.(errorEvent)
        reject(errorEvent)
      }
      
      // Set loading class
      imgElement.classList.add('loading')
      
      // Start loading
      img.src = src
    })
    
    this.loadingImages.set(src, loadPromise)
    
    try {
      const result = await loadPromise
      return result
    } catch (error) {
      throw error
    } finally {
      this.loadingImages.delete(src)
    }
  }
  
  /**
   * Setup lazy loading for an image element
   */
  setupLazyLoading(
    imgElement: HTMLImageElement,
    options: ImageOptions
  ): void {
    const { src, lazy = true, threshold = 0.1, rootMargin = '50px' } = options
    
    if (!lazy || !this.intersectionObserver || options.priority) {
      // Load immediately
      this.loadImage(imgElement, src, options)
      return
    }
    
    // Setup lazy loading
    imgElement.dataset.src = src
    imgElement.classList.add('lazy')
    
    // Add placeholder
    if (options.placeholder === 'blur' && options.blurDataURL) {
      imgElement.src = options.blurDataURL
    } else if (options.placeholder && options.placeholder !== 'empty') {
      imgElement.src = options.placeholder
    }
    
    // Observe for intersection
    this.intersectionObserver.observe(imgElement)
  }
  
  /**
   * Generate blur placeholder data URL
   */
  generateBlurPlaceholder(
    width: number = 10,
    height: number = 10,
    color: string = '#f3f4f6'
  ): string {
    if (typeof window === 'undefined') {
      return `data:image/svg+xml;base64,${btoa(`
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="${color}"/>
        </svg>
      `)}`
    }
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return ''
    
    canvas.width = width
    canvas.height = height
    
    // Fill with blur color
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
    
    // Add some blur effect
    ctx.filter = 'blur(2px)'
    
    return canvas.toDataURL('image/jpeg', 0.1)
  }
  
  /**
   * Preload critical images
   */
  preloadImages(imageSources: string[]): Promise<HTMLImageElement[]> {
    logger.debug(`Preloading ${imageSources.length} critical images`, {
      component: 'ImageOptimizer'
    })
    
    const preloadPromises = imageSources.map(src => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        
        img.onload = () => {
          this.imageCache.set(src, img)
          this.loadedImages.add(src)
          resolve(img)
        }
        
        img.onerror = () => {
          this.failedImages.add(src)
          reject(new Error(`Failed to preload image: ${src}`))
        }
        
        img.src = src
      })
    })
    
    return Promise.allSettled(preloadPromises).then(results => {
      const successful: HTMLImageElement[] = []
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value)
        } else {
          logger.warn(`Image preload failed: ${imageSources[index]}`, {
            component: 'ImageOptimizer'
          })
        }
      })
      
      logger.info(`Preloaded ${successful.length}/${imageSources.length} images`, {
        component: 'ImageOptimizer'
      })
      
      return successful
    })
  }
  
  /**
   * Estimate image file size
   */
  private estimateImageSize(img: HTMLImageElement): number {
    // Rough estimation based on dimensions and format
    const pixels = img.naturalWidth * img.naturalHeight
    const bytesPerPixel = 3 // Assume RGB
    return Math.round(pixels * bytesPerPixel * 0.1) // Compression factor
  }
  
  /**
   * Clean up image cache
   */
  private cleanupImageCache(): void {
    const maxCacheSize = 100
    
    if (this.imageCache.size > maxCacheSize) {
      const entries = Array.from(this.imageCache.entries())
      const toRemove = entries.slice(0, entries.length - maxCacheSize)
      
      toRemove.forEach(([src]) => {
        this.imageCache.delete(src)
      })
      
      logger.debug(`Cleaned up image cache, removed ${toRemove.length} entries`, {
        component: 'ImageOptimizer'
      })
    }
  }
  
  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      loadedImages: this.loadedImages.size,
      failedImages: this.failedImages.size,
      cachedImages: this.imageCache.size,
      loadingImages: this.loadingImages.size,
      successRate: this.loadedImages.size / (this.loadedImages.size + this.failedImages.size) * 100 || 0
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResponsiveImageConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    logger.debug('Image optimizer configuration updated', {
      component: 'ImageOptimizer',
      metadata: { config: this.config }
    })
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = undefined
    }
    
    this.imageCache.clear()
    this.loadedImages.clear()
    this.failedImages.clear()
    this.loadingImages.clear()
    
    logger.debug('Image optimizer destroyed', {
      component: 'ImageOptimizer'
    })
  }
}

// Create singleton instance
const imageOptimizer = new ImageOptimizer()

// Attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).imageOptimizer = imageOptimizer
}

export default imageOptimizer
export { ImageOptimizer }

// Utility functions

/**
 * Generate CSS for image optimization
 */
export function generateImageCSS(): string {
  return `
    .lazy {
      opacity: 0;
      transition: opacity 0.3s;
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
  `
}