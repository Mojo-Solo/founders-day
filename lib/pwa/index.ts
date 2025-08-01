/**
 * PWA Module Index
 * 
 * Centralized exports for Progressive Web App functionality
 */

// Core components
export { default as PWAManager } from './pwa-manager'
export { default as OfflineContentManager } from './offline-content-manager'
export { default as PWAInstallBanner } from './pwa-install-banner'

// Types
export type { PWAConfig, PWAStatus, PWAInstallability } from './pwa-manager'
export type { OfflineContent, OfflineConfig, StorageQuota } from './offline-content-manager'

// Utility function to initialize complete PWA system
export async function initializePWA(config?: {
  pwaConfig?: Partial<PWAConfig>
  offlineConfig?: Partial<OfflineConfig>
}) {
  // Dynamic imports to reduce initial bundle size
  const { default: PWAManager } = await import('./pwa-manager')
  const { default: OfflineContentManager } = await import('./offline-content-manager')

  // Create instances
  const pwaManager = new PWAManager(config?.pwaConfig)
  const offlineManager = new OfflineContentManager(config?.offlineConfig)

  // Initialize both managers
  await Promise.all([
    pwaManager.initialize(),
    offlineManager.initialize()
  ])

  // Set up cross-manager communication
  pwaManager.on('online-status-changed', ({ online }: { online: boolean }) => {
    if (online) {
      // When coming online, sync critical data and pending submissions
      offlineManager.storeCriticalData()
    }
  })

  // Pre-cache critical data when PWA is ready
  pwaManager.on('pwa-initialized', () => {
    if (navigator.onLine) {
      offlineManager.storeCriticalData()
    }
  })

  return {
    pwaManager,
    offlineManager,

    // Convenience methods
    async installApp() {
      return pwaManager.promptInstall()
    },

    async enableNotifications() {
      await pwaManager.requestNotificationPermission()
      return pwaManager.subscribeToPush()
    },

    async showNotification(title: string, options?: NotificationOptions) {
      return pwaManager.showNotification(title, options)
    },

    async scheduleBackgroundSync(tag: string) {
      return pwaManager.scheduleBackgroundSync(tag)
    },

    async storeOfflineContent(id: string, type: any, data: any, options?: any) {
      return offlineManager.storeContent(id, type, data, options)
    },

    async getOfflineContent<T>(id: string): Promise<T | null> {
      return offlineManager.getContent<T>(id)
    },

    async submitFormOffline(formType: 'registration' | 'volunteer' | 'contact', formData: any) {
      const submissionId = await offlineManager.storeFormSubmission(formType, formData)
      
      // Try to sync immediately if online
      if (navigator.onLine) {
        await pwaManager.scheduleBackgroundSync(`${formType}-submit`)
      }
      
      return submissionId
    },

    async getStatus() {
      const [pwaStatus, offlineStats] = await Promise.all([
        pwaManager.getStatus(),
        offlineManager.getStats()
      ])

      return {
        pwa: pwaStatus,
        offline: offlineStats,
        fullyEnabled: pwaStatus.serviceWorkerActive && offlineStats.totalItems > 0
      }
    },

    async checkForUpdates() {
      return pwaManager.checkForUpdates()
    },

    async applyUpdate() {
      return pwaManager.applyUpdate()
    },

    // Event subscription
    onPWAEvent(event: string, callback: Function) {
      return pwaManager.on(event, callback)
    },

    // Cleanup
    destroy() {
      pwaManager.destroy()
      offlineManager.destroy()
    }
  }
}

// Utility function for React components to use PWA features
export function usePWA() {
  // This would typically be implemented as a React hook
  // For now, return the initialization function
  return {
    initializePWA,
    
    // Helper to detect if PWA is supported
    isPWASupported: () => {
      return typeof window !== 'undefined' && 
             'serviceWorker' in navigator &&
             'caches' in window &&
             'indexedDB' in window
    },

    // Helper to detect if app is installed
    isAppInstalled: () => {
      if (typeof window === 'undefined') return false
      
      // Check if running in standalone mode
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return true
      }

      // Check for iOS Safari standalone mode
      if ('standalone' in window.navigator && (window.navigator as any).standalone) {
        return true
      }

      return false
    },

    // Helper to detect if offline
    isOffline: () => {
      return typeof window !== 'undefined' && !navigator.onLine
    },

    // Helper to get network status
    getNetworkStatus: () => {
      if (typeof window === 'undefined') {
        return { online: true, type: 'unknown' }
      }

      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection

      return {
        online: navigator.onLine,
        type: connection?.type || 'unknown',
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink || 0,
        rtt: connection?.rtt || 0
      }
    }
  }
}

// Constants for PWA configuration
export const PWA_CONSTANTS = {
  CACHE_VERSIONS: {
    STATIC: 'v3',
    DYNAMIC: 'v3',
    API: 'v3'
  },
  
  CACHE_STRATEGIES: {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
    NETWORK_ONLY: 'network-only',
    CACHE_ONLY: 'cache-only'
  },

  NOTIFICATION_TYPES: {
    EVENT_REMINDER: 'event-reminder',
    REGISTRATION_CONFIRMED: 'registration-confirmed',
    VOLUNTEER_ACCEPTED: 'volunteer-accepted',
    SCHEDULE_UPDATE: 'schedule-update',
    EMERGENCY_ALERT: 'emergency-alert'
  },

  SYNC_TAGS: {
    REGISTRATION: 'registration-submit',
    VOLUNTEER: 'volunteer-submit',
    CONTACT: 'contact-submit',
    FEEDBACK: 'feedback-submit'
  },

  STORAGE_TYPES: {
    SCHEDULE: 'schedule',
    SPEAKERS: 'speakers',
    CONTENT: 'content',
    FORM_SUBMISSION: 'form-submission',
    STATIC: 'static'
  }
}

// Default configurations
export const DEFAULT_PWA_CONFIG: PWAConfig = {
  enableServiceWorker: true,
  enablePushNotifications: true,
  enableInstallPrompt: true,
  enableBackgroundSync: true,
  enableAppUpdates: true,
  serviceWorkerPath: '/sw.js',
  notificationIcon: '/icon-192x192.png'
}

export const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  dbName: 'FoundersDayOffline',
  dbVersion: 2,
  maxStorageSize: 50, // 50MB
  syncRetryLimit: 3,
  defaultExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableCompression: true
}

// Helper functions for common PWA tasks
export const PWAHelpers = {
  /**
   * Check if device supports PWA installation
   */
  canInstall: () => {
    return 'beforeinstallprompt' in window || 
           (window.matchMedia('(display-mode: browser)').matches && 
            'serviceWorker' in navigator)
  },

  /**
   * Get PWA display mode
   */
  getDisplayMode: (): 'standalone' | 'minimal-ui' | 'fullscreen' | 'browser' => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return 'standalone'
    }
    if (window.matchMedia('(display-mode: minimal-ui)').matches) {
      return 'minimal-ui'
    }
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
      return 'fullscreen'
    }
    return 'browser'
  },

  /**
   * Check if notifications are supported and granted
   */
  canSendNotifications: (): boolean => {
    return 'Notification' in window && Notification.permission === 'granted'
  },

  /**
   * Get device capabilities for PWA features
   */
  getDeviceCapabilities: () => {
    return {
      serviceWorker: 'serviceWorker' in navigator,
      notifications: 'Notification' in window,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      pushMessaging: 'serviceWorker' in navigator && 'PushManager' in window,
      indexedDB: 'indexedDB' in window,
      cacheAPI: 'caches' in window,
      webShare: 'share' in navigator,
      clipboardAPI: 'clipboard' in navigator,
      geolocation: 'geolocation' in navigator,
      deviceMotion: 'DeviceMotionEvent' in window,
      deviceOrientation: 'DeviceOrientationEvent' in window,
      vibration: 'vibrate' in navigator,
      fullscreen: 'requestFullscreen' in document.documentElement,
      screenWakeLock: 'wakeLock' in navigator
    }
  },

  /**
   * Format bytes to human readable format
   */
  formatBytes: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  /**
   * Generate unique ID for offline storage
   */
  generateId: (prefix: string = ''): string => {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },

  /**
   * Check if URL is same origin
   */
  isSameOrigin: (url: string): boolean => {
    try {
      const urlObj = new URL(url, window.location.origin)
      return urlObj.origin === window.location.origin
    } catch {
      return false
    }
  }
}

// Import types for re-export
import type { PWAConfig } from './pwa-manager'
import type { OfflineConfig } from './offline-content-manager'