/**
 * Monitoring Initialization Script
 * 
 * This script initializes all monitoring services for the Founders Day Frontend
 * It should be imported in the main app file or layout
 */

import './sentry-config' // Initialize Sentry
import performanceMonitor from './performance-monitor'
import logger from './logger'

// Initialize monitoring services
export function initializeMonitoring() {
  if (typeof window === 'undefined') {
    // Server-side initialization
    logger.info('Monitoring initialized on server-side', {
      component: 'monitoring-init'
    })
    return
  }
  
  // Client-side initialization
  logger.info('Initializing client-side monitoring', {
    component: 'monitoring-init',
    metadata: {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now()
    }
  })
  
  // Initialize performance monitoring
  try {
    // Set up global error handling for performance issues
    window.addEventListener('error', (event) => {
      logger.error('JavaScript error detected', {
        component: 'global-error-handler',
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })
    
    // Track page visibility for engagement metrics
    document.addEventListener('visibilitychange', () => {
      logger.info(`Page visibility changed to ${document.hidden ? 'hidden' : 'visible'}`, {
        action: 'visibility_change',
        component: 'monitoring-init'
      })
    })
    
    // Initialize New Relic if available
    if ((window as any).newrelic) {
      (window as any).newrelic.addPageAction('monitoring_initialized', {
        timestamp: Date.now(),
        url: window.location.href
      })
      logger.info('New Relic monitoring active', {
        component: 'monitoring-init'
      })
    }
    
    logger.info('Client-side monitoring initialized successfully', {
      component: 'monitoring-init',
      metadata: {
        performanceSupported: 'performance' in window,
        webVitalsSupported: 'PerformanceObserver' in window,
        newRelicActive: !!(window as any).newrelic
      }
    })
    
  } catch (error) {
    logger.error('Failed to initialize monitoring', {
      component: 'monitoring-init'
    }, error as Error)
  }
}

// Auto-initialize when module is imported
initializeMonitoring()

// Export monitoring utilities for use throughout the app
export { performanceMonitor, logger }

// Monitoring context provider for React
export function withMonitoring<T extends (...args: any[]) => any>(
  func: T,
  operationName: string,
  component?: string
): T {
  return ((...args: Parameters<T>) => {
    const stopTiming = performanceMonitor.startTiming(operationName)
    
    try {
      logger.debug(`Starting operation: ${operationName}`, {
        component,
        action: operationName
      })
      
      const result = func(...args)
      
      // Handle async functions
      if (result && typeof result.then === 'function') {
        return result.then(
          (value: any) => {
            stopTiming()
            logger.debug(`Completed operation: ${operationName}`, {
              component,
              action: operationName,
              metadata: { success: true }
            })
            return value
          },
          (error: any) => {
            stopTiming()
            logger.error(`Failed operation: ${operationName}`, {
              component,
              action: operationName,
              metadata: { success: false }
            }, error)
            throw error
          }
        )
      }
      
      // Handle sync functions
      stopTiming()
      logger.debug(`Completed operation: ${operationName}`, {
        component,
        action: operationName,
        metadata: { success: true }
      })
      
      return result
    } catch (error) {
      stopTiming()
      logger.error(`Failed operation: ${operationName}`, {
        component,
        action: operationName,
        metadata: { success: false }
      }, error as Error)
      throw error
    }
  }) as T
}

// React hook for monitoring user interactions
export function useMonitoring(component: string) {
  const childLogger = logger.createChildLogger({ component })
  
  return {
    logger: childLogger,
    trackUserAction: (action: string, metadata?: Record<string, any>) => {
      childLogger.userAction(action, metadata)
    },
    trackTiming: (name: string) => performanceMonitor.startTiming(`${component}.${name}`),
    measureAsync: <T>(name: string, operation: () => Promise<T>) => 
      performanceMonitor.measureAsyncOperation(`${component}.${name}`, operation)
  }
}

// Global monitoring interface for debugging
if (typeof window !== 'undefined') {
  (window as any).foundersMonitoring = {
    logger,
    performanceMonitor,
    exportLogs: () => logger.exportLogsJSON(),
    exportMetrics: () => performanceMonitor.exportMetrics(),
    getStats: () => ({
      logs: logger.getLogStats(),
      metrics: performanceMonitor.getMetrics().length,
      session: logger.exportLogs()[0]?.context.sessionId
    })
  }
}