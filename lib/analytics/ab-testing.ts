/**
 * A/B Testing Framework
 * Enables experimentation and feature testing
 */

import { 
  ABTest, 
  ABTestVariant, 
  ABTestResult, 
  AudienceRule 
} from './analytics-types';
import { analytics } from './analytics-engine';
import logger from '../monitoring/logger';

export class ABTestingFramework {
  private static instance: ABTestingFramework;
  private activeTests: Map<string, ABTest> = new Map();
  private userAssignments: Map<string, Map<string, string>> = new Map(); // userId -> testId -> variantId
  private testResults: Map<string, ABTestResult[]> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): ABTestingFramework {
    if (!ABTestingFramework.instance) {
      ABTestingFramework.instance = new ABTestingFramework();
    }
    return ABTestingFramework.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load active tests from storage
      await this.loadActiveTests();

      // Initialize user assignments
      this.loadUserAssignments();

      this.initialized = true;
      logger.info('A/B Testing framework initialized');

    } catch (error) {
      logger.error('Failed to initialize A/B testing', {
        component: 'ABTestingFramework',
        metadata: { error: (error as Error).message }
      });
    }
  }

  /**
   * Create a new A/B test
   */
  createTest(test: Omit<ABTest, 'testId' | 'status'>): ABTest {
    const newTest: ABTest = {
      ...test,
      testId: this.generateTestId(),
      status: 'draft'
    };

    // Validate test configuration
    this.validateTest(newTest);

    // Store test
    this.activeTests.set(newTest.testId, newTest);
    this.saveActiveTests();

    logger.info('A/B test created', {
      component: 'ABTestingFramework',
      metadata: { testId: newTest.testId, testName: newTest.testName }
    });

    return newTest;
  }

  /**
   * Start an A/B test
   */
  startTest(testId: string): void {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    if (test.status === 'running') {
      logger.warn('Test already running', {
        component: 'ABTestingFramework',
        metadata: { testId }
      });
      return;
    }

    test.status = 'running';
    test.startDate = new Date();
    
    this.activeTests.set(testId, test);
    this.saveActiveTests();

    // Track test start
    analytics.track('ab_test_started', {
      testId,
      testName: test.testName,
      variants: test.variants.map(v => v.variantName)
    });

    logger.info('A/B test started', {
      component: 'ABTestingFramework',
      metadata: { testId, testName: test.testName }
    });
  }

  /**
   * Pause an A/B test
   */
  pauseTest(testId: string): void {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    test.status = 'paused';
    this.activeTests.set(testId, test);
    this.saveActiveTests();

    analytics.track('ab_test_paused', { testId });
  }

  /**
   * Complete an A/B test
   */
  completeTest(testId: string): ABTestResult {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    test.status = 'completed';
    test.endDate = new Date();
    
    // Calculate results
    const result = this.calculateTestResults(test);
    
    // Store results
    const results = this.testResults.get(testId) || [];
    results.push(result);
    this.testResults.set(testId, results);

    // Update test
    this.activeTests.set(testId, test);
    this.saveActiveTests();

    // Track completion
    analytics.track('ab_test_completed', {
      testId,
      winner: this.determineWinner(result),
      duration: test.endDate.getTime() - (test.startDate?.getTime() || 0)
    });

    logger.info('A/B test completed', {
      component: 'ABTestingFramework',
      metadata: { testId, result }
    });

    return result;
  }

  /**
   * Get variant for a user
   */
  getVariant(testId: string, userId?: string): ABTestVariant | null {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'running') {
      return null;
    }

    // Check if test applies to user
    if (!this.isUserEligible(test, userId)) {
      return null;
    }

    // Get or assign variant
    const variantId = this.getUserVariant(testId, userId || this.getAnonymousUserId());
    
    if (!variantId) {
      return null;
    }

    return test.variants.find(v => v.variantId === variantId) || null;
  }

  /**
   * Track conversion for a test
   */
  trackConversion(testId: string, goalId: string, userId?: string, value?: number): void {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'running') {
      return;
    }

    const effectiveUserId = userId || this.getAnonymousUserId();
    const variantId = this.getUserVariant(testId, effectiveUserId);
    
    if (!variantId) {
      return;
    }

    // Track conversion
    analytics.trackGoal(`ab_test_${testId}_${goalId}`, value, {
      testId,
      variantId,
      userId: effectiveUserId
    });

    // Update test metrics
    this.updateTestMetrics(testId, variantId, goalId, true);
  }

  /**
   * Get test results
   */
  getTestResults(testId: string): ABTestResult | null {
    const test = this.activeTests.get(testId);
    if (!test) {
      return null;
    }

    return this.calculateTestResults(test);
  }

  /**
   * Get all active tests
   */
  getActiveTests(): ABTest[] {
    return Array.from(this.activeTests.values()).filter(
      test => test.status === 'running'
    );
  }

  /**
   * Check if a feature is enabled for a user
   */
  isFeatureEnabled(featureName: string, userId?: string): boolean {
    // Find test for this feature
    const test = Array.from(this.activeTests.values()).find(
      t => t.testName === featureName && t.status === 'running'
    );

    if (!test) {
      return false; // Default to control/off
    }

    const variant = this.getVariant(test.testId, userId);
    
    // Check if variant enables the feature
    return variant?.config?.enabled === true;
  }

  // Private methods

  private validateTest(test: ABTest): void {
    if (!test.testName) {
      throw new Error('Test name is required');
    }

    if (!test.variants || test.variants.length < 2) {
      throw new Error('At least 2 variants are required');
    }

    const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new Error('Variant weights must sum to 1');
    }

    if (!test.metrics || test.metrics.length === 0) {
      throw new Error('At least one metric must be specified');
    }
  }

  private isUserEligible(test: ABTest, userId?: string): boolean {
    if (!test.targetAudience || test.targetAudience.length === 0) {
      return true; // No targeting rules, everyone is eligible
    }

    // Evaluate audience rules
    return test.targetAudience.every(rule => 
      this.evaluateAudienceRule(rule, userId)
    );
  }

  private evaluateAudienceRule(rule: AudienceRule, userId?: string): boolean {
    // Simple rule evaluation - extend as needed
    switch (rule.field) {
      case 'userId':
        return this.evaluateCondition(userId, rule.operator, rule.value);
      case 'isLoggedIn':
        return this.evaluateCondition(!!userId, rule.operator, rule.value);
      case 'random':
        return Math.random() < rule.value;
      default:
        return true;
    }
  }

  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'notEquals':
        return actual !== expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);
      default:
        return false;
    }
  }

  private getUserVariant(testId: string, userId: string): string | null {
    // Check existing assignment
    const userTests = this.userAssignments.get(userId);
    if (userTests?.has(testId)) {
      return userTests.get(testId)!;
    }

    // Assign variant
    const test = this.activeTests.get(testId);
    if (!test) return null;

    const variantId = this.assignVariant(test, userId);
    
    // Store assignment
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    this.userAssignments.get(userId)!.set(testId, variantId);
    this.saveUserAssignments();

    // Track assignment
    analytics.track('ab_test_variant_assigned', {
      testId,
      variantId,
      userId
    });

    return variantId;
  }

  private assignVariant(test: ABTest, userId: string): string {
    // Use consistent hashing for deterministic assignment
    const hash = this.hashUserId(userId, test.testId);
    const random = hash / 0xFFFFFFFF; // Normalize to 0-1

    let cumulative = 0;
    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (random < cumulative) {
        return variant.variantId;
      }
    }

    // Fallback to last variant
    return test.variants[test.variants.length - 1].variantId;
  }

  private hashUserId(userId: string, salt: string): number {
    const str = userId + salt;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private calculateTestResults(test: ABTest): ABTestResult {
    const duration = test.endDate 
      ? test.endDate.getTime() - (test.startDate?.getTime() || 0)
      : Date.now() - (test.startDate?.getTime() || 0);

    const metrics: ABTestResult['metrics'] = {};

    // Calculate metrics for each variant
    for (const variant of test.variants) {
      const variantMetrics: Record<string, {
        conversions: number;
        conversionRate: number;
        confidence: number;
        lift?: number;
      }> = {};
      
      for (const metricId of test.metrics) {
        // Get conversion data (this would come from analytics in production)
        const conversions = this.getConversions(test.testId, variant.variantId, metricId);
        const sampleSize = this.getSampleSize(test.testId, variant.variantId);
        
        const conversionRate = sampleSize > 0 ? conversions / sampleSize : 0;
        
        // Calculate statistical significance
        const controlVariant = test.variants.find(v => v.variantName === 'Control');
        let confidence = 0;
        let lift = 0;
        
        if (controlVariant && variant.variantId !== controlVariant.variantId) {
          const controlRate = this.getConversionRate(test.testId, controlVariant.variantId, metricId);
          lift = controlRate > 0 ? ((conversionRate - controlRate) / controlRate) * 100 : 0;
          confidence = this.calculateConfidence(conversionRate, controlRate, sampleSize);
        }

        variantMetrics[metricId] = {
          conversions,
          conversionRate,
          confidence,
          lift
        };
      }
      
      metrics[variant.variantId] = variantMetrics;
    }

    return {
      testId: test.testId,
      variantId: '', // Will be set to winner if applicable
      metrics,
      sampleSize: this.getTotalSampleSize(test.testId),
      duration
    };
  }

  private getConversions(testId: string, variantId: string, metricId: string): number {
    // In production, this would query analytics data
    return Math.floor(Math.random() * 100);
  }

  private getSampleSize(testId: string, variantId: string): number {
    // In production, this would query analytics data
    return Math.floor(Math.random() * 1000) + 100;
  }

  private getTotalSampleSize(testId: string): number {
    // In production, this would query analytics data
    return Math.floor(Math.random() * 5000) + 1000;
  }

  private getConversionRate(testId: string, variantId: string, metricId: string): number {
    const conversions = this.getConversions(testId, variantId, metricId);
    const sampleSize = this.getSampleSize(testId, variantId);
    return sampleSize > 0 ? conversions / sampleSize : 0;
  }

  private calculateConfidence(rate1: number, rate2: number, sampleSize: number): number {
    // Simplified confidence calculation
    // In production, use proper statistical methods (e.g., chi-square test)
    const diff = Math.abs(rate1 - rate2);
    const standardError = Math.sqrt((rate1 * (1 - rate1) + rate2 * (1 - rate2)) / sampleSize);
    const zScore = diff / standardError;
    
    // Convert z-score to confidence percentage
    if (zScore > 2.58) return 99;
    if (zScore > 1.96) return 95;
    if (zScore > 1.64) return 90;
    return Math.round(zScore * 35); // Rough approximation
  }

  private determineWinner(result: ABTestResult): string | null {
    let bestVariant: string | null = null;
    let bestRate = 0;
    let hasSignificance = false;

    for (const [variantId, metrics] of Object.entries(result.metrics)) {
      // Check primary metric (first one)
      const primaryMetric = Object.values(metrics)[0];
      if (primaryMetric.conversionRate > bestRate) {
        bestRate = primaryMetric.conversionRate;
        bestVariant = variantId;
        hasSignificance = primaryMetric.confidence >= 95;
      }
    }

    return hasSignificance ? bestVariant : null;
  }

  private updateTestMetrics(testId: string, variantId: string, metricId: string, isConversion: boolean): void {
    // In production, this would update real-time metrics
    logger.info('Test metric updated', {
      component: 'ABTestingFramework',
      metadata: { testId, variantId, metricId, isConversion }
    });
  }

  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAnonymousUserId(): string {
    if (typeof window === 'undefined') return 'server';
    
    let anonymousId = localStorage.getItem('ab_anonymous_id');
    if (!anonymousId) {
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('ab_anonymous_id', anonymousId);
    }
    return anonymousId;
  }

  private async loadActiveTests(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('ab_active_tests');
      if (stored) {
        const tests = JSON.parse(stored);
        this.activeTests = new Map(tests);
      }
    } catch (error) {
      logger.error('Failed to load active tests', {
        component: 'ABTestingFramework',
        metadata: { error: (error as Error).message }
      });
    }
  }

  private saveActiveTests(): void {
    if (typeof window === 'undefined') return;

    try {
      const tests = Array.from(this.activeTests.entries());
      localStorage.setItem('ab_active_tests', JSON.stringify(tests));
    } catch (error) {
      logger.error('Failed to save active tests', {
        component: 'ABTestingFramework',
        metadata: { error: (error as Error).message }
      });
    }
  }

  private loadUserAssignments(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('ab_user_assignments');
      if (stored) {
        const assignments = JSON.parse(stored);
        this.userAssignments = new Map(
          assignments.map(([userId, tests]: [string, [string, string][]]) => [
            userId,
            new Map(tests)
          ])
        );
      }
    } catch (error) {
      logger.error('Failed to load user assignments', {
        component: 'ABTestingFramework',
        metadata: { error: (error as Error).message }
      });
    }
  }

  private saveUserAssignments(): void {
    if (typeof window === 'undefined') return;

    try {
      const assignments = Array.from(this.userAssignments.entries()).map(
        ([userId, tests]) => [userId, Array.from(tests.entries())]
      );
      localStorage.setItem('ab_user_assignments', JSON.stringify(assignments));
    } catch (error) {
      logger.error('Failed to save user assignments', {
        component: 'ABTestingFramework',
        metadata: { error: (error as Error).message }
      });
    }
  }
}

// Export singleton instance
export const abTesting = ABTestingFramework.getInstance();