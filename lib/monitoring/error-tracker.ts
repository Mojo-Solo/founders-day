/**
 * Error Tracking System
 * Comprehensive error monitoring and reporting
 */

import logger from './logger';
import { analytics } from '../analytics/analytics-engine';

export interface ErrorDetails {
  message: string;
  stack?: string;
  level: 'error' | 'warning' | 'info';
  context: ErrorContext;
  timestamp: number;
  fingerprint: string;
  occurrences: number;
}

export interface ErrorContext {
  url: string;
  userAgent: string;
  release?: string;
  environment: string;
  userId?: string;
  sessionId?: string;
  tags: Record<string, string>;
  extra: Record<string, any>;
  breadcrumbs: Breadcrumb[];
}

export interface Breadcrumb {
  timestamp: number;
  type: BreadcrumbType;
  category: string;
  message: string;
  data?: Record<string, any>;
  level?: 'debug' | 'info' | 'warning' | 'error';
}

export type BreadcrumbType = 
  | 'navigation'
  | 'http'
  | 'console'
  | 'ui'
  | 'lifecycle'
  | 'custom';

export interface ErrorReport {
  reportId: string;
  errors: ErrorDetails[];
  summary: ErrorSummary;
  timestamp: number;
}

export interface ErrorSummary {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByType: Record<string, number>;
  affectedUsers: number;
  affectedSessions: number;
  topErrors: Array<{
    fingerprint: string;
    message: string;
    count: number;
  }>;
}

export class ErrorTracker {
  private static instance: ErrorTracker;
  private errors: Map<string, ErrorDetails> = new Map();
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 50;
  private initialized = false;
  private originalHandlers: {
    error?: OnErrorEventHandler;
    unhandledRejection?: EventListener;
  } = {};

  private constructor() {}

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  initialize(): void {
    if (this.initialized || typeof window === 'undefined') return;

    try {
      // Install global error handlers
      this.installGlobalHandlers();

      // Install console interceptors
      this.installConsoleInterceptors();

      // Install fetch interceptor
      this.installFetchInterceptor();

      // Install event listener interceptor
      this.installEventListenerInterceptor();

      this.initialized = true;
      logger.info('Error tracker initialized');

    } catch (error) {
      logger.error('Failed to initialize error tracker', {
        component: 'ErrorTracker',
        metadata: { error: (error as Error).message }
      });
    }
  }

  private installGlobalHandlers(): void {
    // Error handler
    this.originalHandlers.error = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.captureError({
        message: typeof message === 'string' ? message : 'Unknown error',
        stack: error?.stack,
        source,
        lineno,
        colno
      });

      // Call original handler
      if (this.originalHandlers.error) {
        return this.originalHandlers.error(message, source, lineno, colno, error);
      }
      return true;
    };

    // Unhandled rejection handler
    this.originalHandlers.unhandledRejection = (e: Event) => {
      if ('reason' in e) {
        const event = e as PromiseRejectionEvent;
        this.captureError({
          message: `Unhandled Promise Rejection: ${event.reason}`,
          stack: event.reason?.stack
        });
      }
    };
    window.addEventListener('unhandledrejection', this.originalHandlers.unhandledRejection);
  }

  private installConsoleInterceptors(): void {
    const methods = ['error', 'warn', 'info', 'log'] as const;
    
    methods.forEach(method => {
      const original = console[method];
      (console as any)[method] = (...args: any[]) => {
        // Add breadcrumb
        this.addBreadcrumb({
          type: 'console',
          category: method,
          message: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' '),
          level: method === 'error' ? 'error' : 
                 method === 'warn' ? 'warning' : 'info'
        });

        // Capture console errors
        if (method === 'error') {
          this.captureError({
            message: `Console error: ${args.join(' ')}`,
            level: 'error'
          });
        }

        // Call original method with proper binding
        if (typeof original === 'function') {
          return (original as Function).apply(console, args);
        }
      };
    });
  }

  private installFetchInterceptor(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const [input, init] = args;
      let url: string;
      
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input instanceof Request) {
        url = input.url;
      } else {
        url = String(input);
      }
      
      const method = init?.method || 'GET';

      try {
        const response = await originalFetch(...args);

        // Add breadcrumb
        this.addBreadcrumb({
          type: 'http',
          category: 'fetch',
          message: `${method} ${url}`,
          data: {
            status: response.status,
            statusText: response.statusText
          },
          level: response.ok ? 'info' : 'error'
        });

        // Capture HTTP errors
        if (!response.ok) {
          this.captureError({
            message: `HTTP Error: ${method} ${url} - ${response.status} ${response.statusText}`,
            level: 'warning',
            extra: {
              url,
              method,
              status: response.status,
              statusText: response.statusText
            }
          });
        }

        return response;

      } catch (error) {
        // Add breadcrumb for failed requests
        this.addBreadcrumb({
          type: 'http',
          category: 'fetch',
          message: `${method} ${url} (failed)`,
          data: { error: (error as Error).message },
          level: 'error'
        });

        // Capture network errors
        this.captureError({
          message: `Network Error: ${method} ${url} - ${(error as Error).message}`,
          stack: (error as Error).stack,
          level: 'error',
          extra: { url, method }
        });

        throw error;
      }
    };
  }

  private installEventListenerInterceptor(): void {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const wrappedListener = function(this: any, event: Event) {
        try {
          // Add UI breadcrumb for certain events
          if (['click', 'input', 'submit'].includes(type)) {
            errorTracker.addBreadcrumb({
              type: 'ui',
              category: type,
              message: `User ${type} on ${(event.target as any)?.tagName || 'element'}`,
              data: {
                target: (event.target as any)?.className || '',
                value: (event.target as any)?.value
              }
            });
          }

          // Call original listener
          if (typeof listener === 'function') {
            return listener.call(this, event);
          } else if (listener && typeof listener.handleEvent === 'function') {
            return listener.handleEvent(event);
          }
        } catch (error) {
          // Capture event handler errors
          errorTracker.captureError({
            message: `Event handler error: ${type} - ${(error as Error).message}`,
            stack: (error as Error).stack,
            extra: {
              eventType: type,
              target: (event.target as any)?.tagName
            }
          });
          throw error;
        }
      };

      // Store original listener for removal
      (wrappedListener as any).__originalListener = listener;

      return originalAddEventListener.call(this, type, wrappedListener, options);
    };
  }

  captureError(error: Partial<ErrorDetails> & { 
    message: string;
    level?: 'error' | 'warning' | 'info';
    extra?: Record<string, any>;
    tags?: Record<string, string>;
    source?: string;
    lineno?: number;
    colno?: number;
  }): void {
    try {
      const fingerprint = this.generateFingerprint(error);
      const existingError = this.errors.get(fingerprint);

      const errorDetails: ErrorDetails = {
        message: error.message,
        stack: error.stack,
        level: error.level || 'error',
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          release: process.env.NEXT_PUBLIC_APP_VERSION,
          environment: process.env.NODE_ENV || 'production',
          userId: this.getUserId(),
          sessionId: this.getSessionId(),
          tags: error.tags || {},
          extra: {
            ...error.extra,
            source: error.source,
            lineno: error.lineno,
            colno: error.colno
          },
          breadcrumbs: [...this.breadcrumbs]
        },
        timestamp: Date.now(),
        fingerprint,
        occurrences: existingError ? existingError.occurrences + 1 : 1
      };

      // Update or add error
      this.errors.set(fingerprint, errorDetails);

      // Log error
      logger.error('Error captured', {
        component: 'ErrorTracker',
        metadata: { error: errorDetails }
      });

      // Track in analytics
      analytics.trackError({
        message: error.message,
        stack: error.stack,
        context: errorDetails.context
      });

      // Send to error reporting service
      this.sendToErrorService(errorDetails);

    } catch (captureError) {
      logger.error('Failed to capture error', {
        component: 'ErrorTracker',
        metadata: { error: (captureError as Error).message }
      });
    }
  }

  captureException(exception: Error, context?: Partial<ErrorContext>): void {
    this.captureError({
      message: exception.message,
      stack: exception.stack,
      level: 'error',
      tags: context?.tags,
      extra: context?.extra
    });
  }

  captureMessage(message: string, level: 'error' | 'warning' | 'info' = 'info', context?: Partial<ErrorContext>): void {
    this.captureError({
      message,
      level,
      tags: context?.tags,
      extra: context?.extra
    });
  }

  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const fullBreadcrumb: Breadcrumb = {
      ...breadcrumb,
      timestamp: Date.now()
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Keep only recent breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  setUser(userId: string, userData?: Record<string, any>): void {
    // Store user context
    if (typeof window !== 'undefined') {
      localStorage.setItem('error_tracker_user_id', userId);
      if (userData) {
        localStorage.setItem('error_tracker_user_data', JSON.stringify(userData));
      }
    }
  }

  setContext(key: string, value: any): void {
    // Store additional context
    if (typeof window !== 'undefined') {
      const context = JSON.parse(localStorage.getItem('error_tracker_context') || '{}');
      context[key] = value;
      localStorage.setItem('error_tracker_context', JSON.stringify(context));
    }
  }

  getErrorReport(): ErrorReport {
    const errors = Array.from(this.errors.values());
    const errorsByLevel = this.groupBy(errors, 'level');
    const errorsByMessage = this.groupBy(errors, 'message');

    const affectedUsers = new Set(errors.map(e => e.context.userId).filter(Boolean));
    const affectedSessions = new Set(errors.map(e => e.context.sessionId).filter(Boolean));

    const topErrors = Object.entries(errorsByMessage)
      .map(([message, errs]) => ({
        fingerprint: errs[0].fingerprint,
        message,
        count: errs.reduce((sum, e) => sum + e.occurrences, 0)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      reportId: this.generateId(),
      errors,
      summary: {
        totalErrors: errors.reduce((sum, e) => sum + e.occurrences, 0),
        errorsByLevel: Object.fromEntries(
          Object.entries(errorsByLevel).map(([level, errs]) => [
            level,
            errs.reduce((sum, e) => sum + e.occurrences, 0)
          ])
        ),
        errorsByType: Object.fromEntries(
          Object.entries(errorsByMessage).map(([msg, errs]) => [
            msg.substring(0, 50),
            errs.length
          ])
        ),
        affectedUsers: affectedUsers.size,
        affectedSessions: affectedSessions.size,
        topErrors
      },
      timestamp: Date.now()
    };
  }

  clearErrors(): void {
    this.errors.clear();
    this.breadcrumbs = [];
  }

  // Helper methods
  private generateFingerprint(error: Partial<ErrorDetails> & { message: string }): string {
    const key = `${error.message}-${error.stack?.split('\n')[0] || ''}`;
    return this.hashString(key);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUserId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem('error_tracker_user_id') || undefined;
  }

  private getSessionId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return sessionStorage.getItem('analytics_session_id') || undefined;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
      const group = String(item[key]);
      if (!result[group]) result[group] = [];
      result[group].push(item);
      return result;
    }, {} as Record<string, T[]>);
  }

  private async sendToErrorService(error: ErrorDetails): Promise<void> {
    try {
      // Send to your error tracking endpoint
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      });
    } catch (sendError) {
      logger.error('Failed to send error to service', {
        component: 'ErrorTracker',
        metadata: { error: (sendError as Error).message }
      });
    }
  }

  // Cleanup
  destroy(): void {
    // Restore original handlers
    if (this.originalHandlers.error) {
      window.onerror = this.originalHandlers.error;
    }
    if (this.originalHandlers.unhandledRejection) {
      window.removeEventListener('unhandledrejection', this.originalHandlers.unhandledRejection);
    }

    this.initialized = false;
  }
}

// Export singleton instance
export const errorTracker = ErrorTracker.getInstance();