/**
 * Accessibility Test Runner
 * 
 * Automated accessibility testing framework with scheduled audits,
 * continuous monitoring, and comprehensive reporting
 */

import {
  AccessibilityTestSuite,
  AccessibilityTest,
  AccessibilityAuditResult,
  AccessibilityEvent,
  AccessibilityEventType,
  AccessibilityConfig
} from './accessibility-types'

import AccessibilityAuditor from './accessibility-auditor'
import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'
import { captureError } from '../monitoring/sentry-config'

interface TestRunnerConfig {
  enableScheduledTests: boolean
  enableContinuousMonitoring: boolean
  reportingEnabled: boolean
  notificationEndpoint?: string
  maxConcurrentTests: number
  testTimeout: number
}

interface TestResult {
  testId: string
  testName: string
  status: 'passed' | 'failed' | 'skipped' | 'error'
  violations: number
  score: number
  duration: number
  error?: string
  details?: any
}

interface TestRunSummary {
  runId: string
  timestamp: number
  suiteId: string
  suiteName: string
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  errorTests: number
  overallScore: number
  duration: number
  results: TestResult[]
}

class AccessibilityTestRunner {
  private config: TestRunnerConfig
  private auditor: AccessibilityAuditor
  private testSuites: Map<string, AccessibilityTestSuite> = new Map()
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map()
  private runningTests: Set<string> = new Set()
  private testHistory: TestRunSummary[] = []
  private eventListeners: Map<string, Function[]> = new Map()
  private isInitialized = false

  constructor(
    auditor: AccessibilityAuditor,
    config?: Partial<TestRunnerConfig>
  ) {
    this.auditor = auditor
    this.config = {
      enableScheduledTests: true,
      enableContinuousMonitoring: true,
      reportingEnabled: true,
      maxConcurrentTests: 3,
      testTimeout: 30000,
      ...config
    }
  }

  /**
   * Initialize the test runner
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Accessibility test runner already initialized', {
        component: 'AccessibilityTestRunner'
      })
      return
    }

    const startTime = performance.now()

    try {
      logger.info('Initializing accessibility test runner...', {
        component: 'AccessibilityTestRunner',
        metadata: { config: this.config }
      })

      // Initialize auditor if not already done
      if (!this.auditor) {
        throw new Error('AccessibilityAuditor is required')
      }

      // Set up default test suites
      await this.createDefaultTestSuites()

      // Start scheduled tests if enabled
      if (this.config.enableScheduledTests) {
        this.startScheduledTests()
      }

      // Start continuous monitoring if enabled
      if (this.config.enableContinuousMonitoring) {
        this.startContinuousMonitoring()
      }

      this.isInitialized = true

      const initTime = performance.now() - startTime

      performanceMonitor.recordMetric('accessibility_test_runner_init_time', initTime, {
        success: true,
        suiteCount: this.testSuites.size
      })

      logger.info(`Accessibility test runner initialized in ${initTime.toFixed(2)}ms`, {
        component: 'AccessibilityTestRunner',
        metadata: {
          initTime,
          suiteCount: this.testSuites.size,
          config: this.config
        }
      })

    } catch (error) {
      const initTime = performance.now() - startTime

      performanceMonitor.recordMetric('accessibility_test_runner_init_error', initTime, {
        success: false,
        error: (error as Error).message
      })

      logger.error('Failed to initialize accessibility test runner', {
        component: 'AccessibilityTestRunner',
        metadata: { error: (error as Error).message }
      })

      captureError(error as Error, {
        component: 'AccessibilityTestRunner',
        phase: 'initialization'
      })

      throw error
    }
  }

  /**
   * Add test suite
   */
  addTestSuite(suite: AccessibilityTestSuite): void {
    this.testSuites.set(suite.id, suite)

    // Schedule if it has a schedule
    if (suite.schedule && suite.schedule.enabled) {
      this.scheduleTestSuite(suite)
    }

    logger.debug(`Test suite added: ${suite.name}`, {
      component: 'AccessibilityTestRunner',
      metadata: {
        suiteId: suite.id,
        testCount: suite.tests.length,
        scheduled: !!suite.schedule?.enabled
      }
    })
  }

  /**
   * Remove test suite
   */
  removeTestSuite(suiteId: string): void {
    // Cancel scheduled job if exists
    if (this.scheduledJobs.has(suiteId)) {
      clearInterval(this.scheduledJobs.get(suiteId)!)
      this.scheduledJobs.delete(suiteId)
    }

    this.testSuites.delete(suiteId)

    logger.debug(`Test suite removed: ${suiteId}`, {
      component: 'AccessibilityTestRunner'
    })
  }

  /**
   * Run specific test suite
   */
  async runTestSuite(suiteId: string): Promise<TestRunSummary> {
    const suite = this.testSuites.get(suiteId)
    if (!suite) {
      throw new Error(`Test suite not found: ${suiteId}`)
    }

    if (this.runningTests.has(suiteId)) {
      throw new Error(`Test suite is already running: ${suiteId}`)
    }

    if (this.runningTests.size >= this.config.maxConcurrentTests) {
      throw new Error('Maximum concurrent tests limit reached')
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = performance.now()

    this.runningTests.add(suiteId)

    logger.info(`Starting test suite: ${suite.name}`, {
      component: 'AccessibilityTestRunner',
      metadata: {
        runId,
        suiteId,
        testCount: suite.tests.length
      }
    })

    try {
      const results: TestResult[] = []

      // Run each test in the suite
      for (const test of suite.tests) {
        if (this.runningTests.size > this.config.maxConcurrentTests) {
          // Skip if we've exceeded concurrent limit
          results.push({
            testId: test.id,
            testName: test.name,
            status: 'skipped',
            violations: 0,
            score: 0,
            duration: 0,
            error: 'Concurrent test limit exceeded'
          })
          continue
        }

        const testResult = await this.runSingleTest(test)
        results.push(testResult)
      }

      // Calculate summary
      const summary: TestRunSummary = {
        runId,
        timestamp: Date.now(),
        suiteId: suite.id,
        suiteName: suite.name,
        totalTests: suite.tests.length,
        passedTests: results.filter(r => r.status === 'passed').length,
        failedTests: results.filter(r => r.status === 'failed').length,
        skippedTests: results.filter(r => r.status === 'skipped').length,
        errorTests: results.filter(r => r.status === 'error').length,
        overallScore: this.calculateOverallScore(results),
        duration: performance.now() - startTime,
        results
      }

      // Store in history
      this.testHistory.push(summary)

      // Limit history size
      if (this.testHistory.length > 100) {
        this.testHistory = this.testHistory.slice(-50)
      }

      // Send notifications if enabled
      if (this.config.reportingEnabled) {
        await this.sendTestReport(summary)
      }

      // Emit event
      this.emitEvent('test_suite_completed', {
        runId,
        suiteId,
        summary
      })

      performanceMonitor.recordMetric('accessibility_test_suite_duration', summary.duration, {
        suiteId,
        totalTests: summary.totalTests,
        passedTests: summary.passedTests,
        failedTests: summary.failedTests,
        overallScore: summary.overallScore
      })

      logger.info(`Test suite completed: ${suite.name}`, {
        component: 'AccessibilityTestRunner',
        metadata: {
          runId,
          duration: summary.duration,
          results: {
            total: summary.totalTests,
            passed: summary.passedTests,
            failed: summary.failedTests,
            score: summary.overallScore
          }
        }
      })

      return summary

    } catch (error) {
      const duration = performance.now() - startTime

      performanceMonitor.recordMetric('accessibility_test_suite_error', duration, {
        suiteId,
        error: (error as Error).message
      })

      logger.error(`Test suite failed: ${suite.name}`, {
        component: 'AccessibilityTestRunner',
        metadata: {
          runId,
          suiteId,
          error: (error as Error).message,
          duration
        }
      })

      captureError(error as Error, {
        component: 'AccessibilityTestRunner',
        runId,
        suiteId,
        suiteName: suite.name
      })

      throw error

    } finally {
      this.runningTests.delete(suiteId)
    }
  }

  /**
   * Run all test suites
   */
  async runAllTestSuites(): Promise<TestRunSummary[]> {
    const suiteIds = Array.from(this.testSuites.keys())
    const results: TestRunSummary[] = []

    logger.info(`Running all test suites (${suiteIds.length})`, {
      component: 'AccessibilityTestRunner'
    })

    for (const suiteId of suiteIds) {
      try {
        const result = await this.runTestSuite(suiteId)
        results.push(result)
      } catch (error) {
        logger.error(`Failed to run test suite: ${suiteId}`, {
          component: 'AccessibilityTestRunner',
          metadata: { error: (error as Error).message }
        })
      }
    }

    return results
  }

  /**
   * Get test history
   */
  getTestHistory(): TestRunSummary[] {
    return [...this.testHistory]
  }

  /**
   * Get running tests
   */
  getRunningTests(): string[] {
    return Array.from(this.runningTests)
  }

  /**
   * Subscribe to test events
   */
  on(eventType: string, callback: Function): () => void {
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

  /**
   * Stop all scheduled tests
   */
  stopScheduledTests(): void {
    this.scheduledJobs.forEach((job, suiteId) => {
      clearInterval(job)
      logger.debug(`Stopped scheduled test: ${suiteId}`, {
        component: 'AccessibilityTestRunner'
      })
    })

    this.scheduledJobs.clear()
  }

  /**
   * Destroy test runner and cleanup
   */
  destroy(): void {
    this.stopScheduledTests()
    this.eventListeners.clear()
    this.runningTests.clear()
    this.isInitialized = false

    logger.info('Accessibility test runner destroyed', {
      component: 'AccessibilityTestRunner'
    })
  }

  // Private methods

  private async createDefaultTestSuites(): Promise<void> {
    // Basic WCAG compliance test suite
    const basicSuite: AccessibilityTestSuite = {
      id: 'basic-wcag-compliance',
      name: 'Basic WCAG 2.1 AA Compliance',
      description: 'Core accessibility compliance tests',
      tests: [
        {
          id: 'page-structure',
          name: 'Page Structure',
          description: 'Check for proper heading structure and landmarks',
          type: 'automated',
          category: 'structure',
          wcagCriteria: ['1.3.1', '2.4.1', '2.4.6'],
          testFunction: 'checkPageStructure',
          priority: 'high'
        },
        {
          id: 'color-contrast',
          name: 'Color Contrast',
          description: 'Verify color contrast ratios meet WCAG standards',
          type: 'automated',
          category: 'color-contrast',
          wcagCriteria: ['1.4.3'],
          testFunction: 'checkColorContrast',
          priority: 'high'
        },
        {
          id: 'keyboard-navigation',
          name: 'Keyboard Navigation',
          description: 'Test keyboard accessibility',
          type: 'keyboard',
          category: 'keyboard',
          wcagCriteria: ['2.1.1', '2.1.2', '2.4.7'],
          testFunction: 'checkKeyboardNavigation',
          priority: 'high'
        },
        {
          id: 'images-alt-text',
          name: 'Image Alt Text',
          description: 'Check images have appropriate alt text',
          type: 'automated',
          category: 'images',
          wcagCriteria: ['1.1.1'],
          testFunction: 'checkImageAltText',
          priority: 'high'
        }
      ],
      schedule: {
        frequency: 'daily',
        time: '02:00',
        enabled: true
      },
      notifications: {
        onFailure: true,
        onImprovement: true,
        recipients: ['admin@foundersday.org']
      }
    }

    // Form accessibility test suite
    const formSuite: AccessibilityTestSuite = {
      id: 'form-accessibility',
      name: 'Form Accessibility',
      description: 'Test form controls and labeling',
      tests: [
        {
          id: 'form-labels',
          name: 'Form Labels',
          description: 'Check all form controls have proper labels',
          type: 'automated',
          category: 'forms',
          wcagCriteria: ['3.3.2'],
          testFunction: 'checkFormLabels',
          priority: 'high'
        },
        {
          id: 'form-errors',
          name: 'Form Error Handling',
          description: 'Test form error identification and suggestions',
          type: 'manual',
          category: 'forms',
          wcagCriteria: ['3.3.1', '3.3.3'],
          testFunction: 'checkFormErrors',
          priority: 'medium'
        }
      ],
      schedule: {
        frequency: 'weekly',
        time: '01:00',
        enabled: false
      },
      notifications: {
        onFailure: true,
        onImprovement: false,
        recipients: ['dev@foundersday.org']
      }
    }

    this.addTestSuite(basicSuite)
    this.addTestSuite(formSuite)

    logger.debug('Default test suites created', {
      component: 'AccessibilityTestRunner',
      metadata: { suiteCount: 2 }
    })
  }

  private scheduleTestSuite(suite: AccessibilityTestSuite): void {
    if (!suite.schedule || !suite.schedule.enabled) {
      return
    }

    const interval = this.getScheduleInterval(suite.schedule.frequency)
    
    const job = setInterval(async () => {
      try {
        logger.info(`Running scheduled test suite: ${suite.name}`, {
          component: 'AccessibilityTestRunner',
          metadata: { suiteId: suite.id }
        })

        await this.runTestSuite(suite.id)
      } catch (error) {
        logger.error(`Scheduled test suite failed: ${suite.name}`, {
          component: 'AccessibilityTestRunner',
          metadata: {
            suiteId: suite.id,
            error: (error as Error).message
          }
        })
      }
    }, interval)

    this.scheduledJobs.set(suite.id, job)

    logger.debug(`Scheduled test suite: ${suite.name}`, {
      component: 'AccessibilityTestRunner',
      metadata: {
        suiteId: suite.id,
        frequency: suite.schedule.frequency,
        interval
      }
    })
  }

  private getScheduleInterval(frequency: 'daily' | 'weekly' | 'monthly'): number {
    switch (frequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000 // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000 // 7 days
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000 // 30 days
      default:
        return 24 * 60 * 60 * 1000
    }
  }

  private async runSingleTest(test: AccessibilityTest): Promise<TestResult> {
    const startTime = performance.now()

    logger.debug(`Running test: ${test.name}`, {
      component: 'AccessibilityTestRunner',
      metadata: { testId: test.id, type: test.type }
    })

    try {
      let result: TestResult

      switch (test.type) {
        case 'automated':
          result = await this.runAutomatedTest(test)
          break
        case 'keyboard':
          result = await this.runKeyboardTest(test)
          break
        case 'color-contrast':
          result = await this.runColorContrastTest(test)
          break
        case 'screen-reader':
          result = await this.runScreenReaderTest(test)
          break
        case 'manual':
          result = await this.runManualTest(test)
          break
        default:
          throw new Error(`Unknown test type: ${test.type}`)
      }

      result.duration = performance.now() - startTime

      performanceMonitor.recordMetric('accessibility_test_duration', result.duration, {
        testId: test.id,
        testType: test.type,
        status: result.status,
        violations: result.violations
      })

      return result

    } catch (error) {
      const duration = performance.now() - startTime

      performanceMonitor.recordMetric('accessibility_test_error', duration, {
        testId: test.id,
        testType: test.type,
        error: (error as Error).message
      })

      return {
        testId: test.id,
        testName: test.name,
        status: 'error',
        violations: 0,
        score: 0,
        duration,
        error: (error as Error).message
      }
    }
  }

  private async runAutomatedTest(test: AccessibilityTest): Promise<TestResult> {
    // Run axe-core audit focused on this test's category
    const auditResult = await this.auditor.runAudit(document.body)
    
    // Filter violations related to this test
    const relevantViolations = auditResult.violations.filter(violation =>
      test.wcagCriteria.some(criteria => violation.wcagCriteria.includes(criteria))
    )

    const violations = relevantViolations.length
    const status = violations === 0 ? 'passed' : 'failed'
    const score = Math.max(0, 100 - violations * 10)

    return {
      testId: test.id,
      testName: test.name,
      status,
      violations,
      score,
      duration: 0, // Will be set by caller
      details: {
        violations: relevantViolations,
        auditId: auditResult.id
      }
    }
  }

  private async runKeyboardTest(test: AccessibilityTest): Promise<TestResult> {
    const keyboardTests = await this.auditor.testKeyboardNavigation()
    
    const failedTests = keyboardTests.filter(t => !t.passed)
    const violations = failedTests.length
    const status = violations === 0 ? 'passed' : 'failed'
    const score = Math.max(0, 100 - violations * 20)

    return {
      testId: test.id,
      testName: test.name,
      status,
      violations,
      score,
      duration: 0,
      details: {
        keyboardTests,
        failedTests
      }
    }
  }

  private async runColorContrastTest(test: AccessibilityTest): Promise<TestResult> {
    const contrastTests = await this.auditor.testColorContrast()
    
    const failedTests = contrastTests.filter(t => t.wcagAAResult === 'fail')
    const violations = failedTests.length
    const status = violations === 0 ? 'passed' : 'failed'
    const score = Math.max(0, 100 - violations * 5)

    return {
      testId: test.id,
      testName: test.name,
      status,
      violations,
      score,
      duration: 0,
      details: {
        contrastTests,
        failedTests
      }
    }
  }

  private async runScreenReaderTest(test: AccessibilityTest): Promise<TestResult> {
    // Screen reader tests are currently limited - mark as manual review
    return {
      testId: test.id,
      testName: test.name,
      status: 'skipped',
      violations: 0,
      score: 0,
      duration: 0,
      error: 'Screen reader testing requires manual verification'
    }
  }

  private async runManualTest(test: AccessibilityTest): Promise<TestResult> {
    // Manual tests need to be marked for human review
    return {
      testId: test.id,
      testName: test.name,
      status: 'skipped',
      violations: 0,
      score: 0,
      duration: 0,
      error: 'Manual test requires human verification'
    }
  }

  private calculateOverallScore(results: TestResult[]): number {
    if (results.length === 0) return 0

    const totalScore = results.reduce((sum, result) => sum + result.score, 0)
    return Math.round(totalScore / results.length)
  }

  private async sendTestReport(summary: TestRunSummary): Promise<void> {
    if (!this.config.notificationEndpoint) {
      return
    }

    try {
      const report = {
        runId: summary.runId,
        timestamp: summary.timestamp,
        suiteName: summary.suiteName,
        results: {
          total: summary.totalTests,
          passed: summary.passedTests,
          failed: summary.failedTests,
          score: summary.overallScore
        },
        duration: summary.duration,
        url: window.location.href
      }

      await fetch(this.config.notificationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      })

      logger.debug('Test report sent', {
        component: 'AccessibilityTestRunner',
        metadata: { runId: summary.runId }
      })

    } catch (error) {
      logger.error('Failed to send test report', {
        component: 'AccessibilityTestRunner',
        metadata: { error: (error as Error).message }
      })
    }
  }

  private startScheduledTests(): void {
    this.testSuites.forEach(suite => {
      if (suite.schedule && suite.schedule.enabled) {
        this.scheduleTestSuite(suite)
      }
    })

    logger.info('Scheduled tests started', {
      component: 'AccessibilityTestRunner',
      metadata: { scheduledSuites: this.scheduledJobs.size }
    })
  }

  private startContinuousMonitoring(): void {
    // Set up DOM mutation observer for continuous testing
    if (typeof window === 'undefined') return

    const observer = new MutationObserver((mutations) => {
      let hasSignificantChanges = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          hasSignificantChanges = true
        }
      })

      if (hasSignificantChanges) {
        // Run quick accessibility check on changes
        setTimeout(() => {
          this.runQuickCheck()
        }, 2000) // Debounce
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    logger.info('Continuous monitoring started', {
      component: 'AccessibilityTestRunner'
    })
  }

  private async runQuickCheck(): Promise<void> {
    try {
      const quickResult = await this.auditor.quickCheck(document.body)
      
      if (quickResult.critical > 0) {
        this.emitEvent('critical_violation_detected', {
          violations: quickResult.violations,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      logger.debug('Quick accessibility check failed', {
        component: 'AccessibilityTestRunner',
        metadata: { error: (error as Error).message }
      })
    }
  }

  private emitEvent(eventType: string, data?: any): void {
    const callbacks = this.eventListeners.get(eventType)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({ type: eventType, timestamp: Date.now(), ...data })
        } catch (error) {
          logger.error(`Test runner event callback error: ${eventType}`, {
            component: 'AccessibilityTestRunner',
            metadata: { error: (error as Error).message }
          })
        }
      })
    }

    // Log important events
    if (['test_suite_completed', 'critical_violation_detected'].includes(eventType)) {
      logger.info(`Test runner event: ${eventType}`, {
        component: 'AccessibilityTestRunner',
        metadata: { event: { type: eventType, ...data } }
      })
    }
  }
}

export default AccessibilityTestRunner
export type { TestRunnerConfig, TestResult, TestRunSummary }