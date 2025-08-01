/**
 * Accessibility Audit Type Definitions
 * 
 * Comprehensive types for WCAG 2.1 AA compliance checking,
 * automated testing, and accessibility monitoring
 */

export interface AccessibilityConfig {
  wcagVersion: '2.0' | '2.1' | '2.2'
  complianceLevel: 'A' | 'AA' | 'AAA'
  enableAutomatedTesting: boolean
  enableRealTimeMonitoring: boolean
  enableKeyboardTesting: boolean
  enableScreenReaderTesting: boolean
  enableColorContrastTesting: boolean
  reportingEnabled: boolean
  remediationSuggestions: boolean
}

export interface AccessibilityRule {
  id: string
  name: string
  description: string
  wcagCriteria: string[]
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  category: AccessibilityCategory
  automated: boolean
  selector?: string
  testFunction?: (element: Element) => AccessibilityViolation[]
}

export type AccessibilityCategory =
  | 'keyboard'
  | 'images'
  | 'headings'
  | 'color-contrast'
  | 'forms'
  | 'links'
  | 'tables'
  | 'multimedia'
  | 'structure'
  | 'navigation'
  | 'aria'
  | 'focus'
  | 'language'
  | 'timing'

export interface AccessibilityViolation {
  id: string
  ruleId: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  message: string
  description: string
  helpUrl: string
  wcagCriteria: string[]
  element: {
    selector: string
    html: string
    xpath?: string
    target: string[]
  }
  remediation: {
    summary: string
    steps: string[]
    codeExample?: string
    resources: string[]
  }
  context: {
    page: string
    url: string
    timestamp: number
    userAgent: string
  }
}

export interface AccessibilityAuditResult {
  id: string
  timestamp: number
  url: string
  title: string
  summary: {
    totalViolations: number
    criticalViolations: number
    seriousViolations: number
    moderateViolations: number
    minorViolations: number
    complianceScore: number
    wcagLevel: 'A' | 'AA' | 'AAA' | 'fail'
  }
  violations: AccessibilityViolation[]
  passes: AccessibilityPass[]
  incomplete: AccessibilityIncomplete[]
  metadata: {
    auditDuration: number
    rulesRun: number
    elementsScanned: number
    axeVersion: string
    environment: string
  }
}

export interface AccessibilityPass {
  id: string
  ruleId: string
  description: string
  wcagCriteria: string[]
  elementsChecked: number
}

export interface AccessibilityIncomplete {
  id: string
  ruleId: string
  description: string
  reason: string
  elementsAffected: number
  requiresManualCheck: boolean
}

export interface AccessibilityMetrics {
  complianceScore: number
  wcagLevel: 'A' | 'AA' | 'AAA' | 'fail'
  violationsByCategory: Record<AccessibilityCategory, number>
  violationsBySeverity: Record<'critical' | 'serious' | 'moderate' | 'minor', number>
  trendsOverTime: {
    date: string
    score: number
    violations: number
  }[]
  pageScores: {
    url: string
    title: string
    score: number
    violations: number
    lastAudit: number
  }[]
}

export interface AccessibilityRecommendation {
  id: string
  priority: 'high' | 'medium' | 'low'
  category: AccessibilityCategory
  title: string
  description: string
  impact: string
  effort: 'low' | 'medium' | 'high'
  wcagCriteria: string[]
  implementation: {
    steps: string[]
    codeExample?: string
    testingInstructions: string[]
  }
  relatedViolations: string[]
}

export interface KeyboardNavigationTest {
  id: string
  name: string
  description: string
  steps: string[]
  expectedBehavior: string
  actualBehavior?: string
  passed: boolean
  element?: string
  keySequence: string[]
}

export interface ColorContrastTest {
  id: string
  foregroundColor: string
  backgroundColor: string
  ratio: number
  wcagAAResult: 'pass' | 'fail'
  wcagAAAResult: 'pass' | 'fail'
  element: string
  selector: string
  fontSize: string
  fontWeight: string
  recommendation?: string
}

export interface ScreenReaderTest {
  id: string
  element: string
  expectedAnnouncement: string
  actualAnnouncement?: string
  passed: boolean
  ariaLabel?: string
  ariaDescription?: string
  role?: string
  recommendations: string[]
}

export interface AccessibilitySettings {
  highContrast: boolean
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large' | 'extra-large'
  focusIndicators: boolean
  skipLinks: boolean
  screenReaderSupport: boolean
  keyboardOnlyNavigation: boolean
  colorBlindSupport: boolean
}

export interface AccessibilityEvent {
  type: AccessibilityEventType
  timestamp: number
  element?: string
  action?: string
  data?: any
  userId?: string
  sessionId?: string
}

export type AccessibilityEventType =
  | 'audit_started'
  | 'audit_completed'
  | 'violation_detected'
  | 'violation_fixed'
  | 'keyboard_navigation'
  | 'screen_reader_interaction'
  | 'focus_change'
  | 'settings_changed'
  | 'manual_test_completed'

export interface AccessibilityDashboardData {
  overview: {
    overallScore: number
    totalViolations: number
    criticalIssues: number
    wcagLevel: string
    lastAudit: number
    trend: 'improving' | 'declining' | 'stable'
  }
  categoryBreakdown: {
    category: AccessibilityCategory
    violations: number
    score: number
    status: 'excellent' | 'good' | 'needs-improvement' | 'poor'
  }[]
  recentAudits: {
    id: string
    timestamp: number
    url: string
    score: number
    violations: number
    status: 'pass' | 'fail'
  }[]
  topIssues: {
    ruleId: string
    name: string
    occurrences: number
    severity: string
    pages: string[]
  }[]
  recommendations: AccessibilityRecommendation[]
}

export interface AccessibilityTestSuite {
  id: string
  name: string
  description: string
  tests: AccessibilityTest[]
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    time: string
    enabled: boolean
  }
  notifications: {
    onFailure: boolean
    onImprovement: boolean
    recipients: string[]
  }
}

export interface AccessibilityTest {
  id: string
  name: string
  description: string
  type: 'automated' | 'manual' | 'keyboard' | 'screen-reader' | 'color-contrast'
  category: AccessibilityCategory
  wcagCriteria: string[]
  selector?: string
  testFunction: string
  expectedResult?: any
  priority: 'high' | 'medium' | 'low'
}

// Constants for WCAG criteria mapping
export const WCAG_CRITERIA = {
  '1.1.1': 'Non-text Content',
  '1.2.1': 'Audio-only and Video-only (Prerecorded)',
  '1.2.2': 'Captions (Prerecorded)',
  '1.2.3': 'Audio Description or Media Alternative (Prerecorded)',
  '1.2.4': 'Captions (Live)',
  '1.2.5': 'Audio Description (Prerecorded)',
  '1.3.1': 'Info and Relationships',
  '1.3.2': 'Meaningful Sequence',
  '1.3.3': 'Sensory Characteristics',
  '1.3.4': 'Orientation',
  '1.3.5': 'Identify Input Purpose',
  '1.4.1': 'Use of Color',
  '1.4.2': 'Audio Control',
  '1.4.3': 'Contrast (Minimum)',
  '1.4.4': 'Resize text',
  '1.4.5': 'Images of Text',
  '1.4.10': 'Reflow',
  '1.4.11': 'Non-text Contrast',
  '1.4.12': 'Text Spacing',
  '1.4.13': 'Content on Hover or Focus',
  '2.1.1': 'Keyboard',
  '2.1.2': 'No Keyboard Trap',
  '2.1.4': 'Character Key Shortcuts',
  '2.2.1': 'Timing Adjustable',
  '2.2.2': 'Pause, Stop, Hide',
  '2.3.1': 'Three Flashes or Below Threshold',
  '2.4.1': 'Bypass Blocks',
  '2.4.2': 'Page Titled',
  '2.4.3': 'Focus Order',
  '2.4.4': 'Link Purpose (In Context)',
  '2.4.5': 'Multiple Ways',
  '2.4.6': 'Headings and Labels',
  '2.4.7': 'Focus Visible',
  '2.5.1': 'Pointer Gestures',
  '2.5.2': 'Pointer Cancellation',
  '2.5.3': 'Label in Name',
  '2.5.4': 'Motion Actuation',
  '3.1.1': 'Language of Page',
  '3.1.2': 'Language of Parts',
  '3.2.1': 'On Focus',
  '3.2.2': 'On Input',
  '3.2.3': 'Consistent Navigation',
  '3.2.4': 'Consistent Identification',
  '3.3.1': 'Error Identification',
  '3.3.2': 'Labels or Instructions',
  '3.3.3': 'Error Suggestion',
  '3.3.4': 'Error Prevention (Legal, Financial, Data)',
  '4.1.1': 'Parsing',
  '4.1.2': 'Name, Role, Value',
  '4.1.3': 'Status Messages'
} as const

export const ACCESSIBILITY_PRIORITIES = {
  critical: {
    color: '#dc2626',
    weight: 100,
    description: 'Blocks user access completely'
  },
  serious: {
    color: '#ea580c',
    weight: 75,
    description: 'Significantly impacts user experience'
  },
  moderate: {
    color: '#ca8a04',
    weight: 50,
    description: 'Causes some difficulty for users'
  },
  minor: {
    color: '#65a30d',
    weight: 25,
    description: 'Minor inconvenience for users'
  }
} as const

export const COMPLIANCE_LEVELS = {
  A: {
    threshold: 60,
    description: 'Basic accessibility level'
  },
  AA: {
    threshold: 80,
    description: 'Standard accessibility level (required by law in many jurisdictions)'
  },
  AAA: {
    threshold: 95,
    description: 'Enhanced accessibility level'
  }
} as const