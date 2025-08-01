/**
 * PWA Manager
 * 
 * Comprehensive Progressive Web App functionality including:
 * - Service worker registration and management
 * - App installation prompts
 * - Push notifications
 * - Offline detection and handling
 * - Background sync management
 * - App updates
 */

import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'
import { captureError } from '../monitoring/sentry-config'

interface PWAConfig {
  enableServiceWorker: boolean
  enablePushNotifications: boolean
  enableInstallPrompt: boolean
  enableBackgroundSync: boolean
  enableAppUpdates: boolean
  serviceWorkerPath: string
  vapidPublicKey?: string
  notificationIcon?: string
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAInstallability {
  canInstall: boolean
  isInstalled: boolean
  installPrompt: InstallPromptEvent | null
  installMethod: 'prompt' | 'manual' | 'none'
}

interface PWAStatus {
  serviceWorkerRegistered: boolean
  serviceWorkerActive: boolean
  pushPermission: NotificationPermission
  installability: PWAInstallability
  online: boolean
  backgroundSyncSupported: boolean
  updateAvailable: boolean
}

class PWAManager {
  private config: PWAConfig
  private registration: ServiceWorkerRegistration | null = null
  private installPrompt: InstallPromptEvent | null = null
  private updateAvailable = false
  private eventListeners: Map<string, Function[]> = new Map()
  private isInitialized = false

  constructor(config?: Partial<PWAConfig>) {
    this.config = {
      enableServiceWorker: true,
      enablePushNotifications: true,
      enableInstallPrompt: true,
      enableBackgroundSync: true,
      enableAppUpdates: true,
      serviceWorkerPath: '/sw.js',
      notificationIcon: '/icon-192x192.png',
      ...config
    }
  }

  /**
   * Initialize PWA functionality
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('PWA Manager already initialized', {
        component: 'PWAManager'
      })
      return
    }

    if (typeof window === 'undefined') {
      logger.debug('PWA Manager not available in server-side environment', {
        component: 'PWAManager'
      })
      return
    }

    const startTime = performance.now()

    try {
      logger.info('Initializing PWA Manager...', {
        component: 'PWAManager',
        metadata: { config: this.config }
      })

      // Register service worker
      if (this.config.enableServiceWorker && 'serviceWorker' in navigator) {
        await this.registerServiceWorker()
      }

      // Set up install prompt handling
      if (this.config.enableInstallPrompt) {
        this.setupInstallPrompt()
      }

      // Set up push notifications
      if (this.config.enablePushNotifications && 'Notification' in window) {
        await this.setupPushNotifications()
      }

      // Set up offline detection
      this.setupOfflineDetection()

      // Set up app update detection
      if (this.config.enableAppUpdates) {
        this.setupAppUpdates()
      }

      // Set up background sync
      if (this.config.enableBackgroundSync) {
        this.setupBackgroundSync()
      }

      this.isInitialized = true

      const initTime = performance.now() - startTime

      performanceMonitor.recordMetric('pwa_manager_init_time', initTime, {
        success: true,
        config: this.config
      })

      this.emitEvent('pwa-initialized', {
        status: await this.getStatus(),
        initTime
      })

      logger.info(`PWA Manager initialized in ${initTime.toFixed(2)}ms`, {
        component: 'PWAManager',
        metadata: {
          initTime,
          config: this.config,
          status: await this.getStatus()
        }
      })

    } catch (error) {
      const initTime = performance.now() - startTime

      performanceMonitor.recordMetric('pwa_manager_init_error', initTime, {
        success: false,
        error: (error as Error).message
      })

      logger.error('Failed to initialize PWA Manager', {
        component: 'PWAManager',
        metadata: { error: (error as Error).message }
      })

      captureError(error as Error, {
        component: 'PWAManager',
        phase: 'initialization'
      })

      throw error
    }
  }

  /**
   * Get current PWA status
   */
  async getStatus(): Promise<PWAStatus> {
    return {
      serviceWorkerRegistered: !!this.registration,
      serviceWorkerActive: !!this.registration?.active,
      pushPermission: 'Notification' in window ? Notification.permission : 'denied',
      installability: await this.getInstallability(),
      online: navigator.onLine,
      backgroundSyncSupported: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      updateAvailable: this.updateAvailable
    }
  }

  /**
   * Get app installability status
   */
  async getInstallability(): Promise<PWAInstallability> {
    const canInstall = !!this.installPrompt
    const isInstalled = await this.isAppInstalled()

    return {
      canInstall,
      isInstalled,
      installPrompt: this.installPrompt,
      installMethod: canInstall ? 'prompt' : isInstalled ? 'none' : 'manual'
    }
  }

  /**
   * Prompt user to install the app
   */
  async promptInstall(): Promise<{ outcome: 'accepted' | 'dismissed' }> {
    if (!this.installPrompt) {
      throw new Error('Install prompt not available')
    }

    try {
      logger.info('Showing install prompt', {
        component: 'PWAManager'
      })

      // Show the prompt
      await this.installPrompt.prompt()

      // Wait for user choice
      const result = await this.installPrompt.userChoice

      performanceMonitor.recordMetric('pwa_install_prompt_result', 1, {
        outcome: result.outcome
      })

      this.emitEvent('install-prompt-result', result)

      logger.info(`Install prompt result: ${result.outcome}`, {
        component: 'PWAManager',
        metadata: result
      })

      // Clear the prompt after use
      this.installPrompt = null

      return result

    } catch (error) {
      logger.error('Failed to show install prompt', {
        component: 'PWAManager',
        metadata: { error: (error as Error).message }
      })

      captureError(error as Error, {
        component: 'PWAManager',
        action: 'install-prompt'
      })

      throw error
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported')
    }

    try {
      const permission = await Notification.requestPermission()

      performanceMonitor.recordMetric('pwa_notification_permission_request', 1, {
        result: permission
      })

      this.emitEvent('notification-permission-changed', { permission })

      logger.info(`Notification permission: ${permission}`, {
        component: 'PWAManager'
      })

      return permission

    } catch (error) {
      logger.error('Failed to request notification permission', {
        component: 'PWAManager',
        metadata: { error: (error as Error).message }
      })

      throw error
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration || !this.config.vapidPublicKey) {
      throw new Error('Service worker or VAPID key not available')
    }

    try {
      // Check permission
      if (Notification.permission !== 'granted') {
        const permission = await this.requestNotificationPermission()
        if (permission !== 'granted') {
          throw new Error('Notification permission denied')
        }
      }

      // Subscribe to push notifications
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.config.vapidPublicKey
      })

      performanceMonitor.recordMetric('pwa_push_subscription_success', 1)

      this.emitEvent('push-subscription-created', { subscription })

      logger.info('Push subscription created', {
        component: 'PWAManager',
        metadata: {
          endpoint: subscription.endpoint
        }
      })

      return subscription

    } catch (error) {
      performanceMonitor.recordMetric('pwa_push_subscription_error', 1, {
        error: (error as Error).message
      })

      logger.error('Failed to subscribe to push notifications', {
        component: 'PWAManager',
        metadata: { error: (error as Error).message }
      })

      throw error
    }
  }

  /**
   * Send a local notification
   */
  async showNotification(
    title: string,
    options?: NotificationOptions
  ): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered')
    }

    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted')
    }

    try {
      const notificationOptions: NotificationOptions = {
        icon: this.config.notificationIcon,
        badge: this.config.notificationIcon,
        ...options
      }

      // Add vibrate if supported
      if ('vibrate' in navigator) {
        (notificationOptions as any).vibrate = [200, 100, 200]
      }

      await this.registration.showNotification(title, notificationOptions)

      performanceMonitor.recordMetric('pwa_local_notification_sent', 1)

      logger.debug('Local notification sent', {
        component: 'PWAManager',
        metadata: { title, options: notificationOptions }
      })

    } catch (error) {
      logger.error('Failed to show notification', {
        component: 'PWAManager',
        metadata: { error: (error as Error).message }
      })

      throw error
    }
  }

  /**
   * Schedule background sync
   */
  async scheduleBackgroundSync(tag: string): Promise<void> {
    if (!this.registration || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      throw new Error('Background sync not supported')
    }

    try {
      await (this.registration as any).sync.register(tag)

      performanceMonitor.recordMetric('pwa_background_sync_scheduled', 1, {
        tag
      })

      logger.debug('Background sync scheduled', {
        component: 'PWAManager',
        metadata: { tag }
      })

    } catch (error) {
      logger.error('Failed to schedule background sync', {
        component: 'PWAManager',
        metadata: { tag, error: (error as Error).message }
      })

      throw error
    }
  }

  /**
   * Check for app updates
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false
    }

    try {
      await this.registration.update()

      // Check if update is available
      const hasUpdate = !!this.registration.waiting || 
                       (!!this.registration.installing && this.registration.installing !== this.registration.active)

      if (hasUpdate && !this.updateAvailable) {
        this.updateAvailable = true
        this.emitEvent('update-available', { registration: this.registration })

        logger.info('App update available', {
          component: 'PWAManager'
        })
      }

      return hasUpdate

    } catch (error) {
      logger.error('Failed to check for updates', {
        component: 'PWAManager',
        metadata: { error: (error as Error).message }
      })

      return false
    }
  }

  /**
   * Apply pending app update
   */
  async applyUpdate(): Promise<void> {
    if (!this.registration?.waiting) {
      throw new Error('No pending update available')
    }

    try {
      // Send message to waiting service worker to skip waiting
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' })

      // Listen for controlling change
      await new Promise<void>(resolve => {
        const handleControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
          resolve()
        }
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
      })

      this.updateAvailable = false
      this.emitEvent('update-applied')

      logger.info('App update applied', {
        component: 'PWAManager'
      })

      // Reload the page to use the new service worker
      window.location.reload()

    } catch (error) {
      logger.error('Failed to apply update', {
        component: 'PWAManager',
        metadata: { error: (error as Error).message }
      })

      throw error
    }
  }

  /**
   * Subscribe to PWA events
   */
  on(event: string, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }

    this.eventListeners.get(event)!.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventListeners.get(event)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  // Private methods

  private async registerServiceWorker(): Promise<void> {
    try {
      this.registration = await navigator.serviceWorker.register(this.config.serviceWorkerPath, {
        updateViaCache: 'none'
      })

      // Set up service worker message handling
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event)
      })

      // Set up registration event listeners
      this.registration.addEventListener('updatefound', () => {
        this.handleServiceWorkerUpdate()
      })

      performanceMonitor.recordMetric('pwa_service_worker_registered', 1)

      logger.info('Service worker registered', {
        component: 'PWAManager',
        metadata: {
          scope: this.registration.scope,
          state: this.registration.active?.state
        }
      })

    } catch (error) {
      performanceMonitor.recordMetric('pwa_service_worker_registration_error', 1, {
        error: (error as Error).message
      })

      logger.error('Service worker registration failed', {
        component: 'PWAManager',
        metadata: { error: (error as Error).message }
      })

      throw error
    }
  }

  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      event.preventDefault()

      // Store the event for later use
      this.installPrompt = event as InstallPromptEvent

      this.emitEvent('install-prompt-available', { prompt: this.installPrompt })

      logger.info('Install prompt available', {
        component: 'PWAManager'
      })
    })

    window.addEventListener('appinstalled', () => {
      this.installPrompt = null
      this.emitEvent('app-installed')

      logger.info('App installed', {
        component: 'PWAManager'
      })
    })
  }

  private async setupPushNotifications(): Promise<void> {
    // Listen for push messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'push-received') {
          this.emitEvent('push-received', event.data)
        }
      })
    }
  }

  private setupOfflineDetection(): void {
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine

      this.emitEvent('online-status-changed', { online: isOnline })

      if (isOnline) {
        logger.info('App came online', {
          component: 'PWAManager'
        })
      } else {
        logger.info('App went offline', {
          component: 'PWAManager'
        })
      }
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
  }

  private setupAppUpdates(): void {
    // Check for updates periodically
    setInterval(() => {
      this.checkForUpdates()
    }, 30 * 60 * 1000) // Check every 30 minutes

    // Check for updates on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdates()
      }
    })
  }

  private setupBackgroundSync(): void {
    // Listen for background sync messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type?.endsWith('-sync-success')) {
          this.emitEvent('background-sync-success', event.data)
        }
      })
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { data } = event

    switch (data?.type) {
      case 'registration-sync-success':
      case 'volunteer-sync-success':
        this.emitEvent('background-sync-success', data)
        break

      case 'push-received':
        this.emitEvent('push-received', data)
        break

      default:
        logger.debug('Unknown service worker message', {
          component: 'PWAManager',
          metadata: { data }
        })
    }
  }

  private handleServiceWorkerUpdate(): void {
    if (this.registration?.installing) {
      const installingWorker = this.registration.installing

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is installed and ready
          this.updateAvailable = true
          this.emitEvent('update-available', { registration: this.registration })

          logger.info('Service worker update available', {
            component: 'PWAManager'
          })
        }
      })
    }
  }

  private async isAppInstalled(): Promise<boolean> {
    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true
    }

    // Check for iOS Safari standalone mode
    if ('standalone' in window.navigator && (window.navigator as any).standalone) {
      return true
    }

    // Check for related app
    if ('getInstalledRelatedApps' in navigator) {
      try {
        const relatedApps = await (navigator as any).getInstalledRelatedApps()
        return relatedApps.length > 0
      } catch (error) {
        // Ignore errors
      }
    }

    return false
  }

  private emitEvent(event: string, data?: any): void {
    const callbacks = this.eventListeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({ type: event, timestamp: Date.now(), ...data })
        } catch (error) {
          logger.error(`PWA event callback error: ${event}`, {
            component: 'PWAManager',
            metadata: { error: (error as Error).message }
          })
        }
      })
    }

    // Log important events
    if (['app-installed', 'update-available', 'push-received'].includes(event)) {
      logger.info(`PWA event: ${event}`, {
        component: 'PWAManager',
        metadata: { event: { type: event, ...data } }
      })
    }
  }

  /**
   * Cleanup and destroy PWA manager
   */
  destroy(): void {
    this.eventListeners.clear()
    this.installPrompt = null
    this.isInitialized = false

    logger.info('PWA Manager destroyed', {
      component: 'PWAManager'
    })
  }
}

export default PWAManager
export type { PWAConfig, PWAStatus, PWAInstallability }