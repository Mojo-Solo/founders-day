'use client'

/**
 * Monitoring Dashboard Component
 * 
 * Provides a real-time view of application performance and health metrics
 * Only visible in development or when explicitly enabled
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import logger from '../../lib/monitoring/logger'
import performanceMonitor, { PERFORMANCE_THRESHOLDS } from '../../lib/monitoring/performance-monitor'

interface DashboardProps {
  enabled?: boolean
  compact?: boolean
}

export function MonitoringDashboard({ enabled = false, compact = false }: DashboardProps) {
  const [isVisible, setIsVisible] = useState(enabled)
  const [logs, setLogs] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  
  // Show dashboard in development or when enabled
  const shouldShow = process.env.NODE_ENV === 'development' || enabled || isVisible
  
  useEffect(() => {
    if (!shouldShow) return
    
    const updateData = () => {
      setLogs(logger.exportLogs().slice(-50)) // Last 50 logs
      setMetrics(performanceMonitor.getMetrics().slice(-50)) // Last 50 metrics
      setStats(logger.getLogStats())
    }
    
    updateData()
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(updateData, 5000)
    setRefreshInterval(interval)
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [shouldShow])
  
  if (!shouldShow) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsVisible(true)}
          className="bg-black/80 text-white border-gray-600 hover:bg-black/90"
        >
          📊 Show Monitoring
        </Button>
      </div>
    )
  }
  
  const formatMetricValue = (name: string, value: number) => {
    if (name.includes('time') || name.includes('duration')) {
      return `${value.toFixed(1)}ms`
    }
    if (name.includes('size') || name.includes('memory')) {
      return `${(value / 1024 / 1024).toFixed(1)}MB`
    }
    return value.toFixed(2)
  }
  
  const getMetricStatus = (name: string, value: number) => {
    const thresholdKey = name.toUpperCase().replace('_', '_') as keyof typeof PERFORMANCE_THRESHOLDS
    const threshold = PERFORMANCE_THRESHOLDS[thresholdKey]
    
    if (!threshold) return 'default'
    
    if (value <= threshold.good) return 'success'
    if (value <= threshold.needsImprovement) return 'warning'
    return 'destructive'
  }
  
  const LogLevelBadge = ({ level }: { level: string }) => {
    const variants = {
      debug: 'secondary',
      info: 'default',
      warn: 'outline',
      error: 'destructive'
    } as const
    
    return <Badge variant={variants[level as keyof typeof variants] || 'default'}>{level}</Badge>
  }
  
  const compactView = (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="bg-black/90 text-white border-gray-600">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Monitoring</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Logs:</span>
              <span>{stats.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Errors:</span>
              <span className="text-red-400">{stats.byLevel?.error || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Metrics:</span>
              <span>{metrics.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg API:</span>
              <span>{formatMetricValue('api_response_time', performanceMonitor.getAverageMetric('api_response_time'))}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
  
  if (compact) return compactView
  
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="container mx-auto p-4 h-full overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Monitoring Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                logger.clearLogs()
                setLogs([])
                setMetrics([])
              }}
              className="bg-black/80 text-white border-gray-600"
            >
              Clear Data
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsVisible(false)}
              className="bg-black/80 text-white border-gray-600"
            >
              Close
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-gray-800 text-white">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logs">Logs ({stats.total || 0})</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="errors">Errors ({stats.byLevel?.error || 0})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gray-900 text-white border-gray-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-gray-400">Total Logs</CardDescription>
                  <CardTitle className="text-2xl">{stats.total || 0}</CardTitle>
                </CardHeader>
              </Card>
              
              <Card className="bg-gray-900 text-white border-gray-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-gray-400">Errors</CardDescription>
                  <CardTitle className="text-2xl text-red-400">{stats.byLevel?.error || 0}</CardTitle>
                </CardHeader>
              </Card>
              
              <Card className="bg-gray-900 text-white border-gray-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-gray-400">Performance Metrics</CardDescription>
                  <CardTitle className="text-2xl">{metrics.length}</CardTitle>
                </CardHeader>
              </Card>
              
              <Card className="bg-gray-900 text-white border-gray-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-gray-400">Avg API Response</CardDescription>
                  <CardTitle className="text-lg">
                    {formatMetricValue('api_response_time', performanceMonitor.getAverageMetric('api_response_time'))}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-gray-900 text-white border-gray-700">
                <CardHeader>
                  <CardTitle>Recent Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.slice(-10).map((metric, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{metric.name}</span>
                        <Badge variant={getMetricStatus(metric.name, metric.value) === 'success' ? 'default' : 
                                              getMetricStatus(metric.name, metric.value) === 'warning' ? 'outline' : 
                                              'destructive'}>
                          {formatMetricValue(metric.name, metric.value)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-900 text-white border-gray-700">
                <CardHeader>
                  <CardTitle>Log Level Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.byLevel || {}).map(([level, count]) => (
                      <div key={level} className="flex items-center justify-between">
                        <LogLevelBadge level={level} />
                        <span>{count as number}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="logs" className="space-y-4">
            <Card className="bg-gray-900 text-white border-gray-700">
              <CardHeader>
                <CardTitle>Recent Logs</CardTitle>
                <CardDescription className="text-gray-400">
                  Last {logs.length} log entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-auto">
                  {logs.slice().reverse().map((log, index) => (
                    <div key={index} className="border-b border-gray-700 pb-2 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <LogLevelBadge level={log.level} />
                          {log.context.component && (
                            <Badge variant="outline" className="text-xs">
                              {log.context.component}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-gray-300">{log.message}</div>
                      {log.context.metadata && (
                        <div className="text-xs text-gray-500 mt-1">
                          {JSON.stringify(log.context.metadata, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="performance" className="space-y-4">
            <Card className="bg-gray-900 text-white border-gray-700">
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(PERFORMANCE_THRESHOLDS).map(([name, threshold]) => {
                    const avgValue = performanceMonitor.getAverageMetric(name.toLowerCase())
                    const status = avgValue <= threshold.good ? 'success' : 
                                 avgValue <= threshold.needsImprovement ? 'warning' : 'destructive'
                    
                    return (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm">{name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={status === 'success' ? 'default' : 
                                         status === 'warning' ? 'outline' : 
                                         'destructive'}>
                            {formatMetricValue(name, avgValue)}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            (target: {formatMetricValue(name, threshold.good)})
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="errors" className="space-y-4">
            <Card className="bg-gray-900 text-white border-gray-700">
              <CardHeader>
                <CardTitle>Error Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-auto">
                  {logs.filter(log => log.level === 'error').slice().reverse().map((log, index) => (
                    <div key={index} className="border border-red-800 rounded p-3 bg-red-900/20">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="destructive">ERROR</Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-red-300 mb-2">{log.message}</div>
                      {log.stack && (
                        <pre className="text-xs text-gray-400 bg-black/30 p-2 rounded overflow-auto">
                          {log.stack}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default MonitoringDashboard