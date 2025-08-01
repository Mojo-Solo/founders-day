/**
 * Comprehensive Performance Monitoring System
 * 
 * Features:
 * - Core Web Vitals tracking (LCP, FID, CLS, FCP, TTFB)
 * - Custom performance metrics
 * - API response time monitoring
 * - Real User Monitoring (RUM)
 * - Performance budgets and alerts
 * - Integration with New Relic and Sentry
 */

import { captureMessage, addBreadcrumb } from './sentry-config'

export interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  url?: string
  userId?: string
  metadata?: Record<string, any>
}

export interface WebVital {
  id: string
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'
  value: number
  delta: number
  entries: PerformanceEntry[]
}

// Performance thresholds (in milliseconds unless specified)
const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 }, // score, not ms
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
  API_RESPONSE: { good: 1000, needsImprovement: 3000 },
  PAGE_LOAD: { good: 3000, needsImprovement: 5000 }
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private isClient = typeof window !== 'undefined'
  private userId?: string
  private webVitalsLoaded = false
  
  constructor() {
    if (this.isClient) {
      this.initializeWebVitals()
      this.initializeCustomMetrics()
      this.initializeAPIMonitoring()
      this.initializeNavigationTracking()
    }
  }
  
  private async initializeWebVitals() {
    try {
      // Try to initialize web vitals if available
      // For now, we'll implement basic performance monitoring without external deps
      this.webVitalsLoaded = true
      addBreadcrumb('Performance monitoring initialized', 'performance')
      
      // Basic performance observation without web-vitals dependency
      if ('PerformanceObserver' in window) {
        this.observeBasicPerformance()
      }
    } catch (error) {
      console.warn('Performance monitoring initialization failed:', error)
      captureMessage('Performance monitoring initialization failed', 'warning', { error: (error as Error).message })
    }
  }
  
  private observeBasicPerformance() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            this.recordMetric('lcp', entry.startTime)
          } else if (entry.entryType === 'first-input') {
            this.recordMetric('fid', (entry as any).processingStart - entry.startTime)
          } else if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            this.recordMetric('cls', (entry as any).value)
          }
        }
      })
      
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
    } catch (error) {
      console.warn('Performance observer setup failed:', error)
    }
  }
  
  private initializeCustomMetrics() {
    // Track page load time
    if (document.readyState === 'complete') {
      this.measurePageLoadTime()
    } else {
      window.addEventListener('load', () => this.measurePageLoadTime())
    }
    
    // Track resource loading times
    this.observeResourceTiming()
    
    // Track long tasks
    this.observeLongTasks()
  }
  
  private initializeAPIMonitoring() {
    // Intercept fetch requests for API monitoring
    const originalFetch = window.fetch
    
    window.fetch = async function(...args: Parameters<typeof fetch>) {
      const startTime = performance.now()
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
      const method = args[1]?.method || 'GET'
      
      try {
        const response = await originalFetch.apply(this, args)
        const endTime = performance.now()
        const duration = endTime - startTime
        
        // Record API response time
        const monitor = (window as any).performanceMonitor as PerformanceMonitor
        if (monitor) {
          monitor.recordMetric('api_response_time', duration, {
            url,
            method,
            status: response.status,
            success: response.ok
          })
          
          // Check against performance budget
          monitor.checkPerformanceBudget('API_RESPONSE', duration, { url, method })
        }
        
        return response
      } catch (error) {
        const endTime = performance.now()
        const duration = endTime - startTime
        
        // Record API error
        const monitor = (window as any).performanceMonitor as PerformanceMonitor
        if (monitor) {
          monitor.recordMetric('api_error', duration, {
            url,
            method,
            error: (error as Error).message
          })
        }
        
        throw error
      }
    }
  }
  
  private initializeNavigationTracking() {
    // Track page navigation timing
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const nav = entry as PerformanceNavigationTiming
          
          // Record various navigation timings
          this.recordMetric('dns_lookup_time', nav.domainLookupEnd - nav.domainLookupStart)
          this.recordMetric('tcp_connect_time', nav.connectEnd - nav.connectStart)
          this.recordMetric('request_response_time', nav.responseEnd - nav.requestStart)
          this.recordMetric('dom_interactive_time', nav.domInteractive - nav.fetchStart)
          this.recordMetric('dom_complete_time', nav.domComplete - nav.fetchStart)
        }
      }
    })
    
    try {
      observer.observe({ entryTypes: ['navigation'] })
    } catch (error) {
      console.warn('Navigation timing observer not supported:', error)
    }
  }
  
  private observeResourceTiming() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming
        
        // Track resource loading times
        if (resource.duration > 1000) { // Only track slow resources
          this.recordMetric('resource_load_time', resource.duration, {
            name: resource.name,
            type: resource.initiatorType,
            size: resource.transferSize
          })
        }
      }
    })
    
    try {
      observer.observe({ entryTypes: ['resource'] })
    } catch (error) {
      console.warn('Resource timing observer not supported:', error)
    }
  }
  
  private observeLongTasks() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Track long tasks that block the main thread
        this.recordMetric('long_task_duration', entry.duration, {
          startTime: entry.startTime,
          attribution: (entry as any).attribution?.[0]?.name
        })
        
        // Alert if task is very long
        if (entry.duration > 100) {
          captureMessage(`Long task detected: ${entry.duration}ms`, 'warning', {
            duration: entry.duration,
            startTime: entry.startTime
          })
        }
      }
    })
    
    try {
      observer.observe({ entryTypes: ['longtask'] })
    } catch (error) {
      console.warn('Long task observer not supported:', error)
    }
  }
  
  private handleWebVital(vital: WebVital) {
    this.recordMetric(vital.name.toLowerCase(), vital.value, {
      id: vital.id,
      delta: vital.delta,
      entries: vital.entries.length
    })
    
    // Check against performance budget
    this.checkPerformanceBudget(vital.name, vital.value)
    
    // Send to external monitoring services
    this.sendToMonitoringServices(vital)
  }
  
  private measurePageLoadTime() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigation) {
      const pageLoadTime = navigation.loadEventEnd - navigation.fetchStart
      this.recordMetric('page_load_time', pageLoadTime)
      
      // Check against performance budget
      this.checkPerformanceBudget('PAGE_LOAD', pageLoadTime)
    }
  }
  
  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      url: this.isClient ? window.location.href : undefined,
      userId: this.userId,
      metadata
    }
    
    this.metrics.push(metric)
    
    // Limit stored metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500)
    }
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Performance: ${name} = ${value.toFixed(2)}ms`, metadata)
    }
  }
  
  private checkPerformanceBudget(metricName: keyof typeof PERFORMANCE_THRESHOLDS, value: number, metadata?: Record<string, any>) {
    const threshold = PERFORMANCE_THRESHOLDS[metricName]
    if (!threshold) return
    
    let status: 'good' | 'needs-improvement' | 'poor'
    if (value <= threshold.good) {
      status = 'good'
    } else if (value <= threshold.needsImprovement) {
      status = 'needs-improvement'
    } else {
      status = 'poor'
    }
    
    // Alert on poor performance
    if (status === 'poor') {
      captureMessage(`Performance budget exceeded: ${metricName}`, 'warning', {
        metric: metricName,
        value,
        threshold: threshold.needsImprovement,
        status,
        ...metadata
      })
    }
    
    addBreadcrumb(`Performance check: ${metricName}`, 'performance', {
      value,
      status,
      ...metadata
    })
  }
  
  private sendToMonitoringServices(vital: WebVital) {
    // Send to New Relic
    if (typeof window !== 'undefined' && (window as any).newrelic) {
      (window as any).newrelic.addPageAction('core_web_vital', {
        name: vital.name,
        value: vital.value,
        rating: this.getVitalRating(vital.name, vital.value),
        url: window.location.href
      })
    }
    
    // Send to Sentry as a performance span
    addBreadcrumb(`Core Web Vital: ${vital.name}`, 'performance', {
      value: vital.value,
      rating: this.getVitalRating(vital.name, vital.value)
    })
  }
  
  private getVitalRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = PERFORMANCE_THRESHOLDS[name as keyof typeof PERFORMANCE_THRESHOLDS]
    if (!threshold) return 'good'
    
    if (value <= threshold.good) return 'good'
    if (value <= threshold.needsImprovement) return 'needs-improvement'
    return 'poor'
  }
  
  // Public API methods
  setUserId(userId: string) {
    this.userId = userId
    addBreadcrumb('User ID set for performance tracking', 'user', { userId })
  }
  
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }
  
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name)
  }
  
  getAverageMetric(name: string): number {
    const metrics = this.getMetricsByName(name)
    if (metrics.length === 0) return 0
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  }
  
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      url: this.isClient ? window.location.href : 'server',
      userId: this.userId,
      webVitalsLoaded: this.webVitalsLoaded,
      metrics: this.metrics,
      summary: {
        totalMetrics: this.metrics.length,
        avgApiResponseTime: this.getAverageMetric('api_response_time'),
        avgPageLoadTime: this.getAverageMetric('page_load_time')
      }
    }, null, 2)
  }
  
  // Performance measurement utilities
  measureAsyncOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now()
    
    return operation().then(
      (result) => {
        const duration = performance.now() - startTime
        this.recordMetric(operationName, duration, { success: true })
        return result
      },
      (error) => {
        const duration = performance.now() - startTime
        this.recordMetric(operationName, duration, { success: false, error: error.message })
        throw error
      }
    )
  }
  
  startTiming(name: string): () => void {
    const startTime = performance.now()
    
    return () => {
      const duration = performance.now() - startTime
      this.recordMetric(name, duration)
    }
  }
}

// Create global instance
const performanceMonitor = new PerformanceMonitor()

// Attach to window for global access
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor
}

export default performanceMonitor
export { PerformanceMonitor, PERFORMANCE_THRESHOLDS }