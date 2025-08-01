/**
 * Core Session Manager
 * 
 * Centralized session management system implementing the BMAD architecture
 * with security, persistence, monitoring, and cross-tab synchronization
 */

import {
  SessionData,
  SessionState,
  SessionConfig,
  SessionAction,
  SessionHooks,
  SessionEvent,
  SessionError,
  User,
  UserPreferences,
  SessionStatus,
  SessionEventType,
  CrossTabMessage,
  SESSION_STORAGE_KEYS,
  SESSION_EVENTS,
  SESSION_TIMEOUTS,
  SESSION_LIMITS
} from './session-types'

import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'
import { captureError, setUserContext } from '../monitoring/sentry-config'

class SessionManager {
  private state: SessionState
  private config: SessionConfig
  private hooks: SessionHooks
  private eventListeners: Map<SessionEventType, Function[]>
  private timers: Map<string, NodeJS.Timeout>
  private crossTabChannel: BroadcastChannel | null
  private storageEventListener: ((event: StorageEvent) => void) | null
  private isInitialized = false
  private eventHistory: SessionEvent[] = []
  
  constructor(config?: Partial<SessionConfig>, hooks?: SessionHooks) {
    this.state = this.createInitialState()
    this.config = this.createDefaultConfig(config)
    this.hooks = hooks || {}
    this.eventListeners = new Map()
    this.timers = new Map()
    this.crossTabChannel = null
    this.storageEventListener = null
    
    this.initializeStorage()
    this.initializeCrossTabSync()
    this.initializeActivityTracking()
  }
  
  /**
   * Initialize the session manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Session manager already initialized', {
        component: 'SessionManager'
      })
      return
    }
    
    const startTime = performance.now()
    
    try {
      logger.info('Initializing session manager...', {
        component: 'SessionManager',
        metadata: { config: this.config }
      })
      
      // Attempt to restore existing session
      await this.restoreSession()
      
      // Initialize monitoring
      this.initializeMonitoring()
      
      // Set up token refresh timer if authenticated
      if (this.state.data?.accessToken) {
        this.scheduleTokenRefresh()
      }
      
      // Set up session expiry warning
      this.scheduleSessionWarning()
      
      this.isInitialized = true
      this.updateState({ initialized: true })
      
      const initTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('session_manager_init_time', initTime, {
        success: true,
        hasExistingSession: !!this.state.data?.user
      })
      
      this.emitEvent('session_created', {
        sessionId: this.state.data?.sessionId,
        restored: !!this.state.data?.user
      })
      
      logger.info(`Session manager initialized in ${initTime.toFixed(2)}ms`, {
        component: 'SessionManager',
        metadata: {
          initTime,
          hasExistingSession: !!this.state.data?.user,
          sessionId: this.state.data?.sessionId
        }
      })
      
    } catch (error) {
      const initTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('session_manager_init_error', initTime, {
        success: false,
        error: (error as Error).message
      })
      
      this.handleError({
        code: 'INIT_FAILED',
        message: 'Failed to initialize session manager',
        type: 'system',
        recoverable: true,
        timestamp: Date.now(),
        context: { error: (error as Error).message }
      })
      
      throw error
    }
  }
  
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<User> {
    const startTime = performance.now()
    
    logger.info('Login attempt started', {
      component: 'SessionManager',
      metadata: { email }
    })
    
    this.updateState({
      status: 'authenticating',
      loading: true,
      error: null
    })
    
    try {
      // Call authentication API
      const response = await this.callAuthAPI('/api/auth/login', {
        email,
        password,
        deviceId: this.getDeviceId()
      })
      
      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`)
      }
      
      const authData = await response.json()
      const { user, accessToken, refreshToken, expiresIn } = authData
      
      // Create session data
      const sessionData: SessionData = {
        user,
        isAuthenticated: true,
        accessToken,
        refreshToken,
        tokenExpiry: Date.now() + (expiresIn * 1000),
        sessionId: this.generateSessionId(),
        deviceId: this.getDeviceId(),
        createdAt: Date.now(),
        lastActivity: Date.now(),
        preferences: await this.getStoredPreferences() || this.createDefaultPreferences(),
        metadata: await this.collectSessionMetadata()
      }
      
      // Update state
      this.updateState({
        status: 'authenticated',
        data: sessionData,
        loading: false,
        error: null
      })
      
      // Store session data
      await this.storeSessionData(sessionData)
      
      // Set up monitoring
      setUserContext({
        id: user.id,
        email: user.email,
        registrationId: user.registrationId,
        volunteerStatus: user.volunteerStatus
      })
      
      // Schedule token refresh
      this.scheduleTokenRefresh()
      
      // Notify cross-tab
      this.broadcastCrossTabMessage({
        type: 'session_update',
        sessionId: sessionData.sessionId,
        userId: user.id,
        data: sessionData,
        timestamp: Date.now(),
        source: 'login'
      })
      
      const loginTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('session_login_time', loginTime, {
        success: true,
        userId: user.id
      })
      
      this.emitEvent('login_success', {
        userId: user.id,
        sessionId: sessionData.sessionId,
        loginTime
      })
      
      // Call hook
      if (this.hooks.onLogin) {
        await this.hooks.onLogin(user)
      }
      
      logger.info(`Login successful for user ${user.email}`, {
        component: 'SessionManager',
        metadata: {
          userId: user.id,
          sessionId: sessionData.sessionId,
          loginTime
        }
      })
      
      return user
      
    } catch (error) {
      const loginTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('session_login_error', loginTime, {
        success: false,
        error: (error as Error).message
      })
      
      const sessionError: SessionError = {
        code: 'LOGIN_FAILED',
        message: (error as Error).message,
        type: 'authentication',
        recoverable: true,
        timestamp: Date.now(),
        context: { email, loginTime }
      }
      
      this.handleError(sessionError)
      
      this.updateState({
        status: 'error',
        loading: false,
        error: sessionError
      })
      
      this.emitEvent('login_failed', {
        email,
        error: (error as Error).message,
        loginTime
      })
      
      throw error
    }
  }
  
  /**
   * Logout user and clean up session
   */
  async logout(reason: 'user' | 'expiry' | 'security' = 'user'): Promise<void> {
    const startTime = performance.now()
    const sessionId = this.state.data?.sessionId
    const userId = this.state.data?.user?.id
    
    logger.info(`Logout initiated: ${reason}`, {
      component: 'SessionManager',
      metadata: { sessionId, userId, reason }
    })
    
    try {
      // Call logout API if we have a valid session
      if (this.state.data?.accessToken) {
        try {
          await this.callAuthAPI('/api/auth/logout', {
            sessionId,
            reason
          })
        } catch (error) {
          // Log but don't throw - local logout should proceed
          logger.warn('Server logout failed, proceeding with local logout', {
            component: 'SessionManager',
            metadata: { error: (error as Error).message }
          })
        }
      }
      
      // Clear all timers
      this.clearAllTimers()
      
      // Clear storage
      await this.clearSessionStorage()
      
      // Reset state
      this.updateState({
        status: 'idle',
        data: null,
        loading: false,
        error: null,
        lastSync: Date.now()
      })
      
      // Notify cross-tab
      this.broadcastCrossTabMessage({
        type: 'session_logout',
        sessionId: sessionId || '',
        userId,
        data: { reason },
        timestamp: Date.now(),
        source: 'logout'
      })
      
      const logoutTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('session_logout_time', logoutTime, {
        reason,
        sessionId,
        userId
      })
      
      this.emitEvent('logout', {
        reason,
        sessionId,
        userId,
        logoutTime
      })
      
      // Call hook
      if (this.hooks.onLogout) {
        await this.hooks.onLogout(reason)
      }
      
      logger.info(`Logout completed: ${reason}`, {
        component: 'SessionManager',
        metadata: {
          sessionId,
          userId,
          reason,
          logoutTime
        }
      })
      
    } catch (error) {
      this.handleError({
        code: 'LOGOUT_FAILED',
        message: `Logout failed: ${(error as Error).message}`,
        type: 'system',
        recoverable: false,
        timestamp: Date.now(),
        context: { reason, sessionId, userId }
      })
      
      throw error
    }
  }
  
  /**
   * Refresh access token
   */
  async refreshToken(): Promise<string> {
    if (!this.state.data?.refreshToken) {
      throw new Error('No refresh token available')
    }
    
    const startTime = performance.now()
    
    logger.debug('Refreshing access token', {
      component: 'SessionManager',
      metadata: { sessionId: this.state.data.sessionId }
    })
    
    this.updateState({ status: 'refreshing', loading: true })
    
    try {
      const response = await this.callAuthAPI('/api/auth/refresh', {
        refreshToken: this.state.data.refreshToken,
        sessionId: this.state.data.sessionId
      })
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`)
      }
      
      const { accessToken, expiresIn } = await response.json()
      
      // Update session data
      const updatedData: SessionData = {
        ...this.state.data,
        accessToken,
        tokenExpiry: Date.now() + (expiresIn * 1000),
        lastActivity: Date.now()
      }
      
      this.updateState({
        status: 'authenticated',
        data: updatedData,
        loading: false
      })
      
      // Store updated session
      await this.storeSessionData(updatedData)
      
      // Schedule next refresh
      this.scheduleTokenRefresh()
      
      const refreshTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('session_token_refresh_time', refreshTime, {
        success: true,
        sessionId: updatedData.sessionId
      })
      
      this.emitEvent('token_refreshed', {
        sessionId: updatedData.sessionId,
        refreshTime
      })
      
      // Call hook
      if (this.hooks.onTokenRefresh) {
        await this.hooks.onTokenRefresh(accessToken)
      }
      
      logger.debug('Token refreshed successfully', {
        component: 'SessionManager',
        metadata: {
          sessionId: updatedData.sessionId,
          refreshTime
        }
      })
      
      return accessToken
      
    } catch (error) {
      const refreshTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('session_token_refresh_error', refreshTime, {
        success: false,
        error: (error as Error).message
      })
      
      // If refresh fails, session is expired
      await this.logout('expiry')
      
      this.handleError({
        code: 'TOKEN_REFRESH_FAILED',
        message: `Token refresh failed: ${(error as Error).message}`,
        type: 'authentication',
        recoverable: false,
        timestamp: Date.now()
      })
      
      throw error
    }
  }
  
  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    if (!this.state.data) {
      throw new Error('No active session')
    }
    
    const updatedPreferences = {
      ...this.state.data.preferences,
      ...preferences
    }
    
    const updatedData: SessionData = {
      ...this.state.data,
      preferences: updatedPreferences,
      lastActivity: Date.now()
    }
    
    this.updateState({ data: updatedData })
    
    // Store updated preferences
    await this.storeSessionData(updatedData)
    
    logger.debug('User preferences updated', {
      component: 'SessionManager',
      metadata: {
        userId: this.state.data.user?.id,
        preferences: Object.keys(preferences)
      }
    })
  }
  
  /**
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state }
  }
  
  /**
   * Get current user
   */
  getUser(): User | null {
    return this.state.data?.user || null
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.state.status === 'authenticated' && !!this.state.data?.user
  }
  
  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.state.data?.accessToken || null
  }
  
  /**
   * Subscribe to session events
   */
  on(eventType: SessionEventType, callback: Function): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, [])
    }
    
    this.eventListeners.get(eventType)!.push(callback)
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.eventListeners.get(eventType)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }
  
  // Private methods
  
  private createInitialState(): SessionState {
    return {
      status: 'idle',
      data: null,
      error: null,
      loading: false,
      initialized: false,
      lastSync: 0,
      syncInProgress: false
    }
  }
  
  private createDefaultConfig(config?: Partial<SessionConfig>): SessionConfig {
    return {
      tokenRefreshThreshold: SESSION_TIMEOUTS.TOKEN_REFRESH_THRESHOLD,
      sessionTimeout: SESSION_TIMEOUTS.DEFAULT_SESSION,
      refreshTokenDuration: SESSION_TIMEOUTS.REFRESH_TOKEN,
      maxConcurrentSessions: SESSION_LIMITS.MAX_CONCURRENT_SESSIONS,
      enableCrossTabSync: true,
      enableSessionRecovery: true,
      encryptionEnabled: true,
      storageStrategy: {
        primary: 'localStorage',
        fallback: 'memory',
        encryption: true,
        compression: false,
        ttl: SESSION_TIMEOUTS.DEFAULT_SESSION
      },
      monitoringEnabled: true,
      ...config
    }
  }
  
  private createDefaultPreferences(): UserPreferences {
    return {
      theme: 'system',
      language: 'en',
      notifications: {
        email: true,
        push: false,
        browser: true
      },
      privacy: {
        analytics: true,
        marketing: false,
        essential: true
      },
      accessibility: {
        highContrast: false,
        reducedMotion: false,
        fontSize: 'medium'
      }
    }
  }
  
  private updateState(updates: Partial<SessionState>): void {
    this.state = { ...this.state, ...updates }
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  private getDeviceId(): string {
    let deviceId = localStorage.getItem(SESSION_STORAGE_KEYS.DEVICE_ID)
    
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem(SESSION_STORAGE_KEYS.DEVICE_ID, deviceId)
    }
    
    return deviceId
  }
  
  private async collectSessionMetadata() {
    const metadata = {
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        localStorageEnabled: typeof localStorage !== 'undefined'
      },
      networkInfo: {},
      geolocation: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      performanceMetrics: {
        sessionDuration: 0,
        pageViews: 1,
        interactions: 0,
        errors: 0
      }
    }
    
    // Add network information if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      metadata.networkInfo = {
        connectionType: connection.type,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink
      }
    }
    
    return metadata
  }
  
  private async callAuthAPI(endpoint: string, data: any): Promise<Response> {
    const baseUrl = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3001'
    
    return fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.state.data?.accessToken && {
          'Authorization': `Bearer ${this.state.data.accessToken}`
        })
      },
      body: JSON.stringify(data)
    })
  }
  
  private emitEvent(type: SessionEventType, data?: any): void {
    const event: SessionEvent = {
      type,
      timestamp: Date.now(),
      sessionId: this.state.data?.sessionId || '',
      userId: this.state.data?.user?.id,
      data,
      source: 'system'
    }
    
    // Add to history
    this.eventHistory.push(event)
    
    // Limit history size
    if (this.eventHistory.length > SESSION_LIMITS.MAX_EVENT_HISTORY) {
      this.eventHistory = this.eventHistory.slice(-SESSION_LIMITS.MAX_EVENT_HISTORY / 2)
    }
    
    // Notify listeners
    const callbacks = this.eventListeners.get(type)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          logger.error(`Session event callback error: ${type}`, {
            component: 'SessionManager',
            metadata: { error: (error as Error).message }
          })
        }
      })
    }
    
    // Log important events
    if (['login_success', 'logout', 'session_expired', 'security_violation'].includes(type)) {
      logger.info(`Session event: ${type}`, {
        component: 'SessionManager',
        metadata: { event }
      })
    }
  }
  
  private handleError(error: SessionError): void {
    logger.error(`Session error: ${error.code}`, {
      component: 'SessionManager',
      metadata: error
    })
    
    // Capture in Sentry
    captureError(new Error(error.message), {
      sessionError: error,
      sessionId: this.state.data?.sessionId,
      userId: this.state.data?.user?.id
    })
    
    // Call hook
    if (this.hooks.onError) {
      this.hooks.onError(error)
    }
    
    this.emitEvent('session_error' as SessionEventType, error)
  }
  
  // Additional private methods will be implemented in subsequent parts...
  // This includes storage management, cross-tab sync, monitoring, etc.
  
  private initializeStorage(): void {
    // Storage initialization logic
  }
  
  private initializeCrossTabSync(): void {
    // Cross-tab synchronization logic
  }
  
  private initializeActivityTracking(): void {
    // Activity tracking logic
  }
  
  private initializeMonitoring(): void {
    // Monitoring integration logic
  }
  
  private async restoreSession(): Promise<void> {
    // Session restoration logic
  }
  
  private async storeSessionData(data: SessionData): Promise<void> {
    // Session storage logic
  }
  
  private async getStoredPreferences(): Promise<UserPreferences | null> {
    // Preferences retrieval logic
    return null
  }
  
  private scheduleTokenRefresh(): void {
    // Token refresh scheduling logic
  }
  
  private scheduleSessionWarning(): void {
    // Session warning scheduling logic
  }
  
  private clearAllTimers(): void {
    // Timer cleanup logic
  }
  
  private async clearSessionStorage(): Promise<void> {
    // Storage cleanup logic
  }
  
  private broadcastCrossTabMessage(message: CrossTabMessage): void {
    // Cross-tab message broadcasting logic
  }
  
  /**
   * Destroy session manager and cleanup resources
   */
  destroy(): void {
    this.clearAllTimers()
    
    if (this.crossTabChannel) {
      this.crossTabChannel.close()
      this.crossTabChannel = null
    }
    
    if (this.storageEventListener) {
      window.removeEventListener('storage', this.storageEventListener)
      this.storageEventListener = null
    }
    
    this.eventListeners.clear()
    this.isInitialized = false
    
    logger.info('Session manager destroyed', {
      component: 'SessionManager'
    })
  }
}

export default SessionManager