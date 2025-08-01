/**
 * Analytics Engine
 * Core analytics tracking and data collection system
 */

import { 
  AnalyticsEvent, 
  AnalyticsConfig, 
  Session, 
  UserProfile,
  PerformanceMetrics,
  ConversionGoal,
  AnalyticsError,
  EventCategory,
  MetricType,
  GoalType,
  AnalyticsStorage,
  RealTimeMetrics
} from './analytics-types';
import logger from '../monitoring/logger';
import performanceMonitor from '../monitoring/performance-monitor';

export class AnalyticsEngine {
  private static instance: AnalyticsEngine;
  private config: AnalyticsConfig;
  private storage: AnalyticsStorage;
  private currentSession: Session | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private initialized = false;
  private providers: Map<string, any> = new Map();

  private constructor() {
    this.config = this.getDefaultConfig();
    this.storage = this.initializeStorage();
  }

  static getInstance(): AnalyticsEngine {
    if (!AnalyticsEngine.instance) {
      AnalyticsEngine.instance = new AnalyticsEngine();
    }
    return AnalyticsEngine.instance;
  }

  private getDefaultConfig(): AnalyticsConfig {
    return {
      enabled: true,
      debug: process.env.NODE_ENV === 'development',
      sampleRate: 1.0,
      providers: [],
      privacy: {
        anonymizeIp: true,
        respectDoNotTrack: true,
        cookieConsent: true,
        dataRetention: 90,
        excludeFields: ['password', 'ssn', 'creditCard']
      },
      batching: {
        enabled: true,
        maxBatchSize: 100,
        flushInterval: 5000,
        maxRetries: 3
      },
      retention: {
        events: 90,
        sessions: 180,
        profiles: 365,
        raw: 30
      }
    };
  }

  private initializeStorage(): AnalyticsStorage {
    return {
      events: [],
      sessions: [],
      profiles: [],
      metrics: [],
      errors: []
    };
  }

  async initialize(config?: Partial<AnalyticsConfig>): Promise<void> {
    if (this.initialized) return;

    try {
      // Merge config
      this.config = { ...this.config, ...config };

      // Check privacy settings
      if (this.config.privacy.respectDoNotTrack && this.isDoNotTrack()) {
        this.config.enabled = false;
        logger.info('Analytics disabled due to Do Not Track');
        return;
      }

      // Initialize session
      await this.initializeSession();

      // Initialize providers
      await this.initializeProviders();

      // Start batching
      if (this.config.batching.enabled) {
        this.startBatching();
      }

      // Initialize performance observer
      this.initializePerformanceObserver();

      // Initialize error tracking
      this.initializeErrorTracking();

      this.initialized = true;
      logger.info('Analytics engine initialized');

    } catch (error) {
      logger.error('Failed to initialize analytics', { 
        component: 'AnalyticsEngine',
        metadata: { error: (error as Error).message }
      });
    }
  }

  private isDoNotTrack(): boolean {
    return navigator.doNotTrack === '1' || 
           (window as any).doNotTrack === '1';
  }

  private async initializeSession(): Promise<void> {
    const sessionId = this.getOrCreateSessionId();
    const userId = this.getUserId();

    this.currentSession = {
      sessionId,
      userId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      duration: 0,
      pageViews: 0,
      events: 0,
      bounced: true,
      conversionGoals: [],
      deviceId: this.getDeviceId()
    };

    // Store session
    this.storage.sessions.push(this.currentSession);
  }

  private async initializeProviders(): Promise<void> {
    for (const provider of this.config.providers) {
      if (!provider.enabled) continue;

      try {
        switch (provider.name) {
          case 'google-analytics':
            await this.initializeGoogleAnalytics(provider.config);
            break;
          case 'mixpanel':
            await this.initializeMixpanel(provider.config);
            break;
          case 'segment':
            await this.initializeSegment(provider.config);
            break;
          case 'custom':
            this.providers.set(provider.name, provider.config);
            break;
        }
      } catch (error) {
        logger.error(`Failed to initialize provider: ${provider.name}`, {
          component: 'AnalyticsEngine',
          metadata: { error: (error as Error).message }
        });
      }
    }
  }

  private async initializeGoogleAnalytics(config: any): Promise<void> {
    if (typeof window !== 'undefined' && config.measurementId) {
      // Load gtag.js
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`;
      document.head.appendChild(script);

      // Initialize gtag
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).gtag = function() {
        (window as any).dataLayer.push(arguments);
      };
      (window as any).gtag('js', new Date());
      (window as any).gtag('config', config.measurementId);

      this.providers.set('google-analytics', (window as any).gtag);
    }
  }

  private async initializeMixpanel(config: any): Promise<void> {
    // Mixpanel initialization would go here
  }

  private async initializeSegment(config: any): Promise<void> {
    // Segment initialization would go here
  }

  private startBatching(): void {
    this.batchTimer = setInterval(() => {
      this.flushEvents();
    }, this.config.batching.flushInterval);
  }

  private initializePerformanceObserver(): void {
    if (typeof window === 'undefined') return;

    // Performance monitoring is handled internally by performanceMonitor
    // It will automatically track Core Web Vitals and other metrics
    // We can access the metrics through performanceMonitor.getMetrics()
  }

  private initializeErrorTracking(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.trackError({
        message: event.message,
        stack: event.error?.stack,
        context: {
          url: event.filename || window.location.href,
          userAgent: navigator.userAgent,
          environment: process.env.NODE_ENV || 'production',
          tags: {
            line: String(event.lineno),
            column: String(event.colno)
          }
        }
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack
      });
    });
  }

  // Track event
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.config.enabled || !this.shouldSample()) return;

    const event: AnalyticsEvent = {
      eventId: this.generateId(),
      eventName,
      category: this.categorizeEvent(eventName),
      action: eventName,
      timestamp: Date.now(),
      sessionId: this.currentSession?.sessionId || '',
      userId: this.getUserId(),
      properties: this.sanitizeProperties(properties),
      context: this.getEventContext()
    };

    // Update session
    if (this.currentSession) {
      this.currentSession.events++;
      this.currentSession.lastActivity = Date.now();
      this.currentSession.bounced = false;
    }

    // Add to queue
    this.eventQueue.push(event);

    // Send to providers
    this.sendToProviders('track', event);

    // Flush if needed
    if (this.eventQueue.length >= this.config.batching.maxBatchSize) {
      this.flushEvents();
    }
  }

  // Track page view
  trackPageView(path: string, properties?: Record<string, any>): void {
    if (!this.config.enabled) return;

    // Update session
    if (this.currentSession) {
      this.currentSession.pageViews++;
      this.currentSession.lastActivity = Date.now();
    }

    this.track('page_view', {
      path,
      referrer: document.referrer,
      title: document.title,
      ...properties
    });

    // Send to providers
    this.sendToProviders('page', { path, ...properties });
  }

  // Track performance metrics
  trackPerformance(metrics: Partial<PerformanceMetrics>): void {
    if (!this.config.enabled) return;

    const metric: PerformanceMetrics = {
      metricId: this.generateId(),
      metricType: metrics.metricType || 'custom',
      value: metrics.value || 0,
      timestamp: Date.now(),
      url: metrics.url || window.location.href,
      sessionId: this.currentSession?.sessionId || '',
      context: {
        deviceCategory: this.getDeviceCategory(),
        connectionSpeed: this.getConnectionSpeed(),
        cacheHit: false,
        renderType: 'csr'
      }
    };

    this.storage.metrics.push(metric);
    
    // Log to console in debug mode
    if (this.config.debug) {
      console.log('[Analytics] Performance:', metric);
    }
  }

  // Track conversion goal
  trackGoal(goalName: string, value?: number, metadata?: Record<string, any>): void {
    if (!this.config.enabled) return;

    const goal: ConversionGoal = {
      goalId: this.generateId(),
      goalName,
      goalType: this.categorizeGoal(goalName),
      value,
      completedAt: Date.now(),
      sessionId: this.currentSession?.sessionId || '',
      userId: this.getUserId(),
      metadata
    };

    // Update session
    if (this.currentSession) {
      this.currentSession.conversionGoals.push(goalName);
    }

    // Track as event
    this.track(`goal_${goalName}`, { value, ...metadata });

    // Send to providers
    this.sendToProviders('goal', goal);
  }

  // Track error
  trackError(error: Partial<AnalyticsError>): void {
    if (!this.config.enabled) return;

    const analyticsError: AnalyticsError = {
      errorId: this.generateId(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        environment: process.env.NODE_ENV || 'production',
        tags: {}
      },
      timestamp: Date.now(),
      sessionId: this.currentSession?.sessionId || '',
      userId: this.getUserId()
    };

    this.storage.errors.push(analyticsError);

    // Log to console
    logger.error('Analytics error tracked', {
      component: 'AnalyticsEngine',
      metadata: { error: analyticsError }
    });
  }

  // Identify user
  identify(userId: string, traits?: Record<string, any>): void {
    if (!this.config.enabled) return;

    // Update session
    if (this.currentSession) {
      this.currentSession.userId = userId;
    }

    // Update or create profile
    let profile = this.storage.profiles.find(p => p.userId === userId);
    if (!profile) {
      profile = {
        userId,
        sessionCount: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        totalEngagementTime: 0,
        attributes: {},
        segments: []
      };
      this.storage.profiles.push(profile);
    } else {
      profile.lastSeen = Date.now();
      profile.sessionCount++;
    }

    // Update attributes
    if (traits) {
      profile.attributes = { ...profile.attributes, ...traits };
    }

    // Send to providers
    this.sendToProviders('identify', { userId, traits });
  }

  // Get real-time metrics
  getRealTimeMetrics(): RealTimeMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const fiveMinutesAgo = now - 300000;

    // Active sessions (activity in last 5 minutes)
    const activeSessions = this.storage.sessions.filter(
      s => s.lastActivity > fiveMinutesAgo
    );

    // Recent events (last minute)
    const recentEvents = this.storage.events.filter(
      e => e.timestamp > oneMinuteAgo
    );

    // Page views
    const pageViews = recentEvents.filter(
      e => e.eventName === 'page_view'
    );

    // Top pages
    const pageCounts = new Map<string, number>();
    pageViews.forEach(pv => {
      const path = pv.properties?.path || '/';
      pageCounts.set(path, (pageCounts.get(path) || 0) + 1);
    });

    const topPages = Array.from(pageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, users]) => ({ path, users }));

    // Top events
    const eventCounts = new Map<string, number>();
    recentEvents.forEach(e => {
      eventCounts.set(e.eventName, (eventCounts.get(e.eventName) || 0) + 1);
    });

    const topEvents = Array.from(eventCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Metrics
    const totalSessions = activeSessions.length;
    const bouncedSessions = activeSessions.filter(s => s.bounced).length;
    const conversions = activeSessions.filter(s => s.conversionGoals.length > 0).length;

    return {
      activeUsers: new Set(activeSessions.map(s => s.userId || s.sessionId)).size,
      activeSessions: totalSessions,
      pageViewsPerMinute: pageViews.length,
      eventsPerMinute: recentEvents.length,
      topPages,
      topEvents,
      conversionRate: totalSessions > 0 ? (conversions / totalSessions) * 100 : 0,
      bounceRate: totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0,
      avgSessionDuration: this.calculateAvgSessionDuration(activeSessions)
    };
  }

  // Helper methods
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return this.generateId();

    const stored = sessionStorage.getItem('analytics_session_id');
    if (stored) return stored;

    const sessionId = this.generateId();
    sessionStorage.setItem('analytics_session_id', sessionId);
    return sessionId;
  }

  private getUserId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem('analytics_user_id') || undefined;
  }

  private getDeviceId(): string {
    if (typeof window === 'undefined') return this.generateId();

    let deviceId = localStorage.getItem('analytics_device_id');
    if (!deviceId) {
      deviceId = this.generateId();
      localStorage.setItem('analytics_device_id', deviceId);
    }
    return deviceId;
  }

  private categorizeEvent(eventName: string): EventCategory {
    if (eventName.includes('click') || eventName.includes('tap')) {
      return 'user_interaction';
    }
    if (eventName.includes('page') || eventName.includes('navigate')) {
      return 'navigation';
    }
    if (eventName.includes('submit') || eventName.includes('form')) {
      return 'form_submission';
    }
    if (eventName.includes('api') || eventName.includes('fetch')) {
      return 'api_call';
    }
    if (eventName.includes('error') || eventName.includes('fail')) {
      return 'error';
    }
    if (eventName.includes('goal') || eventName.includes('conversion')) {
      return 'conversion';
    }
    return 'system';
  }

  private categorizeGoal(goalName: string): GoalType {
    if (goalName.includes('purchase') || goalName.includes('payment')) {
      return 'purchase';
    }
    if (goalName.includes('signup') || goalName.includes('register')) {
      return 'signup';
    }
    if (goalName.includes('engage') || goalName.includes('interact')) {
      return 'engagement';
    }
    return 'custom';
  }

  private getEventContext() {
    return {
      page: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: screen.width,
        height: screen.height
      },
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      connection: this.getConnectionInfo()
    };
  }

  private getConnectionInfo() {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (!connection) return undefined;

    return {
      type: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink,
      rtt: connection.rtt
    };
  }

  private getDeviceCategory(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getConnectionSpeed(): 'slow' | 'medium' | 'fast' {
    const connection = this.getConnectionInfo();
    if (!connection) return 'medium';

    if (connection.effectiveType === '4g') return 'fast';
    if (connection.effectiveType === '3g') return 'medium';
    return 'slow';
  }

  private sanitizeProperties(properties?: Record<string, any>): Record<string, any> | undefined {
    if (!properties) return undefined;

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(properties)) {
      // Skip excluded fields
      if (this.config.privacy.excludeFields.includes(key)) continue;
      
      // Sanitize values
      if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sendToProviders(method: string, data: any): void {
    for (const [name, provider] of this.providers) {
      try {
        if (typeof provider === 'function') {
          provider(method, data);
        } else if (provider[method]) {
          provider[method](data);
        }
      } catch (error) {
        logger.error(`Provider ${name} failed to handle ${method}`, {
          component: 'AnalyticsEngine',
          metadata: { error: (error as Error).message }
        });
      }
    }
  }

  private calculateAvgSessionDuration(sessions: Session[]): number {
    if (sessions.length === 0) return 0;
    
    const totalDuration = sessions.reduce((sum, session) => {
      const duration = session.lastActivity - session.startTime;
      return sum + duration;
    }, 0);

    return Math.round(totalDuration / sessions.length / 1000); // in seconds
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send to your analytics endpoint
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      });

      // Store events
      this.storage.events.push(...events);

    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
      
      logger.error('Failed to flush analytics events', {
        component: 'AnalyticsEngine',
        metadata: { error: (error as Error).message }
      });
    }
  }

  // Cleanup
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.flushEvents();
    this.initialized = false;
  }
}

// Export singleton instance
export const analytics = AnalyticsEngine.getInstance();