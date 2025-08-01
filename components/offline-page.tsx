/**
 * Offline Page Component
 * 
 * Displays when users are offline with cached content and helpful messaging
 */

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface OfflinePageProps {
  showRetryButton?: boolean
  customMessage?: string
  enableOfflineContent?: boolean
}

interface OfflineContent {
  schedule?: any[]
  speakers?: any[]
  content?: any
}

export function OfflinePage({ 
  showRetryButton = true, 
  customMessage,
  enableOfflineContent = true 
}: OfflinePageProps) {
  const [offlineContent, setOfflineContent] = useState<OfflineContent>({})
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastOnline, setLastOnline] = useState<Date | null>(null)

  useEffect(() => {
    // Load offline content if available
    if (enableOfflineContent) {
      loadOfflineContent()
    }

    // Check for last online time
    const lastOnlineTime = localStorage.getItem('last-online-time')
    if (lastOnlineTime) {
      setLastOnline(new Date(parseInt(lastOnlineTime)))
    }

    // Listen for online status changes
    const handleOnline = () => {
      localStorage.setItem('last-online-time', Date.now().toString())
      window.location.reload()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [enableOfflineContent])

  const loadOfflineContent = async () => {
    try {
      // Try to load cached content from service worker cache or IndexedDB
      const cacheNames = await caches.keys()
      const apiCache = cacheNames.find(name => name.includes('api'))
      
      if (apiCache) {
        const cache = await caches.open(apiCache)
        
        // Try to get cached schedule
        try {
          const scheduleResponse = await cache.match('/api/schedule')
          if (scheduleResponse) {
            const scheduleData = await scheduleResponse.json()
            setOfflineContent(prev => ({ ...prev, schedule: scheduleData.events || [] }))
          }
        } catch (error) {
          // Ignore cache errors
        }

        // Try to get cached speakers
        try {
          const speakersResponse = await cache.match('/api/speakers')
          if (speakersResponse) {
            const speakersData = await speakersResponse.json()
            setOfflineContent(prev => ({ ...prev, speakers: speakersData.speakers || [] }))
          }
        } catch (error) {
          // Ignore cache errors
        }

        // Try to get cached content
        try {
          const contentResponse = await cache.match('/api/public/content')
          if (contentResponse) {
            const contentData = await contentResponse.json()
            setOfflineContent(prev => ({ ...prev, content: contentData }))
          }
        } catch (error) {
          // Ignore cache errors
        }
      }
    } catch (error) {
      console.warn('Failed to load offline content:', error)
    }
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    
    try {
      // Try to fetch a simple endpoint to check connectivity
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache' 
      })
      
      if (response.ok) {
        // Back online
        localStorage.setItem('last-online-time', Date.now().toString())
        window.location.reload()
      } else {
        throw new Error('Still offline')
      }
    } catch (error) {
      // Still offline
      setTimeout(() => setIsRetrying(false), 1000)
    }
  }

  const formatLastOnline = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                Founders Day Minnesota
              </Link>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center text-sm text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                Offline
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full text-center">
          {/* Offline Icon */}
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-8">
            <svg 
              className="w-12 h-12 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M18 6L6 18M6 6l12 12" 
              />
            </svg>
          </div>

          {/* Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            You're offline
          </h1>
          
          <p className="text-gray-600 mb-6">
            {customMessage || 
             "Don't worry! You can still view some content while offline. We'll reconnect automatically when your internet returns."
            }
          </p>

          {/* Last Online */}
          {lastOnline && (
            <p className="text-sm text-gray-500 mb-6">
              Last online: {formatLastOnline(lastOnline)}
            </p>
          )}

          {/* Retry Button */}
          {showRetryButton && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="
                inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md
                bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mb-8
              "
            >
              {isRetrying ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking connection...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try again
                </>
              )}
            </button>
          )}

          {/* Available Offline Content */}
          {enableOfflineContent && (Object.keys(offlineContent).length > 0) && (
            <div className="border-t pt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Available offline
              </h2>
              
              <div className="space-y-2">
                {offlineContent.schedule && offlineContent.schedule.length > 0 && (
                  <Link 
                    href="/schedule" 
                    className="block p-3 bg-white rounded-lg shadow-sm border hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Event Schedule</div>
                        <div className="text-sm text-gray-500">{offlineContent.schedule.length} events cached</div>
                      </div>
                    </div>
                  </Link>
                )}

                {offlineContent.speakers && offlineContent.speakers.length > 0 && (
                  <Link 
                    href="/speakers" 
                    className="block p-3 bg-white rounded-lg shadow-sm border hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Speakers</div>
                        <div className="text-sm text-gray-500">{offlineContent.speakers.length} speakers cached</div>
                      </div>
                    </div>
                  </Link>
                )}

                <Link 
                  href="/about" 
                  className="block p-3 bg-white rounded-lg shadow-sm border hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">About</div>
                      <div className="text-sm text-gray-500">Event information</div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              💡 Offline Tips
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 text-left">
              <li>• Your forms will be saved and submitted when reconnected</li>
              <li>• Cached content remains available for viewing</li>
              <li>• The app will automatically reconnect when online</li>
              <li>• Consider installing the app for better offline experience</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-500">
            <p>© 2025 Founders Day Minnesota. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OfflinePage