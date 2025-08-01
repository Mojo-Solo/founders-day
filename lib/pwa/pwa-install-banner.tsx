/**
 * PWA Install Banner Component
 * 
 * Provides an attractive, accessible install prompt for the PWA
 * with smart timing and user-friendly messaging
 */

'use client'

import React, { useState, useEffect } from 'react'
import PWAManager from './pwa-manager'
import logger from '../monitoring/logger'

interface PWAInstallBannerProps {
  pwaManager: PWAManager
  showDelay?: number
  autoHideAfter?: number
  position?: 'top' | 'bottom'
  theme?: 'light' | 'dark' | 'auto'
  customMessage?: string
  showOnMobile?: boolean
  showOnDesktop?: boolean
}

export function PWAInstallBanner({
  pwaManager,
  showDelay = 30000, // Show after 30 seconds
  autoHideAfter = 0, // Don't auto-hide
  position = 'bottom',
  theme = 'auto',
  customMessage,
  showOnMobile = true,
  showOnDesktop = true
}: PWAInstallBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check if mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
      
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setIsDismissed(true)
        return
      }
    }

    // Check device support
    if ((isMobile && !showOnMobile) || (!isMobile && !showOnDesktop)) {
      return
    }

    // Set up PWA manager event listeners
    const unsubscribeInstallPrompt = pwaManager.on('install-prompt-available', () => {
      setCanInstall(true)
      
      // Show banner after delay
      setTimeout(() => {
        if (!isDismissed) {
          setIsVisible(true)
          
          logger.info('PWA install banner shown', {
            component: 'PWAInstallBanner',
            metadata: { delay: showDelay, isMobile }
          })
        }
      }, showDelay)
    })

    const unsubscribeAppInstalled = pwaManager.on('app-installed', () => {
      setIsVisible(false)
      setCanInstall(false)
      
      logger.info('PWA installed, hiding banner', {
        component: 'PWAInstallBanner'
      })
    })

    // Auto-hide after specified time
    if (autoHideAfter > 0 && isVisible) {
      const autoHideTimer = setTimeout(() => {
        handleDismiss()
      }, autoHideAfter)

      return () => clearTimeout(autoHideTimer)
    }

    return () => {
      unsubscribeInstallPrompt()
      unsubscribeAppInstalled()
      window.removeEventListener('resize', checkMobile)
    }
  }, [pwaManager, showDelay, autoHideAfter, isDismissed, isMobile, showOnMobile, showOnDesktop, isVisible])

  const handleInstall = async () => {
    if (!canInstall) {
      return
    }

    setIsInstalling(true)

    try {
      const result = await pwaManager.promptInstall()
      
      if (result.outcome === 'accepted') {
        setIsVisible(false)
        setCanInstall(false)
        
        logger.info('PWA install accepted', {
          component: 'PWAInstallBanner'
        })
      } else {
        handleDismiss()
        
        logger.info('PWA install dismissed', {
          component: 'PWAInstallBanner'
        })
      }
    } catch (error) {
      logger.error('PWA install failed', {
        component: 'PWAInstallBanner',
        metadata: { error: (error as Error).message }
      })
    } finally {
      setIsInstalling(false)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    
    // Remember dismissal
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
    
    logger.debug('PWA install banner dismissed', {
      component: 'PWAInstallBanner'
    })
  }

  const getThemeClasses = () => {
    if (theme === 'auto') {
      return 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700'
    } else if (theme === 'dark') {
      return 'bg-gray-900 text-white border-gray-700'
    } else {
      return 'bg-white text-gray-900 border-gray-200'
    }
  }

  const getPositionClasses = () => {
    return position === 'top' 
      ? 'top-0 border-b' 
      : 'bottom-0 border-t'
  }

  const getMessage = () => {
    if (customMessage) {
      return customMessage
    }

    if (isMobile) {
      return 'Add Founders Day to your home screen for quick access and offline features!'
    } else {
      return 'Install the Founders Day app for a better experience with offline access and notifications!'
    }
  }

  if (!isVisible || !canInstall || isDismissed) {
    return null
  }

  return (
    <div
      className={`
        fixed left-0 right-0 z-50 border transition-all duration-300 ease-in-out
        ${getThemeClasses()}
        ${getPositionClasses()}
        ${isVisible ? 'transform translate-y-0 opacity-100' : 'transform translate-y-full opacity-0'}
      `}
      role="banner"
      aria-live="polite"
      aria-label="App installation prompt"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* Icon and Message */}
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg 
                  className="w-6 h-6 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" 
                  />
                </svg>
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Install Founders Day App
              </p>
              <p className="text-xs opacity-75 mt-1">
                {getMessage()}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="
                inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
                bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200
              "
              aria-label="Install the Founders Day app"
            >
              {isInstalling ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Installing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Install
                </>
              )}
            </button>

            <button
              onClick={handleDismiss}
              className="
                inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-md
                text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500
                transition-colors duration-200
              "
              aria-label="Dismiss install prompt"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PWAInstallBanner