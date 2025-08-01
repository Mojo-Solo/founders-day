/**
 * Analytics Types and Interfaces
 * Comprehensive analytics tracking for user behavior and system performance
 */

export interface AnalyticsEvent {
  eventId: string;
  eventName: string;
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
  sessionId: string;
  userId?: string;
  properties?: Record<string, any>;
  context: EventContext;
}

export type EventCategory = 
  | 'user_interaction'
  | 'navigation'
  | 'form_submission'
  | 'api_call'
  | 'performance'
  | 'error'
  | 'conversion'
  | 'engagement'
  | 'system';

export interface EventContext {
  page: string;
  referrer?: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  screen: {
    width: number;
    height: number;
  };
  locale: string;
  timezone: string;
  connection?: {
    type: string;
    effectiveType: string;
    downlink?: number;
    rtt?: number;
  };
}

export interface UserProfile {
  userId: string;
  sessionCount: number;
  firstSeen: number;
  lastSeen: number;
  totalEngagementTime: number;
  attributes: Record<string, any>;
  segments: string[];
  cohort?: string;
}

export interface Session {
  sessionId: string;
  userId?: string;
  startTime: number;
  lastActivity: number;
  duration: number;
  pageViews: number;
  events: number;
  bounced: boolean;
  conversionGoals: string[];
  deviceId: string;
}

export interface PerformanceMetrics {
  metricId: string;
  metricType: MetricType;
  value: number;
  timestamp: number;
  url: string;
  sessionId: string;
  context: PerformanceContext;
}

export type MetricType = 
  | 'FCP'  // First Contentful Paint
  | 'LCP'  // Largest Contentful Paint
  | 'FID'  // First Input Delay
  | 'CLS'  // Cumulative Layout Shift
  | 'TTFB' // Time to First Byte
  | 'INP'  // Interaction to Next Paint
  | 'custom';

export interface PerformanceContext {
  deviceCategory: 'mobile' | 'tablet' | 'desktop';
  connectionSpeed: 'slow' | 'medium' | 'fast';
  cacheHit: boolean;
  renderType: 'ssr' | 'csr' | 'ssg' | 'isr';
}

export interface ConversionGoal {
  goalId: string;
  goalName: string;
  goalType: GoalType;
  value?: number;
  completedAt: number;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export type GoalType = 
  | 'purchase'
  | 'signup'
  | 'engagement'
  | 'milestone'
  | 'custom';

export interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  sampleRate: number; // 0-1
  providers: AnalyticsProvider[];
  privacy: PrivacyConfig;
  batching: BatchingConfig;
  retention: RetentionConfig;
}

export interface AnalyticsProvider {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  filter?: (event: AnalyticsEvent) => boolean;
}

export interface PrivacyConfig {
  anonymizeIp: boolean;
  respectDoNotTrack: boolean;
  cookieConsent: boolean;
  dataRetention: number; // days
  excludeFields: string[];
}

export interface BatchingConfig {
  enabled: boolean;
  maxBatchSize: number;
  flushInterval: number; // ms
  maxRetries: number;
}

export interface RetentionConfig {
  events: number; // days
  sessions: number; // days
  profiles: number; // days
  raw: number; // days
}

export interface AnalyticsReport {
  reportId: string;
  reportType: ReportType;
  dateRange: DateRange;
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  filters: ReportFilter[];
  generatedAt: number;
}

export type ReportType = 
  | 'overview'
  | 'realtime'
  | 'behavior'
  | 'conversion'
  | 'performance'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface ReportMetric {
  name: string;
  value: number;
  change?: number; // percentage
  trend?: 'up' | 'down' | 'stable';
}

export interface ReportDimension {
  name: string;
  values: Array<{
    label: string;
    value: number;
    percentage?: number;
  }>;
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn';
  value: any;
}

export interface ABTestVariant {
  variantId: string;
  variantName: string;
  weight: number; // 0-1
  active: boolean;
  config: Record<string, any>;
}

export interface ABTest {
  testId: string;
  testName: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ABTestVariant[];
  metrics: string[]; // goal IDs to track
  startDate?: Date;
  endDate?: Date;
  targetAudience?: AudienceRule[];
}

export interface AudienceRule {
  field: string;
  operator: string;
  value: any;
}

export interface ABTestResult {
  testId: string;
  variantId: string;
  metrics: Record<string, Record<string, {
    conversions: number;
    conversionRate: number;
    confidence: number;
    lift?: number;
  }>>;
  sampleSize: number;
  duration: number;
}

export interface HeatmapData {
  pageUrl: string;
  clicks: ClickData[];
  scrollDepth: ScrollData[];
  attention: AttentionData[];
  timestamp: number;
}

export interface ClickData {
  x: number;
  y: number;
  count: number;
  element?: string;
}

export interface ScrollData {
  depth: number; // percentage
  reached: number; // user count
}

export interface AttentionData {
  element: string;
  timeSpent: number; // ms
  interactions: number;
}

export interface AnalyticsError {
  errorId: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

export interface ErrorContext {
  url: string;
  userAgent: string;
  release?: string;
  environment: string;
  tags: Record<string, string>;
}

export interface RealTimeMetrics {
  activeUsers: number;
  activeSessions: number;
  pageViewsPerMinute: number;
  eventsPerMinute: number;
  topPages: Array<{ path: string; users: number }>;
  topEvents: Array<{ name: string; count: number }>;
  conversionRate: number;
  bounceRate: number;
  avgSessionDuration: number;
}

export interface AnalyticsStorage {
  events: AnalyticsEvent[];
  sessions: Session[];
  profiles: UserProfile[];
  metrics: PerformanceMetrics[];
  errors: AnalyticsError[];
}

export interface AnalyticsConsent {
  analytics: boolean;
  performance: boolean;
  marketing: boolean;
  functional: boolean;
  timestamp: number;
  ip?: string;
}