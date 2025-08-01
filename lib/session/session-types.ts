/**
 * Session Management Type Definitions
 * 
 * Core TypeScript interfaces and types for the session management system
 * following the BMAD architecture specifications
 */

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user' | 'volunteer'
  permissions: string[]
  registrationId?: string
  volunteerStatus?: string
  createdAt: string
  lastLoginAt: string
}

export interface SessionData {
  user: User | null
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  tokenExpiry: number | null
  sessionId: string
  deviceId: string
  createdAt: number
  lastActivity: number
  preferences: UserPreferences
  metadata: SessionMetadata
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: {
    email: boolean
    push: boolean
    browser: boolean
  }
  privacy: {
    analytics: boolean
    marketing: boolean
    essential: boolean
  }
  accessibility: {
    highContrast: boolean
    reducedMotion: boolean
    fontSize: 'small' | 'medium' | 'large'
  }
}

export interface SessionMetadata {
  browserInfo: {
    userAgent: string
    language: string
    platform: string
    cookiesEnabled: boolean
    localStorageEnabled: boolean
  }
  networkInfo: {
    connectionType?: string
    effectiveType?: string
    downlink?: number
  }
  geolocation?: {
    country?: string
    region?: string
    city?: string
    timezone: string
  }
  performanceMetrics: {
    sessionDuration: number
    pageViews: number
    interactions: number
    errors: number
  }
}

export interface SessionConfig {
  tokenRefreshThreshold: number // milliseconds before expiry to refresh
  sessionTimeout: number // max session duration in milliseconds
  refreshTokenDuration: number // refresh token validity duration
  maxConcurrentSessions: number
  enableCrossTabSync: boolean
  enableSessionRecovery: boolean
  encryptionEnabled: boolean
  storageStrategy: SessionStorageStrategy
  monitoringEnabled: boolean
}

export interface SessionStorageStrategy {
  primary: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB'
  fallback: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB'
  encryption: boolean
  compression: boolean
  ttl: number
}

export interface SessionEvent {
  type: SessionEventType
  timestamp: number
  sessionId: string
  userId?: string
  data?: any
  source: 'user' | 'system' | 'network' | 'external'
}

export type SessionEventType =
  | 'session_created'
  | 'session_restored'
  | 'session_updated'
  | 'session_expired'
  | 'session_terminated'
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'token_refreshed'
  | 'token_expired'
  | 'cross_tab_sync'
  | 'session_conflict'
  | 'security_violation'
  | 'network_error'
  | 'storage_error'

export interface SessionState {
  status: SessionStatus
  data: SessionData | null
  error: SessionError | null
  loading: boolean
  initialized: boolean
  lastSync: number
  syncInProgress: boolean
}

export type SessionStatus =
  | 'idle'
  | 'authenticating'
  | 'authenticated'
  | 'refreshing'
  | 'expired'
  | 'error'
  | 'terminated'

export interface SessionError {
  code: string
  message: string
  type: 'authentication' | 'network' | 'storage' | 'security' | 'validation' | 'system'
  recoverable: boolean
  timestamp: number
  context?: Record<string, any>
}

export interface SessionAction {
  type: SessionActionType
  payload?: any
  meta?: {
    timestamp: number
    source: string
    synchronous?: boolean
  }
}

export type SessionActionType =
  | 'INITIALIZE_SESSION'
  | 'LOGIN_REQUEST'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'REFRESH_TOKEN'
  | 'UPDATE_USER'
  | 'UPDATE_PREFERENCES'
  | 'SESSION_EXPIRED'
  | 'SESSION_ERROR'
  | 'CROSS_TAB_SYNC'
  | 'CLEAR_ERROR'
  | 'RESET_SESSION'

export interface SessionHooks {
  onLogin?: (user: User) => void | Promise<void>
  onLogout?: (reason: 'user' | 'expiry' | 'security') => void | Promise<void>
  onSessionExpiry?: (timeRemaining: number) => void | Promise<void>
  onTokenRefresh?: (newToken: string) => void | Promise<void>
  onError?: (error: SessionError) => void | Promise<void>
  onCrossTabSync?: (data: SessionData) => void | Promise<void>
  onSecurityViolation?: (violation: SecurityViolation) => void | Promise<void>
}

export interface SecurityViolation {
  type: 'concurrent_session' | 'token_mismatch' | 'suspicious_activity' | 'unauthorized_access'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  metadata: Record<string, any>
  timestamp: number
  sessionId: string
  userId?: string
}

export interface SessionStorageItem {
  key: string
  value: string
  encrypted: boolean
  compressed: boolean
  timestamp: number
  ttl: number
  version: string
}

export interface CrossTabMessage {
  type: 'session_update' | 'session_logout' | 'session_sync_request' | 'session_sync_response'
  sessionId: string
  userId?: string
  data: any
  timestamp: number
  source: string
}

export interface SessionAnalytics {
  sessionId: string
  userId?: string
  startTime: number
  endTime?: number
  duration?: number
  pageViews: number
  interactions: number
  errors: number[]
  performance: {
    averageResponseTime: number
    slowQueries: number
    errors: number
  }
  userAgent: string
  referrer?: string
  exitPage?: string
}

export interface SessionRecoveryData {
  sessionId: string
  userId: string
  timestamp: number
  reason: 'page_reload' | 'browser_crash' | 'network_interruption' | 'tab_restore'
  recoveryAttempts: number
  maxRecoveryAttempts: number
  priority: 'high' | 'medium' | 'low'
}

// Utility types for type safety
export type SessionDataKey = keyof SessionData
export type UserKey = keyof User
export type PreferencesKey = keyof UserPreferences

// Constants
export const SESSION_STORAGE_KEYS = {
  SESSION_DATA: 'founders_day_session',
  REFRESH_TOKEN: 'founders_day_refresh_token',
  DEVICE_ID: 'founders_day_device_id',
  USER_PREFERENCES: 'founders_day_preferences',
  RECOVERY_DATA: 'founders_day_recovery'
} as const

export const SESSION_EVENTS = {
  CROSS_TAB_SYNC: 'founders_day_cross_tab_sync',
  SESSION_LOGOUT: 'founders_day_session_logout',
  SESSION_UPDATE: 'founders_day_session_update',
  SECURITY_ALERT: 'founders_day_security_alert'
} as const

export const SESSION_TIMEOUTS = {
  DEFAULT_SESSION: 24 * 60 * 60 * 1000, // 24 hours
  REFRESH_TOKEN: 30 * 24 * 60 * 60 * 1000, // 30 days
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
  CROSS_TAB_SYNC_INTERVAL: 30 * 1000, // 30 seconds
  ACTIVITY_CHECK_INTERVAL: 60 * 1000, // 1 minute
  SESSION_WARNING_TIME: 5 * 60 * 1000 // 5 minutes before expiry
} as const

export const SESSION_LIMITS = {
  MAX_CONCURRENT_SESSIONS: 5,
  MAX_LOGIN_ATTEMPTS: 5,
  MAX_RECOVERY_ATTEMPTS: 3,
  SESSION_DATA_SIZE_LIMIT: 1024 * 1024, // 1MB
  MAX_EVENT_HISTORY: 1000
} as const