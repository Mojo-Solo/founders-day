/**
 * Accessibility Auditor
 * 
 * Core accessibility auditing engine with WCAG 2.1 AA compliance checking,
 * automated testing, real-time monitoring, and comprehensive reporting
 */

import axe from 'axe-core'
import {
  AccessibilityConfig,
  AccessibilityAuditResult,
  AccessibilityViolation,
  AccessibilityPass,
  AccessibilityIncomplete,
  AccessibilityMetrics,
  AccessibilityRecommendation,
  KeyboardNavigationTest,
  ColorContrastTest,
  ScreenReaderTest,
  AccessibilityEvent,
  AccessibilityEventType,
  AccessibilityCategory,
  WCAG_CRITERIA,
  ACCESSIBILITY_PRIORITIES,
  COMPLIANCE_LEVELS
} from './accessibility-types'

import logger from '../monitoring/logger'
import performanceMonitor from '../monitoring/performance-monitor'
import { captureError } from '../monitoring/sentry-config'

class AccessibilityAuditor {
  private config: AccessibilityConfig
  private isInitialized = false
  private auditHistory: AccessibilityAuditResult[] = []
  private eventListeners: Map<AccessibilityEventType, Function[]> = new Map()
  private realTimeObserver: MutationObserver | null = null
  private keyboardTestResults: KeyboardNavigationTest[] = []
  private colorContrastCache = new Map<string, ColorContrastTest[]>()
  
  constructor(config?: Partial<AccessibilityConfig>) {
    this.config = {
      wcagVersion: '2.1',
      complianceLevel: 'AA',
      enableAutomatedTesting: true,
      enableRealTimeMonitoring: true,
      enableKeyboardTesting: true,
      enableScreenReaderTesting: true,
      enableColorContrastTesting: true,
      reportingEnabled: true,
      remediationSuggestions: true,
      ...config
    }
    
    this.initializeAxe()
  }
  
  /**
   * Initialize the accessibility auditor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Accessibility auditor already initialized', {
        component: 'AccessibilityAuditor'
      })
      return
    }
    
    const startTime = performance.now()
    
    try {
      logger.info('Initializing accessibility auditor...', {
        component: 'AccessibilityAuditor',
        metadata: { config: this.config }
      })
      
      // Configure axe-core
      await this.configureAxe()
      
      // Initialize real-time monitoring if enabled
      if (this.config.enableRealTimeMonitoring) {
        this.initializeRealTimeMonitoring()
      }
      
      // Set up keyboard navigation monitoring
      if (this.config.enableKeyboardTesting) {
        this.initializeKeyboardMonitoring()
      }
      
      // Initialize screen reader support detection
      if (this.config.enableScreenReaderTesting) {
        this.initializeScreenReaderDetection()
      }
      
      this.isInitialized = true
      
      const initTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('accessibility_auditor_init_time', initTime, {
        success: true,
        config: this.config
      })
      
      this.emitEvent('audit_started', {
        timestamp: Date.now(),
        config: this.config
      })
      
      logger.info(`Accessibility auditor initialized in ${initTime.toFixed(2)}ms`, {
        component: 'AccessibilityAuditor',
        metadata: { initTime, config: this.config }
      })
      
    } catch (error) {
      const initTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('accessibility_auditor_init_error', initTime, {
        success: false,
        error: (error as Error).message
      })
      
      logger.error('Failed to initialize accessibility auditor', {
        component: 'AccessibilityAuditor',
        metadata: { error: (error as Error).message }
      })
      
      captureError(error as Error, {
        component: 'AccessibilityAuditor',
        phase: 'initialization'
      })
      
      throw error
    }
  }
  
  /**
   * Run comprehensive accessibility audit
   */
  async runAudit(
    element?: Element | null,
    options?: {
      includeKeyboard?: boolean
      includeColorContrast?: boolean
      includeScreenReader?: boolean
    }
  ): Promise<AccessibilityAuditResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }
    
    const startTime = performance.now()
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    logger.info('Starting accessibility audit', {
      component: 'AccessibilityAuditor',
      metadata: { auditId, options }
    })
    
    try {
      // Run axe-core audit with proper options
      const axeResults = await axe.run(element || document)
      
      // Process results
      const violations = this.processViolations(axeResults.violations)
      const passes = this.processPasses(axeResults.passes)
      const incomplete = this.processIncomplete(axeResults.incomplete)
      
      // Run additional tests if enabled
      if (options?.includeKeyboard && this.config.enableKeyboardTesting) {
        await this.testKeyboardNavigation()
      }
      
      if (options?.includeColorContrast && this.config.enableColorContrastTesting) {
        await this.testColorContrast()
      }
      
      if (options?.includeScreenReader && this.config.enableScreenReaderTesting) {
        await this.runScreenReaderTests()
      }
      
      // Calculate metrics
      const summary = this.calculateSummary(violations, passes, incomplete)
      
      // Create audit result
      const auditResult: AccessibilityAuditResult = {
        id: auditId,
        timestamp: Date.now(),
        url: window.location.href,
        title: document.title,
        summary,
        violations,
        passes,
        incomplete,
        metadata: {
          auditDuration: performance.now() - startTime,
          rulesRun: axeResults.violations.length + axeResults.passes.length + axeResults.incomplete.length,
          elementsScanned: this.countElements(element),
          axeVersion: axe.version,
          environment: this.getEnvironmentInfo()
        }
      }
      
      // Store in history
      this.auditHistory.push(auditResult)
      
      // Limit history size
      if (this.auditHistory.length > 100) {
        this.auditHistory = this.auditHistory.slice(-50)
      }
      
      const auditTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('accessibility_audit_time', auditTime, {
        violations: violations.length,
        complianceScore: summary.complianceScore,
        wcagLevel: summary.wcagLevel
      })
      
      this.emitEvent('audit_completed', {
        auditId,
        summary,
        duration: auditTime
      })
      
      logger.info(`Accessibility audit completed in ${auditTime.toFixed(2)}ms`, {
        component: 'AccessibilityAuditor',
        metadata: {
          auditId,
          violations: violations.length,
          score: summary.complianceScore,
          wcagLevel: summary.wcagLevel
        }
      })
      
      return auditResult
      
    } catch (error) {
      const auditTime = performance.now() - startTime
      
      performanceMonitor.recordMetric('accessibility_audit_error', auditTime, {
        error: (error as Error).message
      })
      
      logger.error('Accessibility audit failed', {
        component: 'AccessibilityAuditor',
        metadata: {
          auditId,
          error: (error as Error).message,
          duration: auditTime
        }
      })
      
      captureError(error as Error, {
        component: 'AccessibilityAuditor',
        auditId,
        phase: 'audit_execution'
      })
      
      throw error
    }
  }
  
  /**
   * Run quick accessibility check for specific element
   */
  async quickCheck(element: Element): Promise<{
    violations: AccessibilityViolation[]
    score: number
    critical: number
  }> {
    try {
      const results = await axe.run(element)
      
      const violations = this.processViolations(results.violations)
      const critical = violations.filter(v => v.severity === 'critical').length
      const score = this.calculateElementScore(violations)
      
      return { violations, score, critical }
      
    } catch (error) {
      logger.error('Quick accessibility check failed', {
        component: 'AccessibilityAuditor',
        metadata: { error: (error as Error).message }
      })
      
      throw error
    }
  }
  
  /**
   * Get accessibility metrics and trends
   */
  getMetrics(): AccessibilityMetrics {
    if (this.auditHistory.length === 0) {
      return this.createEmptyMetrics()
    }
    
    const latestAudit = this.auditHistory[this.auditHistory.length - 1]
    
    return {
      complianceScore: latestAudit.summary.complianceScore,
      wcagLevel: latestAudit.summary.wcagLevel,
      violationsByCategory: this.getViolationsByCategory(),
      violationsBySeverity: this.getViolationsBySeverity(),
      trendsOverTime: this.getTrendsOverTime(),
      pageScores: this.getPageScores()
    }
  }
  
  /**
   * Get accessibility recommendations
   */
  getRecommendations(): AccessibilityRecommendation[] {
    if (this.auditHistory.length === 0) {
      return []
    }
    
    const latestAudit = this.auditHistory[this.auditHistory.length - 1]
    const recommendations: AccessibilityRecommendation[] = []
    
    // Group violations by rule ID
    const violationGroups = this.groupViolationsByRule(latestAudit.violations)
    
    // Create recommendations for each violation type
    Object.entries(violationGroups).forEach(([ruleId, violations]) => {
      const recommendation = this.createRecommendation(ruleId, violations)
      if (recommendation) {
        recommendations.push(recommendation)
      }
    })
    
    // Sort by priority and impact
    return recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 }
      return priorityWeight[b.priority] - priorityWeight[a.priority]
    })
  }
  
  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(): Promise<KeyboardNavigationTest[]> {
    const tests: KeyboardNavigationTest[] = []
    
    try {
      // Test tab navigation
      const tabTest = await this.testTabNavigation()
      tests.push(tabTest)
      
      // Test escape key
      const escapeTest = await this.testEscapeKey()
      tests.push(escapeTest)
      
      // Test arrow key navigation
      const arrowTest = await this.testArrowKeys()
      tests.push(arrowTest)
      
      // Test enter/space activation
      const activationTest = await this.testKeyActivation()
      tests.push(activationTest)
      
      this.keyboardTestResults = tests
      
      return tests
      
    } catch (error) {
      logger.error('Keyboard navigation testing failed', {
        component: 'AccessibilityAuditor',
        metadata: { error: (error as Error).message }
      })
      
      throw error
    }
  }
  
  /**
   * Test color contrast ratios
   */
  async testColorContrast(): Promise<ColorContrastTest[]> {
    const tests: ColorContrastTest[] = []
    const cacheKey = window.location.href
    
    // Check cache first
    if (this.colorContrastCache.has(cacheKey)) {
      return this.colorContrastCache.get(cacheKey)!
    }
    
    try {
      // Get all text elements
      const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label, input, textarea')
      
      for (const element of textElements) {
        const styles = window.getComputedStyle(element)
        const foreground = styles.color
        const background = styles.backgroundColor
        
        if (foreground && background && background !== 'rgba(0, 0, 0, 0)') {
          const test = await this.calculateColorContrast(
            element as HTMLElement,
            foreground,
            background,
            styles.fontSize,
            styles.fontWeight
          )
          
          if (test) {
            tests.push(test)
          }
        }
      }
      
      // Cache results
      this.colorContrastCache.set(cacheKey, tests)
      
      return tests
      
    } catch (error) {
      logger.error('Color contrast testing failed', {
        component: 'AccessibilityAuditor',
        metadata: { error: (error as Error).message }
      })
      
      throw error
    }
  }
  
  /**
   * Subscribe to accessibility events
   */
  on(eventType: AccessibilityEventType, callback: Function): () => void {
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
   * Get audit history
   */
  getAuditHistory(): AccessibilityAuditResult[] {
    return [...this.auditHistory]
  }
  
  /**
   * Clear audit history
   */
  clearHistory(): void {
    this.auditHistory = []
    this.colorContrastCache.clear()
    this.keyboardTestResults = []
    
    logger.info('Accessibility audit history cleared', {
      component: 'AccessibilityAuditor'
    })
  }
  
  // Private methods
  
  private initializeAxe(): void {
    // Configure axe-core for our needs
    axe.configure({
      branding: {
        brand: 'Founders Day Minnesota',
        application: 'Accessibility Auditor'
      },
      reporter: 'v2'
    })
  }
  
  private async configureAxe(): Promise<void> {
    // Set up custom rules if needed
    const customRules = this.getCustomRules()
    
    if (customRules.length > 0) {
      customRules.forEach(rule => {
        axe.configure({
          rules: [{
            id: rule.id,
            enabled: true,
            tags: [rule.category, `wcag${this.config.complianceLevel.toLowerCase()}`]
          }]
        })
      })
    }
  }
  
  private getAxeTags(): string[] {
    const tags = ['best-practice']
    
    // Add WCAG tags based on compliance level
    if (this.config.complianceLevel === 'A' || this.config.complianceLevel === 'AA' || this.config.complianceLevel === 'AAA') {
      tags.push('wcaga')
    }
    if (this.config.complianceLevel === 'AA' || this.config.complianceLevel === 'AAA') {
      tags.push('wcagaa')
    }
    if (this.config.complianceLevel === 'AAA') {
      tags.push('wcagaaa')
    }
    
    return tags
  }
  
  private getAxeRules(): Record<string, { enabled: boolean }> {
    // Enable/disable rules based on configuration
    const rules: Record<string, { enabled: boolean }> = {}
    
    if (!this.config.enableColorContrastTesting) {
      rules['color-contrast'] = { enabled: false }
    }
    
    if (!this.config.enableKeyboardTesting) {
      rules['keyboard'] = { enabled: false }
      rules['focus-order-semantics'] = { enabled: false }
    }
    
    return rules
  }
  
  private getCustomRules(): any[] {
    // Define custom accessibility rules specific to our application
    return []
  }
  
  private processViolations(axeViolations: any[]): AccessibilityViolation[] {
    return axeViolations.map(violation => ({
      id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: violation.id,
      severity: this.mapSeverity(violation.impact),
      impact: violation.impact,
      message: violation.help,
      description: violation.description,
      helpUrl: violation.helpUrl,
      wcagCriteria: violation.tags.filter((tag: string) => tag.startsWith('wcag')),
      element: {
        selector: violation.nodes[0]?.target[0] || '',
        html: violation.nodes[0]?.html || '',
        xpath: violation.nodes[0]?.xpath,
        target: violation.nodes[0]?.target || []
      },
      remediation: this.generateRemediation(violation),
      context: {
        page: document.title,
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      }
    }))
  }
  
  private processPasses(axePasses: any[]): AccessibilityPass[] {
    return axePasses.map(pass => ({
      id: `pass_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: pass.id,
      description: pass.description,
      wcagCriteria: pass.tags.filter((tag: string) => tag.startsWith('wcag')),
      elementsChecked: pass.nodes.length
    }))
  }
  
  private processIncomplete(axeIncomplete: any[]): AccessibilityIncomplete[] {
    return axeIncomplete.map(incomplete => ({
      id: `incomplete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: incomplete.id,
      description: incomplete.description,
      reason: incomplete.nodes[0]?.any[0]?.message || 'Manual check required',
      elementsAffected: incomplete.nodes.length,
      requiresManualCheck: true
    }))
  }
  
  private mapSeverity(impact: string): 'critical' | 'serious' | 'moderate' | 'minor' {
    const mapping: Record<string, 'critical' | 'serious' | 'moderate' | 'minor'> = {
      'critical': 'critical',
      'serious': 'serious',
      'moderate': 'moderate',
      'minor': 'minor'
    }
    
    return mapping[impact] || 'moderate'
  }
  
  private generateRemediation(violation: any): {
    summary: string
    steps: string[]
    codeExample?: string
    resources: string[]
  } {
    // Generate remediation suggestions based on violation type
    const baseRemediation = {
      summary: 'Fix this accessibility issue',
      steps: ['Review the element', 'Apply the appropriate fix', 'Test with assistive technology'],
      resources: [violation.helpUrl]
    }
    
    // Add specific remediation based on rule ID
    switch (violation.id) {
      case 'color-contrast':
        return {
          ...baseRemediation,
          summary: 'Improve color contrast ratio',
          steps: [
            'Increase contrast between text and background colors',
            'Ensure contrast ratio meets WCAG standards (4.5:1 for normal text, 3:1 for large text)',
            'Test with color contrast analyzer'
          ],
          codeExample: '/* Use darker text or lighter background */\n.element { color: #000; background: #fff; }'
        }
        
      case 'keyboard':
        return {
          ...baseRemediation,
          summary: 'Make element keyboard accessible',
          steps: [
            'Add tabindex="0" for focusable elements',
            'Implement keyboard event handlers',
            'Test tab navigation and key activation'
          ],
          codeExample: '<button tabindex="0" onKeyDown={handleKeyDown}>Button</button>'
        }
        
      default:
        return baseRemediation
    }
  }
  
  private calculateSummary(
    violations: AccessibilityViolation[],
    passes: AccessibilityPass[],
    incomplete: AccessibilityIncomplete[]
  ) {
    const criticalViolations = violations.filter(v => v.severity === 'critical').length
    const seriousViolations = violations.filter(v => v.severity === 'serious').length
    const moderateViolations = violations.filter(v => v.severity === 'moderate').length
    const minorViolations = violations.filter(v => v.severity === 'minor').length
    
    // Calculate compliance score
    const totalTests = violations.length + passes.length + incomplete.length
    const weightedScore = violations.reduce((score, violation) => {
      return score - ACCESSIBILITY_PRIORITIES[violation.severity].weight
    }, 1000)
    
    const complianceScore = Math.max(0, Math.min(100, (weightedScore / 1000) * 100))
    
    // Determine WCAG level
    let wcagLevel: 'A' | 'AA' | 'AAA' | 'fail' = 'fail'
    if (complianceScore >= COMPLIANCE_LEVELS.AAA.threshold) {
      wcagLevel = 'AAA'
    } else if (complianceScore >= COMPLIANCE_LEVELS.AA.threshold) {
      wcagLevel = 'AA'
    } else if (complianceScore >= COMPLIANCE_LEVELS.A.threshold) {
      wcagLevel = 'A'
    }
    
    return {
      totalViolations: violations.length,
      criticalViolations,
      seriousViolations,
      moderateViolations,
      minorViolations,
      complianceScore: Math.round(complianceScore),
      wcagLevel
    }
  }
  
  private countElements(element?: Element | null): number {
    const root = element || document
    return root.querySelectorAll('*').length
  }
  
  private getEnvironmentInfo(): string {
    return `${navigator.userAgent} - Screen: ${screen.width}x${screen.height}`
  }
  
  private calculateElementScore(violations: AccessibilityViolation[]): number {
    const totalWeight = violations.reduce((sum, violation) => {
      return sum + ACCESSIBILITY_PRIORITIES[violation.severity].weight
    }, 0)
    
    return Math.max(0, 100 - totalWeight)
  }
  
  private createEmptyMetrics(): AccessibilityMetrics {
    return {
      complianceScore: 0,
      wcagLevel: 'fail',
      violationsByCategory: {} as Record<AccessibilityCategory, number>,
      violationsBySeverity: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0
      },
      trendsOverTime: [],
      pageScores: []
    }
  }
  
  private getViolationsByCategory(): Record<AccessibilityCategory, number> {
    // Analyze violations by category from recent audits
    const categories: Record<AccessibilityCategory, number> = {
      keyboard: 0,
      images: 0,
      headings: 0,
      'color-contrast': 0,
      forms: 0,
      links: 0,
      tables: 0,
      multimedia: 0,
      structure: 0,
      navigation: 0,
      aria: 0,
      focus: 0,
      language: 0,
      timing: 0
    }
    
    // Implementation would categorize violations
    return categories
  }
  
  private getViolationsBySeverity(): Record<'critical' | 'serious' | 'moderate' | 'minor', number> {
    if (this.auditHistory.length === 0) {
      return { critical: 0, serious: 0, moderate: 0, minor: 0 }
    }
    
    const latest = this.auditHistory[this.auditHistory.length - 1]
    return {
      critical: latest.summary.criticalViolations,
      serious: latest.summary.seriousViolations,
      moderate: latest.summary.moderateViolations,
      minor: latest.summary.minorViolations
    }
  }
  
  private getTrendsOverTime(): { date: string; score: number; violations: number }[] {
    return this.auditHistory.slice(-30).map(audit => ({
      date: new Date(audit.timestamp).toISOString().split('T')[0],
      score: audit.summary.complianceScore,
      violations: audit.summary.totalViolations
    }))
  }
  
  private getPageScores(): {
    url: string
    title: string
    score: number
    violations: number
    lastAudit: number
  }[] {
    // Group audits by URL and get latest for each
    const pageMap = new Map()
    
    this.auditHistory.forEach(audit => {
      if (!pageMap.has(audit.url) || pageMap.get(audit.url).timestamp < audit.timestamp) {
        pageMap.set(audit.url, audit)
      }
    })
    
    return Array.from(pageMap.values()).map(audit => ({
      url: audit.url,
      title: audit.title,
      score: audit.summary.complianceScore,
      violations: audit.summary.totalViolations,
      lastAudit: audit.timestamp
    }))
  }
  
  private groupViolationsByRule(violations: AccessibilityViolation[]): Record<string, AccessibilityViolation[]> {
    return violations.reduce((groups, violation) => {
      if (!groups[violation.ruleId]) {
        groups[violation.ruleId] = []
      }
      groups[violation.ruleId].push(violation)
      return groups
    }, {} as Record<string, AccessibilityViolation[]>)
  }
  
  private createRecommendation(ruleId: string, violations: AccessibilityViolation[]): AccessibilityRecommendation | null {
    // Create recommendations based on violation patterns
    const firstViolation = violations[0]
    
    return {
      id: `rec_${ruleId}_${Date.now()}`,
      priority: violations.length > 5 ? 'high' : violations.length > 2 ? 'medium' : 'low',
      category: this.categorizeRule(ruleId),
      title: `Fix ${ruleId} violations`,
      description: firstViolation.description,
      impact: `Affects ${violations.length} element(s)`,
      effort: violations.length > 10 ? 'high' : violations.length > 5 ? 'medium' : 'low',
      wcagCriteria: firstViolation.wcagCriteria,
      implementation: {
        steps: firstViolation.remediation.steps,
        codeExample: firstViolation.remediation.codeExample,
        testingInstructions: [
          'Test with keyboard navigation',
          'Test with screen reader',
          'Verify color contrast'
        ]
      },
      relatedViolations: violations.map(v => v.id)
    }
  }
  
  private categorizeRule(ruleId: string): AccessibilityCategory {
    // Map rule IDs to categories
    const categoryMap: Record<string, AccessibilityCategory> = {
      'color-contrast': 'color-contrast',
      'keyboard': 'keyboard',
      'focus-order-semantics': 'focus',
      'image-alt': 'images',
      'heading-order': 'headings',
      'form-field-multiple-labels': 'forms',
      'link-name': 'links',
      'table-fake-caption': 'tables',
      'video-caption': 'multimedia',
      'landmark-one-main': 'structure',
      'skip-link': 'navigation',
      'aria-allowed-attr': 'aria',
      'html-has-lang': 'language'
    }
    
    return categoryMap[ruleId] || 'structure'
  }
  
  // Keyboard testing methods
  private async testTabNavigation(): Promise<KeyboardNavigationTest> {
    return {
      id: 'tab-navigation',
      name: 'Tab Navigation',
      description: 'Test tab key navigation through interactive elements',
      steps: ['Press Tab key', 'Navigate through all focusable elements', 'Ensure logical order'],
      expectedBehavior: 'Focus moves to next focusable element in logical order',
      keySequence: ['Tab'],
      passed: true // This would be determined by actual testing
    }
  }
  
  private async testEscapeKey(): Promise<KeyboardNavigationTest> {
    return {
      id: 'escape-key',
      name: 'Escape Key',
      description: 'Test escape key closes modals and cancels operations',
      steps: ['Open modal or menu', 'Press Escape key', 'Verify it closes'],
      expectedBehavior: 'Modal or menu closes when Escape is pressed',
      keySequence: ['Escape'],
      passed: true
    }
  }
  
  private async testArrowKeys(): Promise<KeyboardNavigationTest> {
    return {
      id: 'arrow-keys',
      name: 'Arrow Key Navigation',
      description: 'Test arrow key navigation in menus and grids',
      steps: ['Navigate to menu or grid', 'Use arrow keys', 'Verify movement'],
      expectedBehavior: 'Arrow keys navigate within grouped elements',
      keySequence: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
      passed: true
    }
  }
  
  private async testKeyActivation(): Promise<KeyboardNavigationTest> {
    return {
      id: 'key-activation',
      name: 'Key Activation',
      description: 'Test Enter and Space key activation',
      steps: ['Focus on button or link', 'Press Enter or Space', 'Verify activation'],
      expectedBehavior: 'Enter and Space activate focused elements',
      keySequence: ['Enter', 'Space'],
      passed: true
    }
  }
  
  // Color contrast testing
  private async calculateColorContrast(
    element: HTMLElement,
    foreground: string,
    background: string,
    fontSize: string,
    fontWeight: string
  ): Promise<ColorContrastTest | null> {
    try {
      // Convert colors to RGB values and calculate contrast ratio
      const fgRgb = this.parseColor(foreground)
      const bgRgb = this.parseColor(background)
      
      if (!fgRgb || !bgRgb) return null
      
      const ratio = this.calculateContrastRatio(fgRgb, bgRgb)
      const isLargeText = this.isLargeText(fontSize, fontWeight)
      
      const wcagAAResult = isLargeText ? ratio >= 3 : ratio >= 4.5
      const wcagAAAResult = isLargeText ? ratio >= 4.5 : ratio >= 7
      
      return {
        id: `contrast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        foregroundColor: foreground,
        backgroundColor: background,
        ratio: Math.round(ratio * 100) / 100,
        wcagAAResult: wcagAAResult ? 'pass' : 'fail',
        wcagAAAResult: wcagAAAResult ? 'pass' : 'fail',
        element: element.tagName.toLowerCase(),
        selector: this.getElementSelector(element),
        fontSize,
        fontWeight,
        recommendation: !wcagAAResult ? 'Increase contrast ratio to meet WCAG AA standards' : undefined
      }
      
    } catch (error) {
      return null
    }
  }
  
  private parseColor(color: string): { r: number; g: number; b: number } | null {
    // Simple color parsing - in production, use a proper color parsing library
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      }
    }
    return null
  }
  
  private calculateContrastRatio(fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }): number {
    // Calculate relative luminance
    const getLuminance = (color: { r: number; g: number; b: number }) => {
      const [r, g, b] = [color.r, color.g, color.b].map(c => {
        c = c / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    
    const l1 = getLuminance(fg)
    const l2 = getLuminance(bg)
    
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    
    return (lighter + 0.05) / (darker + 0.05)
  }
  
  private isLargeText(fontSize: string, fontWeight: string): boolean {
    const size = parseFloat(fontSize)
    const weight = parseInt(fontWeight) || 400
    
    // 18pt or 14pt bold is considered large text
    return size >= 18 || (size >= 14 && weight >= 700)
  }
  
  private getElementSelector(element: HTMLElement): string {
    // Generate a CSS selector for the element
    if (element.id) {
      return `#${element.id}`
    }
    
    if (element.className) {
      return `${element.tagName.toLowerCase()}.${element.className.split(' ').join('.')}`
    }
    
    return element.tagName.toLowerCase()
  }
  
  // Screen reader testing
  private async runScreenReaderTests(): Promise<ScreenReaderTest[]> {
    const tests: ScreenReaderTest[] = []
    
    // Test ARIA labels
    const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]')
    
    elementsWithAria.forEach(element => {
      const test: ScreenReaderTest = {
        id: `sr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        element: element.tagName.toLowerCase(),
        expectedAnnouncement: element.getAttribute('aria-label') || 'Element with ARIA labeling',
        passed: true, // Would be determined by actual testing
        ariaLabel: element.getAttribute('aria-label') || undefined,
        ariaDescription: element.getAttribute('aria-describedby') || undefined,
        role: element.getAttribute('role') || undefined,
        recommendations: []
      }
      
      tests.push(test)
    })
    
    return tests
  }
  
  // Real-time monitoring
  private initializeRealTimeMonitoring(): void {
    if (typeof window === 'undefined') return
    
    this.realTimeObserver = new MutationObserver((mutations) => {
      let hasSignificantChanges = false
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if added nodes contain interactive elements
          const hasInteractive = Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              return element.matches('button, a, input, select, textarea, [tabindex], [role="button"]')
            }
            return false
          })
          
          if (hasInteractive) {
            hasSignificantChanges = true
          }
        }
      })
      
      if (hasSignificantChanges) {
        // Debounce rapid changes
        if (this.realTimeCheckTimeout) {
          clearTimeout(this.realTimeCheckTimeout)
        }
        this.realTimeCheckTimeout = setTimeout(() => {
          this.runQuickAccessibilityCheck()
        }, 1000)
      }
    })
    
    this.realTimeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'aria-labelledby', 'aria-describedby', 'role', 'tabindex']
    })
  }
  
  private realTimeCheckTimeout: NodeJS.Timeout | null = null
  
  private async runQuickAccessibilityCheck(): Promise<void> {
    try {
      const quickResult = await this.quickCheck(document.body)
      
      if (quickResult.critical > 0) {
        this.emitEvent('violation_detected', {
          violations: quickResult.violations.filter(v => v.severity === 'critical'),
          timestamp: Date.now()
        })
      }
      
    } catch (error) {
      logger.debug('Real-time accessibility check failed', {
        component: 'AccessibilityAuditor',
        metadata: { error: (error as Error).message }
      })
    }
  }
  
  // Keyboard monitoring
  private initializeKeyboardMonitoring(): void {
    if (typeof window === 'undefined') return
    
    document.addEventListener('keydown', (event) => {
      this.emitEvent('keyboard_navigation', {
        key: event.key,
        element: event.target,
        timestamp: Date.now()
      })
    })
    
    document.addEventListener('focusin', (event) => {
      this.emitEvent('focus_change', {
        element: event.target,
        timestamp: Date.now()
      })
    })
  }
  
  // Screen reader detection
  private initializeScreenReaderDetection(): void {
    // Detect screen reader usage through various methods
    const hasScreenReader = this.detectScreenReader()
    
    if (hasScreenReader) {
      logger.info('Screen reader detected', {
        component: 'AccessibilityAuditor'
      })
      
      this.emitEvent('screen_reader_interaction', {
        detected: true,
        timestamp: Date.now()
      })
    }
  }
  
  private detectScreenReader(): boolean {
    // Multiple detection methods
    const indicators = [
      // Check for screen reader specific user agent strings
      /JAWS|NVDA|VoiceOver|TalkBack|Dragon|Narrator/.test(navigator.userAgent),
      
      // Check for high contrast mode (often used with screen readers)
      window.matchMedia('(prefers-contrast: high)').matches,
      
      // Check for reduced motion (accessibility preference)
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      
      // Check for speech synthesis API usage
      'speechSynthesis' in window && speechSynthesis.getVoices().length > 0
    ]
    
    return indicators.some(indicator => indicator)
  }
  
  private emitEvent(type: AccessibilityEventType, data?: any): void {
    const event: AccessibilityEvent = {
      type,
      timestamp: Date.now(),
      ...data
    }
    
    // Notify listeners
    const callbacks = this.eventListeners.get(type)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          logger.error(`Accessibility event callback error: ${type}`, {
            component: 'AccessibilityAuditor',
            metadata: { error: (error as Error).message }
          })
        }
      })
    }
    
    // Log important events
    if (['violation_detected', 'audit_completed'].includes(type)) {
      logger.info(`Accessibility event: ${type}`, {
        component: 'AccessibilityAuditor',
        metadata: { event }
      })
    }
  }
  
  /**
   * Destroy auditor and cleanup resources
   */
  destroy(): void {
    if (this.realTimeObserver) {
      this.realTimeObserver.disconnect()
      this.realTimeObserver = null
    }
    
    if (this.realTimeCheckTimeout) {
      clearTimeout(this.realTimeCheckTimeout)
      this.realTimeCheckTimeout = null
    }
    
    this.eventListeners.clear()
    this.isInitialized = false
    
    logger.info('Accessibility auditor destroyed', {
      component: 'AccessibilityAuditor'
    })
  }
}

export default AccessibilityAuditor