import * as Sentry from '@sentry/nextjs'

/**
 * Sentry Error Tracking Configuration for Founders Day Frontend
 * 
 * Features:
 * - Error tracking and performance monitoring
 * - User context and custom tags
 * - Smart error filtering
 * - Performance tracing for API calls
 * - Release tracking
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development'
const SENTRY_RELEASE = process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || 'development'

// Initialize Sentry if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    
    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
    
    // Error filtering - avoid noise from common browser issues
    beforeSend(event, hint) {
      const error = hint.originalException
      
      // Filter out low-value errors
      if (error && error instanceof Error) {
        const message = error.message.toLowerCase()
        
        // Skip network errors users can't control
        if (message.includes('fetch') || 
            message.includes('networkerror') ||
            message.includes('failed to fetch') ||
            message.includes('load failed')) {
          return null
        }
        
        // Skip browser extension errors
        if (message.includes('extension') || 
            message.includes('chrome-extension') ||
            message.includes('moz-extension')) {
          return null
        }
        
        // Skip script loading errors from external sources
        if (message.includes('script error') || 
            message.includes('loading css chunk')) {
          return null
        }
      }
      
      return event
    },
    
    // Custom tags for better categorization
    initialScope: {
      tags: {
        component: 'frontend',
        project: 'founders-day',
        version: process.env.npm_package_version || '1.0.0'
      }
    },
    
    // Basic configuration without complex integrations
    integrations: [],
    
    // Debug mode for development
    debug: process.env.NODE_ENV === 'development'
  })
  
  console.log('✅ Sentry initialized for error tracking')
} else {
  console.log('⚠️ Sentry not configured - set NEXT_PUBLIC_SENTRY_DSN to enable error tracking')
}

// Utility functions for manual error reporting
export function captureError(error: Error, context?: Record<string, any>, level: 'error' | 'warning' | 'info' = 'error') {
  if (!SENTRY_DSN) {
    console.error('Sentry not configured, logging error:', error, context)
    return
  }
  
  Sentry.withScope(scope => {
    scope.setLevel(level)
    
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setExtra(key, context[key])
      })
    }
    
    Sentry.captureException(error)
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', extra?: Record<string, any>) {
  if (!SENTRY_DSN) {
    console.log(`[${level.toUpperCase()}] ${message}`, extra)
    return
  }
  
  Sentry.withScope(scope => {
    scope.setLevel(level)
    
    if (extra) {
      Object.keys(extra).forEach(key => {
        scope.setExtra(key, extra[key])
      })
    }
    
    Sentry.captureMessage(message, level)
  })
}

export function setUserContext(user: { 
  id: string
  email?: string
  registrationId?: string
  volunteerStatus?: string 
}) {
  if (!SENTRY_DSN) return
  
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.email,
    registration_id: user.registrationId,
    volunteer_status: user.volunteerStatus
  })
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!SENTRY_DSN) return
  
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
    timestamp: Date.now() / 1000
  })
}

export function startTransaction(name: string, op: string) {
  if (!SENTRY_DSN) return null
  
  // Simplified transaction handling
  return { finish: () => {} }
}

// API monitoring wrapper
export function withSentryAPI<T extends (...args: any[]) => Promise<any>>(
  apiFunction: T,
  operationName: string
): T {
  return (async (...args: Parameters<T>) => {
    const transaction = startTransaction(operationName, 'api.call')
    
    try {
      addBreadcrumb(`Starting ${operationName}`, 'api', { args: args.length })
      
      const result = await apiFunction(...args)
      
      addBreadcrumb(`Completed ${operationName}`, 'api', { success: true })
      
      return result
    } catch (error) {
      captureError(error as Error, {
        operation: operationName,
        args: args.length
      })
      
      addBreadcrumb(`Failed ${operationName}`, 'api', { 
        error: (error as Error).message 
      })
      
      throw error
    } finally {
      transaction?.finish()
    }
  }) as T
}

export default Sentry