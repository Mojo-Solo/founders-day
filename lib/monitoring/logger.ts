/**
 * Comprehensive Logging System for Founders Day Frontend
 * 
 * Features:
 * - Structured logging with metadata
 * - Multiple log levels (debug, info, warn, error)
 * - Context-aware logging
 * - Integration with monitoring services
 * - Performance logging
 * - User action tracking
 * - Error correlation
 */

import { captureMessage, captureError, addBreadcrumb } from './sentry-config'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  userId?: string
  sessionId?: string
  requestId?: string
  component?: string
  action?: string
  metadata?: Record<string, any>
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context: LogContext
  stack?: string
  performance?: {
    duration?: number
    memory?: number
  }
}

class Logger {
  private context: LogContext = {}
  private logs: LogEntry[] = []
  private isClient = typeof window !== 'undefined'
  private sessionId: string
  
  constructor() {
    this.sessionId = this.generateSessionId()
    this.initializeErrorHandling()
    this.initializePerformanceLogging()
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  private initializeErrorHandling() {
    if (!this.isClient) return
    
    // Global error handler
    window.addEventListener('error', (event) => {
      this.error('Global error caught', {
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      })
    })
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        metadata: {
          reason: event.reason,
          promise: event.promise
        }
      })
    })
  }
  
  private initializePerformanceLogging() {
    if (!this.isClient) return
    
    // Log page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.info(`Page ${document.hidden ? 'hidden' : 'visible'}`, {
        action: 'visibility_change',
        metadata: { hidden: document.hidden }
      })
    })
    
    // Log page unload
    window.addEventListener('beforeunload', () => {
      this.info('Page unloading', {
        action: 'page_unload',
        metadata: { 
          duration: performance.now(),
          logs_count: this.logs.length
        }
      })
    })
  }
  
  // Set persistent context for all logs
  setContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context }
  }
  
  // Create a child logger with additional context
  createChildLogger(childContext: Partial<LogContext>): Logger {
    const child = new Logger()
    child.context = { ...this.context, ...childContext }
    child.sessionId = this.sessionId
    return child
  }
  
  // Core logging method
  private log(level: LogLevel, message: string, context: Partial<LogContext> = {}) {
    const timestamp = new Date().toISOString()
    const fullContext: LogContext = {
      ...this.context,
      ...context,
      sessionId: this.sessionId
    }
    
    const entry: LogEntry = {
      level,
      message,
      timestamp,
      context: fullContext,
      performance: this.isClient ? {
        memory: (performance as any).memory?.usedJSHeapSize
      } : undefined
    }
    
    // Add stack trace for errors and warnings
    if (level === 'error' || level === 'warn') {
      entry.stack = new Error().stack
    }
    
    this.logs.push(entry)
    
    // Limit stored logs to prevent memory leaks
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500)
    }
    
    // Console output
    this.outputToConsole(entry)
    
    // Send to monitoring services
    this.sendToMonitoringServices(entry)
    
    // Add breadcrumb for Sentry
    addBreadcrumb(message, fullContext.component || 'app', {
      level,
      ...fullContext.metadata
    })
  }
  
  private outputToConsole(entry: LogEntry) {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`
    const contextStr = entry.context.component ? `[${entry.context.component}]` : ''
    const logMessage = `${prefix} ${contextStr} ${entry.message}`
    
    switch (entry.level) {
      case 'debug':
        console.debug(logMessage, entry.context.metadata)
        break
      case 'info':
        console.info(logMessage, entry.context.metadata)
        break
      case 'warn':
        console.warn(logMessage, entry.context.metadata)
        break
      case 'error':
        console.error(logMessage, entry.context.metadata, entry.stack)
        break
    }
  }
  
  private sendToMonitoringServices(entry: LogEntry) {
    // Send to New Relic
    if (this.isClient && (window as any).newrelic) {
      (window as any).newrelic.addPageAction('log_entry', {
        level: entry.level,
        message: entry.message,
        component: entry.context.component,
        action: entry.context.action,
        userId: entry.context.userId
      })
    }
    
    // Send to Sentry based on level
    if (entry.level === 'error') {
      const error = new Error(entry.message)
      error.stack = entry.stack
      captureError(error, entry.context.metadata)
    } else if (entry.level === 'warn') {
      captureMessage(entry.message, 'warning', entry.context.metadata)
    } else if (entry.level === 'info' && entry.context.action) {
      // Only send important info messages to reduce noise
      captureMessage(entry.message, 'info', entry.context.metadata)
    }
  }
  
  // Public logging methods
  debug(message: string, context: Partial<LogContext> = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, context)
    }
  }
  
  info(message: string, context: Partial<LogContext> = {}) {
    this.log('info', message, context)
  }
  
  warn(message: string, context: Partial<LogContext> = {}) {
    this.log('warn', message, context)
  }
  
  error(message: string, context: Partial<LogContext> = {}, error?: Error) {
    if (error) {
      context.metadata = {
        ...context.metadata,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    }
    
    this.log('error', message, context)
  }
  
  // Specialized logging methods
  apiCall(method: string, url: string, duration?: number, status?: number, error?: Error) {
    const level = error ? 'error' : status && status >= 400 ? 'warn' : 'info'
    const message = `API ${method} ${url} ${error ? 'failed' : 'completed'}`
    
    this.log(level, message, {
      action: 'api_call',
      metadata: {
        method,
        url,
        duration,
        status,
        error: error ? {
          name: error.name,
          message: error.message
        } : undefined
      }
    })
  }
  
  userAction(action: string, metadata?: Record<string, any>) {
    this.info(`User action: ${action}`, {
      action: 'user_interaction',
      metadata
    })
  }
  
  pageView(path: string, referrer?: string) {
    this.info(`Page view: ${path}`, {
      action: 'page_view',
      metadata: {
        path,
        referrer,
        timestamp: Date.now()
      }
    })
  }
  
  formSubmission(formName: string, success: boolean, errors?: string[]) {
    const message = `Form ${formName} ${success ? 'submitted successfully' : 'failed'}`
    const level = success ? 'info' : 'warn'
    
    this.log(level, message, {
      action: 'form_submission',
      metadata: {
        formName,
        success,
        errors
      }
    })
  }
  
  paymentFlow(step: string, success: boolean, metadata?: Record<string, any>) {
    const message = `Payment ${step} ${success ? 'completed' : 'failed'}`
    const level = success ? 'info' : 'error'
    
    this.log(level, message, {
      action: 'payment_flow',
      metadata: {
        step,
        success,
        ...metadata
      }
    })
  }
  
  registration(step: string, data?: Record<string, any>) {
    this.info(`Registration ${step}`, {
      action: 'registration_flow',
      metadata: data
    })
  }
  
  volunteer(step: string, data?: Record<string, any>) {
    this.info(`Volunteer ${step}`, {
      action: 'volunteer_flow',
      metadata: data
    })
  }
  
  // Performance timing logging
  timing(name: string, duration: number, metadata?: Record<string, any>) {
    this.info(`Performance: ${name}`, {
      action: 'performance_timing',
      metadata: {
        ...metadata,
        duration
      }
    })
  }
  
  // Export logs for debugging
  exportLogs(): LogEntry[] {
    return [...this.logs]
  }
  
  exportLogsJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      totalLogs: this.logs.length,
      context: this.context,
      logs: this.logs
    }, null, 2)
  }
  
  // Clear logs (useful for testing)
  clearLogs() {
    this.logs = []
  }
  
  // Get log statistics
  getLogStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0
      },
      byComponent: {} as Record<string, number>,
      byAction: {} as Record<string, number>
    }
    
    this.logs.forEach(log => {
      stats.byLevel[log.level]++
      
      if (log.context.component) {
        stats.byComponent[log.context.component] = (stats.byComponent[log.context.component] || 0) + 1
      }
      
      if (log.context.action) {
        stats.byAction[log.context.action] = (stats.byAction[log.context.action] || 0) + 1
      }
    })
    
    return stats
  }
}

// Create global logger instance
const logger = new Logger()

// Attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).logger = logger
}

export default logger
export { Logger }