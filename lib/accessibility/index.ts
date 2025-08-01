/**
 * Accessibility Module Index
 * 
 * Centralized exports for the comprehensive accessibility compliance system
 */

// Core components
export { default as AccessibilityAuditor } from './accessibility-auditor'
export { default as AccessibilityTestRunner } from './accessibility-test-runner'
export { default as AccessibilityDashboard } from './accessibility-dashboard'

// Types and interfaces
export type {
  AccessibilityConfig,
  AccessibilityRule,
  AccessibilityCategory,
  AccessibilityViolation,
  AccessibilityPass,
  AccessibilityIncomplete,
  AccessibilityAuditResult,
  AccessibilityMetrics,
  AccessibilityRecommendation,
  KeyboardNavigationTest,
  ColorContrastTest,
  ScreenReaderTest,
  AccessibilitySettings,
  AccessibilityEvent,
  AccessibilityEventType,
  AccessibilityDashboardData,
  AccessibilityTestSuite,
  AccessibilityTest
} from './accessibility-types'

export type {
  TestRunnerConfig,
  TestResult,
  TestRunSummary
} from './accessibility-test-runner'

// Constants
export {
  WCAG_CRITERIA,
  ACCESSIBILITY_PRIORITIES,
  COMPLIANCE_LEVELS
} from './accessibility-types'

// Import types
import type { AccessibilityConfig } from './accessibility-types'
import type { TestRunnerConfig } from './accessibility-test-runner'

// Utility function to create and initialize the complete accessibility system
export async function createAccessibilitySystem(config?: {
  auditorConfig?: Partial<AccessibilityConfig>
  testRunnerConfig?: Partial<TestRunnerConfig>
}) {
  const { default: AccessibilityAuditor } = await import('./accessibility-auditor')
  const { default: AccessibilityTestRunner } = await import('./accessibility-test-runner')
  
  // Create auditor instance
  const auditor = new AccessibilityAuditor(config?.auditorConfig)
  await auditor.initialize()
  
  // Create test runner instance
  const testRunner = new AccessibilityTestRunner(auditor, config?.testRunnerConfig)
  await testRunner.initialize()
  
  return {
    auditor,
    testRunner,
    
    // Convenience methods
    async runFullAudit() {
      return auditor.runAudit(document.body, {
        includeKeyboard: true,
        includeColorContrast: true,
        includeScreenReader: true
      })
    },
    
    async runQuickCheck(element?: Element) {
      return auditor.quickCheck(element || document.body)
    },
    
    async runAllTests() {
      return testRunner.runAllTestSuites()
    },
    
    getMetrics() {
      return auditor.getMetrics()
    },
    
    getRecommendations() {
      return auditor.getRecommendations()
    },
    
    getTestHistory() {
      return testRunner.getTestHistory()
    },
    
    // Cleanup method
    destroy() {
      auditor.destroy()
      testRunner.destroy()
    }
  }
}

// Helper function to run a quick accessibility check
export async function quickAccessibilityCheck(element?: Element) {
  const { default: AccessibilityAuditor } = await import('./accessibility-auditor')
  
  const auditor = new AccessibilityAuditor({
    wcagVersion: '2.1',
    complianceLevel: 'AA',
    enableAutomatedTesting: true,
    enableRealTimeMonitoring: false,
    enableKeyboardTesting: false,
    enableScreenReaderTesting: false,
    enableColorContrastTesting: true,
    reportingEnabled: false,
    remediationSuggestions: true
  })
  
  await auditor.initialize()
  
  try {
    const result = await auditor.quickCheck(element || document.body)
    auditor.destroy()
    return result
  } catch (error) {
    auditor.destroy()
    throw error
  }
}

// Helper function to test keyboard navigation
export async function testKeyboardNavigation() {
  const { default: AccessibilityAuditor } = await import('./accessibility-auditor')
  
  const auditor = new AccessibilityAuditor({
    wcagVersion: '2.1',
    complianceLevel: 'AA',
    enableAutomatedTesting: false,
    enableRealTimeMonitoring: false,
    enableKeyboardTesting: true,
    enableScreenReaderTesting: false,
    enableColorContrastTesting: false,
    reportingEnabled: false,
    remediationSuggestions: true
  })
  
  await auditor.initialize()
  
  try {
    const result = await auditor.testKeyboardNavigation()
    auditor.destroy()
    return result
  } catch (error) {
    auditor.destroy()
    throw error
  }
}

// Helper function to test color contrast
export async function testColorContrast() {
  const { default: AccessibilityAuditor } = await import('./accessibility-auditor')
  
  const auditor = new AccessibilityAuditor({
    wcagVersion: '2.1',
    complianceLevel: 'AA',
    enableAutomatedTesting: false,
    enableRealTimeMonitoring: false,
    enableKeyboardTesting: false,
    enableScreenReaderTesting: false,
    enableColorContrastTesting: true,
    reportingEnabled: false,
    remediationSuggestions: true
  })
  
  await auditor.initialize()
  
  try {
    const result = await auditor.testColorContrast()
    auditor.destroy()
    return result
  } catch (error) {
    auditor.destroy()
    throw error
  }
}