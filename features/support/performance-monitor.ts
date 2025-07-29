interface PerformanceMetrics {
  testName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  browserLaunchTime?: number;
  pageLoadTime?: number;
  stepDurations: { step: string; duration: number }[];
  memoryUsage?: NodeJS.MemoryUsage;
  browserStats?: any;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private stepStartTimes: Map<string, number> = new Map();
  private scenarioStartTime: number = 0;
  private browserLaunchStart: number = 0;
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startScenario(testName: string): void {
    this.scenarioStartTime = Date.now();
    this.metrics.set(testName, {
      testName,
      startTime: this.scenarioStartTime,
      stepDurations: []
    });
  }

  endScenario(testName: string): void {
    const metric = this.metrics.get(testName);
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.memoryUsage = process.memoryUsage();
    }
  }

  startBrowserLaunch(): void {
    this.browserLaunchStart = Date.now();
  }

  endBrowserLaunch(testName: string): void {
    const metric = this.metrics.get(testName);
    if (metric && this.browserLaunchStart) {
      metric.browserLaunchTime = Date.now() - this.browserLaunchStart;
    }
  }

  startStep(stepName: string): void {
    this.stepStartTimes.set(stepName, Date.now());
  }

  endStep(stepName: string, testName: string): void {
    const startTime = this.stepStartTimes.get(stepName);
    const metric = this.metrics.get(testName);
    
    if (startTime && metric) {
      const duration = Date.now() - startTime;
      metric.stepDurations.push({ step: stepName, duration });
      this.stepStartTimes.delete(stepName);
    }
  }

  recordPageLoad(testName: string, duration: number): void {
    const metric = this.metrics.get(testName);
    if (metric) {
      metric.pageLoadTime = duration;
    }
  }

  recordBrowserStats(testName: string, stats: any): void {
    const metric = this.metrics.get(testName);
    if (metric) {
      metric.browserStats = stats;
    }
  }

  getMetrics(testName: string): PerformanceMetrics | undefined {
    return this.metrics.get(testName);
  }

  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  generateReport(): string {
    const metrics = this.getAllMetrics();
    const totalTests = metrics.length;
    const completedTests = metrics.filter(m => m.duration).length;
    const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const avgDuration = completedTests > 0 ? totalDuration / completedTests : 0;
    
    const slowestTests = metrics
      .filter(m => m.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);

    const fastestTests = metrics
      .filter(m => m.duration)
      .sort((a, b) => (a.duration || 0) - (b.duration || 0))
      .slice(0, 5);

    let report = '\n🚀 Performance Report 📊\n';
    report += '================================\n';
    report += `Total Tests: ${totalTests}\n`;
    report += `Completed Tests: ${completedTests}\n`;
    report += `Total Duration: ${(totalDuration / 1000).toFixed(2)}s\n`;
    report += `Average Duration: ${(avgDuration / 1000).toFixed(2)}s\n`;
    report += `Target: <5 minutes (${totalDuration < 300000 ? '✅ ACHIEVED' : '❌ MISSED'})\n\n`;

    if (slowestTests.length > 0) {
      report += '🐌 Slowest Tests:\n';
      slowestTests.forEach((test, i) => {
        report += `${i + 1}. ${test.testName}: ${((test.duration || 0) / 1000).toFixed(2)}s\n`;
      });
      report += '\n';
    }

    if (fastestTests.length > 0) {
      report += '⚡ Fastest Tests:\n';
      fastestTests.forEach((test, i) => {
        report += `${i + 1}. ${test.testName}: ${((test.duration || 0) / 1000).toFixed(2)}s\n`;
      });
      report += '\n';
    }

    // Performance insights
    const avgBrowserLaunch = metrics
      .filter(m => m.browserLaunchTime)
      .reduce((sum, m) => sum + (m.browserLaunchTime || 0), 0) / 
      metrics.filter(m => m.browserLaunchTime).length;

    const avgPageLoad = metrics
      .filter(m => m.pageLoadTime)
      .reduce((sum, m) => sum + (m.pageLoadTime || 0), 0) / 
      metrics.filter(m => m.pageLoadTime).length;

    if (avgBrowserLaunch > 0) {
      report += `Average Browser Launch: ${(avgBrowserLaunch / 1000).toFixed(2)}s\n`;
    }
    if (avgPageLoad > 0) {
      report += `Average Page Load: ${(avgPageLoad / 1000).toFixed(2)}s\n`;
    }

    // Performance recommendations
    report += '\n💡 Performance Recommendations:\n';
    if (avgDuration > 5000) {
      report += '• Consider reducing step timeouts\n';
    }
    if (avgBrowserLaunch > 3000) {
      report += '• Browser pool is working, but consider browser optimization\n';
    }
    if (avgPageLoad > 2000) {
      report += '• Page load times are slow, check server performance\n';
    }
    if (totalDuration > 300000) {
      report += '• Consider increasing parallel workers\n';
    }

    return report;
  }

  exportMetrics(): any {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.getAllMetrics(),
      summary: {
        totalTests: this.metrics.size,
        totalDuration: this.getAllMetrics().reduce((sum, m) => sum + (m.duration || 0), 0),
        averageDuration: this.getAllMetrics().reduce((sum, m) => sum + (m.duration || 0), 0) / this.metrics.size
      }
    };
  }

  clear(): void {
    this.metrics.clear();
    this.stepStartTimes.clear();
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();