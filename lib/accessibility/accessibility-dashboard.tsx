/**
 * Accessibility Dashboard Component
 * 
 * Real-time accessibility monitoring dashboard with WCAG compliance tracking,
 * violation reporting, and actionable recommendations
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  AccessibilityDashboardData,
  AccessibilityMetrics,
  AccessibilityRecommendation,
  AccessibilityAuditResult,
  AccessibilityCategory,
  ACCESSIBILITY_PRIORITIES,
  COMPLIANCE_LEVELS
} from './accessibility-types'

import AccessibilityAuditor from './accessibility-auditor'
import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'

interface AccessibilityDashboardProps {
  auditor: AccessibilityAuditor
  autoRefresh?: boolean
  refreshInterval?: number
}

export function AccessibilityDashboard({
  auditor,
  autoRefresh = true,
  refreshInterval = 30000
}: AccessibilityDashboardProps) {
  const [dashboardData, setDashboardData] = useState<AccessibilityDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)
  const [autoRunning, setAutoRunning] = useState(false)

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const startTime = performance.now()

      // Get metrics from auditor
      const metrics = auditor.getMetrics()
      const recommendations = auditor.getRecommendations()
      const auditHistory = auditor.getAuditHistory()

      // Build dashboard data
      const data: AccessibilityDashboardData = {
        overview: {
          overallScore: metrics.complianceScore,
          totalViolations: Object.values(metrics.violationsBySeverity).reduce((sum, count) => sum + count, 0),
          criticalIssues: metrics.violationsBySeverity.critical,
          wcagLevel: metrics.wcagLevel,
          lastAudit: auditHistory.length > 0 ? auditHistory[auditHistory.length - 1].timestamp : 0,
          trend: calculateTrend(metrics.trendsOverTime)
        },
        categoryBreakdown: Object.entries(metrics.violationsByCategory).map(([category, violations]) => ({
          category: category as AccessibilityCategory,
          violations,
          score: calculateCategoryScore(violations),
          status: getCategoryStatus(violations)
        })),
        recentAudits: auditHistory.slice(-10).map(audit => ({
          id: audit.id,
          timestamp: audit.timestamp,
          url: audit.url,
          score: audit.summary.complianceScore,
          violations: audit.summary.totalViolations,
          status: audit.summary.wcagLevel === 'fail' ? 'fail' : 'pass'
        })),
        topIssues: getTopIssues(auditHistory),
        recommendations: recommendations.slice(0, 5)
      }

      setDashboardData(data)
      setLastUpdate(Date.now())

      const loadTime = performance.now() - startTime

      performanceMonitor.recordMetric('accessibility_dashboard_load_time', loadTime, {
        success: true,
        dataSize: JSON.stringify(data).length
      })

      logger.debug('Accessibility dashboard data loaded', {
        component: 'AccessibilityDashboard',
        metadata: {
          loadTime,
          totalViolations: data.overview.totalViolations,
          score: data.overview.overallScore
        }
      })

    } catch (error) {
      const errorMessage = (error as Error).message

      setError(errorMessage)

      logger.error('Failed to load accessibility dashboard data', {
        component: 'AccessibilityDashboard',
        metadata: { error: errorMessage }
      })

      performanceMonitor.recordMetric('accessibility_dashboard_load_error', 0, {
        success: false,
        error: errorMessage
      })
    } finally {
      setLoading(false)
    }
  }, [auditor])

  // Run new accessibility audit
  const runNewAudit = useCallback(async () => {
    try {
      setAutoRunning(true)

      logger.info('Running new accessibility audit from dashboard', {
        component: 'AccessibilityDashboard'
      })

      await auditor.runAudit(document.body, {
        includeKeyboard: true,
        includeColorContrast: true,
        includeScreenReader: true
      })

      // Reload dashboard data
      await loadDashboardData()

    } catch (error) {
      setError(`Failed to run audit: ${(error as Error).message}`)

      logger.error('Dashboard audit failed', {
        component: 'AccessibilityDashboard',
        metadata: { error: (error as Error).message }
      })
    } finally {
      setAutoRunning(false)
    }
  }, [auditor, loadDashboardData])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(loadDashboardData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, loadDashboardData])

  // Initial load
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Event listener for audit completion
  useEffect(() => {
    const unsubscribe = auditor.on('audit_completed', () => {
      loadDashboardData()
    })

    return unsubscribe
  }, [auditor, loadDashboardData])

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading accessibility dashboard...</span>
      </div>
    )
  }

  if (error && !dashboardData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="text-red-600 font-semibold">Error loading dashboard</div>
        </div>
        <div className="text-red-700 mt-2">{error}</div>
        <button
          onClick={loadDashboardData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  return (
    <div className="accessibility-dashboard space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accessibility Dashboard</h1>
          <p className="text-gray-600 mt-1">
            WCAG 2.1 AA compliance monitoring and reporting
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
          </div>
          <button
            onClick={runNewAudit}
            disabled={autoRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {autoRunning ? 'Running Audit...' : 'Run New Audit'}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <OverviewCard
          title="Overall Score"
          value={`${dashboardData.overview.overallScore}%`}
          status={getScoreStatus(dashboardData.overview.overallScore)}
          trend={dashboardData.overview.trend}
        />
        <OverviewCard
          title="WCAG Level"
          value={dashboardData.overview.wcagLevel}
          status={dashboardData.overview.wcagLevel === 'fail' ? 'error' : 'success'}
        />
        <OverviewCard
          title="Total Violations"
          value={dashboardData.overview.totalViolations.toString()}
          status={dashboardData.overview.totalViolations === 0 ? 'success' : 'warning'}
        />
        <OverviewCard
          title="Critical Issues"
          value={dashboardData.overview.criticalIssues.toString()}
          status={dashboardData.overview.criticalIssues === 0 ? 'success' : 'error'}
        />
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Violations by Category</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardData.categoryBreakdown.map((category) => (
              <CategoryCard key={category.category} category={category} />
            ))}
          </div>
        </div>
      </div>

      {/* Recent Audits and Top Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Audits */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Audits</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {dashboardData.recentAudits.map((audit) => (
                <AuditCard key={audit.id} audit={audit} />
              ))}
            </div>
          </div>
        </div>

        {/* Top Issues */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top Issues</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {dashboardData.topIssues.map((issue, index) => (
                <IssueCard key={issue.ruleId} issue={issue} rank={index + 1} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Priority Recommendations</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {dashboardData.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-yellow-800">
            <strong>Warning:</strong> {error}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper Components

interface OverviewCardProps {
  title: string
  value: string
  status: 'success' | 'warning' | 'error' | 'info'
  trend?: 'improving' | 'declining' | 'stable'
}

function OverviewCard({ title, value, status, trend }: OverviewCardProps) {
  const statusColors = {
    success: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200'
  }

  const trendIcons = {
    improving: '↗️',
    declining: '↘️',
    stable: '➡️'
  }

  return (
    <div className={`rounded-lg border p-4 ${statusColors[status]}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium opacity-75">{title}</div>
        {trend && (
          <span className="text-xs opacity-60">
            {trendIcons[trend]} {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  )
}

interface CategoryCardProps {
  category: {
    category: AccessibilityCategory
    violations: number
    score: number
    status: 'excellent' | 'good' | 'needs-improvement' | 'poor'
  }
}

function CategoryCard({ category }: CategoryCardProps) {
  const statusColors = {
    excellent: 'text-green-600',
    good: 'text-blue-600',
    'needs-improvement': 'text-yellow-600',
    poor: 'text-red-600'
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium capitalize">
          {category.category.replace('-', ' ')}
        </div>
        <div className={`text-sm font-medium ${statusColors[category.status]}`}>
          {category.violations} issues
        </div>
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Score</span>
          <span>{category.score}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
          <div
            className={`h-2 rounded-full ${
              category.score >= 80 ? 'bg-green-500' :
              category.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${category.score}%` }}
          />
        </div>
      </div>
    </div>
  )
}

interface AuditCardProps {
  audit: {
    id: string
    timestamp: number
    url: string
    score: number
    violations: number
    status: 'pass' | 'fail'
  }
}

function AuditCard({ audit }: AuditCardProps) {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div className="flex-1">
        <div className="text-sm font-medium truncate">{audit.url}</div>
        <div className="text-xs text-gray-500">
          {new Date(audit.timestamp).toLocaleString()}
        </div>
      </div>
      <div className="text-right ml-4">
        <div className={`text-sm font-medium ${
          audit.status === 'pass' ? 'text-green-600' : 'text-red-600'
        }`}>
          {audit.score}%
        </div>
        <div className="text-xs text-gray-500">
          {audit.violations} issues
        </div>
      </div>
    </div>
  )
}

interface IssueCardProps {
  issue: {
    ruleId: string
    name: string
    occurrences: number
    severity: string
    pages: string[]
  }
  rank: number
}

function IssueCard({ issue, rank }: IssueCardProps) {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
          {rank}
        </div>
        <div>
          <div className="text-sm font-medium">{issue.name}</div>
          <div className="text-xs text-gray-500">
            {issue.occurrences} occurrences on {issue.pages.length} pages
          </div>
        </div>
      </div>
      <div className={`text-xs px-2 py-1 rounded-full ${
        issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
        issue.severity === 'serious' ? 'bg-orange-100 text-orange-800' :
        issue.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        {issue.severity}
      </div>
    </div>
  )
}

interface RecommendationCardProps {
  recommendation: AccessibilityRecommendation
}

function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <div className={`text-xs px-2 py-1 rounded-full ${
              recommendation.priority === 'high' ? 'bg-red-100 text-red-800' :
              recommendation.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {recommendation.priority} priority
            </div>
            <div className="text-xs text-gray-500">
              {recommendation.effort} effort
            </div>
          </div>
          <div className="font-medium mt-2">{recommendation.title}</div>
          <div className="text-sm text-gray-600 mt-1">{recommendation.description}</div>
          <div className="text-xs text-gray-500 mt-1">{recommendation.impact}</div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-4 text-sm text-blue-600 hover:text-blue-800"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium mb-2">Implementation Steps:</div>
              <ol className="text-sm text-gray-600 space-y-1">
                {recommendation.implementation.steps.map((step, index) => (
                  <li key={index} className="flex">
                    <span className="mr-2">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {recommendation.implementation.codeExample && (
              <div>
                <div className="text-sm font-medium mb-2">Code Example:</div>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {recommendation.implementation.codeExample}
                </pre>
              </div>
            )}

            <div>
              <div className="text-sm font-medium mb-2">Testing Instructions:</div>
              <ul className="text-sm text-gray-600 space-y-1">
                {recommendation.implementation.testingInstructions.map((instruction, index) => (
                  <li key={index} className="flex">
                    <span className="mr-2">•</span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper Functions

function getScoreStatus(score: number): 'success' | 'warning' | 'error' | 'info' {
  if (score >= COMPLIANCE_LEVELS.AA.threshold) return 'success'
  if (score >= COMPLIANCE_LEVELS.A.threshold) return 'warning'
  return 'error'
}

function calculateTrend(trendsOverTime: { date: string; score: number; violations: number }[]): 'improving' | 'declining' | 'stable' {
  if (trendsOverTime.length < 2) return 'stable'

  const recent = trendsOverTime.slice(-5)
  const firstScore = recent[0].score
  const lastScore = recent[recent.length - 1].score

  const improvement = lastScore - firstScore

  if (improvement > 5) return 'improving'
  if (improvement < -5) return 'declining'
  return 'stable'
}

function calculateCategoryScore(violations: number): number {
  return Math.max(0, 100 - violations * 10)
}

function getCategoryStatus(violations: number): 'excellent' | 'good' | 'needs-improvement' | 'poor' {
  if (violations === 0) return 'excellent'
  if (violations <= 2) return 'good'
  if (violations <= 5) return 'needs-improvement'
  return 'poor'
}

function getTopIssues(auditHistory: AccessibilityAuditResult[]): {
  ruleId: string
  name: string
  occurrences: number
  severity: string
  pages: string[]
}[] {
  if (auditHistory.length === 0) return []

  // Aggregate violations across all audits
  const issueMap = new Map()

  auditHistory.forEach(audit => {
    audit.violations.forEach(violation => {
      const key = violation.ruleId
      if (!issueMap.has(key)) {
        issueMap.set(key, {
          ruleId: violation.ruleId,
          name: violation.message,
          occurrences: 0,
          severity: violation.severity,
          pages: new Set()
        })
      }

      const issue = issueMap.get(key)
      issue.occurrences++
      issue.pages.add(audit.url)
    })
  })

  // Convert to array and sort by occurrences
  return Array.from(issueMap.values())
    .map(issue => ({
      ...issue,
      pages: Array.from(issue.pages)
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5)
}

export default AccessibilityDashboard