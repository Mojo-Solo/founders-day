/**
 * Custom Coverage Report Generator for Square Payment Integration
 * 
 * Generates comprehensive coverage reports with Square-specific metrics
 * and integration with CI/CD pipeline reporting.
 */

const fs = require('fs').promises
const path = require('path')

class SquareCoverageReporter {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './coverage',
      minCoverage: options.minCoverage || 85,
      criticalFiles: options.criticalFiles || [
        'lib/services/square-api-client.ts',
        'app/api/square/**/*',
        'components/**/*square*',
      ],
      ...options,
    }
  }

  /**
   * Generate comprehensive coverage report
   */
  async generateReport() {
    try {
      console.log('📊 Generating Square payment integration coverage report...')
      
      const coverageData = await this.loadCoverageData()
      const report = await this.createDetailedReport(coverageData)
      
      await this.writeCoverageReport(report)
      await this.generateBadges(report)
      await this.checkCoverageThresholds(report)
      
      console.log('✅ Coverage report generated successfully')
      return report
      
    } catch (error) {
      console.error('❌ Coverage report generation failed:', error)
      throw error
    }
  }

  /**
   * Load coverage data from various sources
   */
  async loadCoverageData() {
    const coverageFiles = [
      path.join(this.options.outputDir, 'coverage-final.json'),
      path.join(this.options.outputDir, 'lcov.info'),
      './test-results/test-results.json',
    ]
    
    const data = {
      coverage: null,
      lcov: null,
      testResults: null,
    }
    
    // Load JSON coverage data
    try {
      const coverageContent = await fs.readFile(coverageFiles[0], 'utf8')
      data.coverage = JSON.parse(coverageContent)
    } catch (error) {
      console.warn('⚠️  Coverage JSON not found, using alternative sources')
    }
    
    // Load LCOV data
    try {
      data.lcov = await fs.readFile(coverageFiles[1], 'utf8')
    } catch (error) {
      console.warn('⚠️  LCOV file not found')
    }
    
    // Load test results
    try {
      const testContent = await fs.readFile(coverageFiles[2], 'utf8')
      data.testResults = JSON.parse(testContent)
    } catch (error) {
      console.warn('⚠️  Test results not found')
    }
    
    return data
  }

  /**
   * Create detailed coverage report
   */
  async createDetailedReport(data) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        overall: this.calculateOverallCoverage(data.coverage),
        critical: this.calculateCriticalFilesCoverage(data.coverage),
        byCategory: this.categorizeCoverage(data.coverage),
      },
      files: this.analyzeFileCoverage(data.coverage),
      tests: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      },
      thresholds: {
        met: false,
        details: [],
      },
      recommendations: [],
    }
    
    // Add test results if available
    if (data.testResults) {
      report.tests = this.extractTestMetrics(data.testResults)
    }
    
    // Generate recommendations
    report.recommendations = this.generateRecommendations(report)
    
    return report
  }

  /**
   * Calculate overall coverage metrics
   */
  calculateOverallCoverage(coverageData) {
    if (!coverageData) {
      return { lines: 0, functions: 0, branches: 0, statements: 0 }
    }
    
    let totalLines = 0
    let coveredLines = 0
    let totalFunctions = 0
    let coveredFunctions = 0
    let totalBranches = 0
    let coveredBranches = 0
    let totalStatements = 0
    let coveredStatements = 0
    
    Object.values(coverageData).forEach(file => {
      if (file.lines) {
        totalLines += Object.keys(file.lines).length
        coveredLines += Object.values(file.lines).filter(count => count > 0).length
      }
      
      if (file.functions) {
        totalFunctions += Object.keys(file.functions).length
        coveredFunctions += Object.values(file.functions).filter(count => count > 0).length
      }
      
      if (file.branches) {
        totalBranches += Object.keys(file.branches).length
        coveredBranches += Object.values(file.branches).filter(count => count > 0).length
      }
      
      if (file.statements) {
        totalStatements += Object.keys(file.statements).length
        coveredStatements += Object.values(file.statements).filter(count => count > 0).length
      }
    })
    
    return {
      lines: totalLines ? Math.round((coveredLines / totalLines) * 100) : 0,
      functions: totalFunctions ? Math.round((coveredFunctions / totalFunctions) * 100) : 0,
      branches: totalBranches ? Math.round((coveredBranches / totalBranches) * 100) : 0,
      statements: totalStatements ? Math.round((coveredStatements / totalStatements) * 100) : 0,
    }
  }

  /**
   * Calculate coverage for critical Square integration files
   */
  calculateCriticalFilesCoverage(coverageData) {
    if (!coverageData) return {}
    
    const criticalCoverage = {}
    
    this.options.criticalFiles.forEach(pattern => {
      const matchingFiles = Object.keys(coverageData).filter(filePath =>
        this.matchesPattern(filePath, pattern)
      )
      
      if (matchingFiles.length > 0) {
        criticalCoverage[pattern] = this.calculateFilesGroupCoverage(
          matchingFiles.map(file => coverageData[file])
        )
      }
    })
    
    return criticalCoverage
  }

  /**
   * Categorize coverage by functionality
   */
  categorizeCoverage(coverageData) {
    if (!coverageData) return {}
    
    const categories = {
      'Payment Processing': [],
      'Customer Management': [],
      'Webhook Handling': [],
      'Database Operations': [],
      'UI Components': [],
      'API Endpoints': [],
      'Utilities': [],
    }
    
    Object.keys(coverageData).forEach(filePath => {
      if (filePath.includes('/square/payments')) {
        categories['Payment Processing'].push(filePath)
      } else if (filePath.includes('/square/customers')) {
        categories['Customer Management'].push(filePath)
      } else if (filePath.includes('webhook')) {
        categories['Webhook Handling'].push(filePath)
      } else if (filePath.includes('/database/')) {
        categories['Database Operations'].push(filePath)
      } else if (filePath.includes('/components/')) {
        categories['UI Components'].push(filePath)
      } else if (filePath.includes('/api/')) {
        categories['API Endpoints'].push(filePath)
      } else {
        categories['Utilities'].push(filePath)
      }
    })
    
    const categoryCoverage = {}
    Object.entries(categories).forEach(([category, files]) => {
      if (files.length > 0) {
        const fileData = files.map(file => coverageData[file])
        categoryCoverage[category] = this.calculateFilesGroupCoverage(fileData)
      }
    })
    
    return categoryCoverage
  }

  /**
   * Analyze individual file coverage
   */
  analyzeFileCoverage(coverageData) {
    if (!coverageData) return []
    
    return Object.entries(coverageData).map(([filePath, data]) => {
      const coverage = this.calculateFileCoverage(data)
      return {
        path: filePath,
        coverage,
        critical: this.isCriticalFile(filePath),
        size: data.statementMap ? Object.keys(data.statementMap).length : 0,
        complexity: this.estimateComplexity(data),
      }
    }).sort((a, b) => {
      // Sort by critical files first, then by lowest coverage
      if (a.critical && !b.critical) return -1
      if (!a.critical && b.critical) return 1
      return a.coverage.overall - b.coverage.overall
    })
  }

  /**
   * Generate improvement recommendations
   */
  generateRecommendations(report) {
    const recommendations = []
    
    // Overall coverage recommendations
    if (report.summary.overall.lines < this.options.minCoverage) {
      recommendations.push({
        type: 'coverage',
        priority: 'high',
        title: 'Improve Overall Line Coverage',
        description: `Current coverage (${report.summary.overall.lines}%) is below threshold (${this.options.minCoverage}%)`,
        action: 'Add more unit tests focusing on uncovered code paths',
      })
    }
    
    // Critical file recommendations
    Object.entries(report.summary.critical).forEach(([pattern, coverage]) => {
      if (coverage.lines < 95) {
        recommendations.push({
          type: 'critical',
          priority: 'high',
          title: `Critical File Coverage: ${pattern}`,
          description: `Coverage (${coverage.lines}%) below critical threshold (95%)`,
          action: 'Prioritize testing critical Square integration components',
        })
      }
    })
    
    // File-specific recommendations
    report.files.filter(file => file.critical && file.coverage.overall < 90).forEach(file => {
      recommendations.push({
        type: 'file',
        priority: 'medium',
        title: `Low Coverage: ${file.path}`,
        description: `File coverage (${file.coverage.overall}%) needs improvement`,
        action: 'Add targeted tests for uncovered branches and edge cases',
      })
    })
    
    // Branch coverage recommendations
    if (report.summary.overall.branches < 80) {
      recommendations.push({
        type: 'branches',
        priority: 'medium',
        title: 'Improve Branch Coverage',
        description: `Branch coverage (${report.summary.overall.branches}%) indicates missing edge case tests`,
        action: 'Focus on testing error paths, edge cases, and conditional logic',
      })
    }
    
    return recommendations
  }

  /**
   * Write comprehensive coverage report
   */
  async writeCoverageReport(report) {
    const outputPath = path.join(this.options.outputDir, 'square-coverage-report.json')
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2))
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report)
    const htmlPath = path.join(this.options.outputDir, 'square-coverage-report.html')
    await fs.writeFile(htmlPath, htmlReport)
    
    // Generate markdown summary
    const markdownReport = this.generateMarkdownReport(report)
    const markdownPath = path.join(this.options.outputDir, 'coverage-summary.md')
    await fs.writeFile(markdownPath, markdownReport)
  }

  /**
   * Generate HTML coverage report
   */
  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Square Payment Integration - Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric h3 { margin: 0 0 10px 0; }
        .metric .value { font-size: 2em; font-weight: bold; }
        .high { color: #28a745; }
        .medium { color: #ffc107; }
        .low { color: #dc3545; }
        .recommendations { margin: 20px 0; }
        .recommendation { background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Square Payment Integration - Coverage Report</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Lines</h3>
            <div class="value ${this.getCoverageClass(report.summary.overall.lines)}">${report.summary.overall.lines}%</div>
        </div>
        <div class="metric">
            <h3>Functions</h3>
            <div class="value ${this.getCoverageClass(report.summary.overall.functions)}">${report.summary.overall.functions}%</div>
        </div>
        <div class="metric">
            <h3>Branches</h3>
            <div class="value ${this.getCoverageClass(report.summary.overall.branches)}">${report.summary.overall.branches}%</div>
        </div>
        <div class="metric">
            <h3>Statements</h3>
            <div class="value ${this.getCoverageClass(report.summary.overall.statements)}">${report.summary.overall.statements}%</div>
        </div>
    </div>
    
    <h2>Critical Files Coverage</h2>
    <table>
        <tr><th>Pattern</th><th>Lines</th><th>Functions</th><th>Branches</th></tr>
        ${Object.entries(report.summary.critical).map(([pattern, coverage]) => `
            <tr>
                <td>${pattern}</td>
                <td class="${this.getCoverageClass(coverage.lines)}">${coverage.lines}%</td>
                <td class="${this.getCoverageClass(coverage.functions)}">${coverage.functions}%</td>
                <td class="${this.getCoverageClass(coverage.branches)}">${coverage.branches}%</td>
            </tr>
        `).join('')}
    </table>
    
    <h2>Recommendations</h2>
    <div class="recommendations">
        ${report.recommendations.map(rec => `
            <div class="recommendation">
                <h4>${rec.title}</h4>
                <p><strong>Priority:</strong> ${rec.priority}</p>
                <p>${rec.description}</p>
                <p><strong>Action:</strong> ${rec.action}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>
    `
  }

  /**
   * Generate markdown coverage summary
   */
  generateMarkdownReport(report) {
    return `
# Square Payment Integration - Coverage Report

Generated: ${report.timestamp}

## Summary

| Metric | Coverage |
|--------|----------|
| Lines | ${report.summary.overall.lines}% |
| Functions | ${report.summary.overall.functions}% |
| Branches | ${report.summary.overall.branches}% |
| Statements | ${report.summary.overall.statements}% |

## Critical Files Coverage

${Object.entries(report.summary.critical).map(([pattern, coverage]) => 
  `- **${pattern}**: ${coverage.lines}% lines, ${coverage.functions}% functions, ${coverage.branches}% branches`
).join('\n')}

## Recommendations

${report.recommendations.map(rec => 
  `### ${rec.title}\n**Priority:** ${rec.priority}\n${rec.description}\n**Action:** ${rec.action}\n`
).join('\n')}

## Test Results

- Total Tests: ${report.tests.total}
- Passed: ${report.tests.passed}
- Failed: ${report.tests.failed}
- Duration: ${report.tests.duration}ms
    `
  }

  // Helper methods
  matchesPattern(filePath, pattern) {
    return filePath.includes(pattern.replace('**/*', '').replace('*', ''))
  }

  calculateFilesGroupCoverage(files) {
    // Implementation for calculating group coverage
    return { lines: 0, functions: 0, branches: 0, statements: 0 }
  }

  calculateFileCoverage(data) {
    // Implementation for calculating individual file coverage
    return { overall: 0, lines: 0, functions: 0, branches: 0 }
  }

  isCriticalFile(filePath) {
    return this.options.criticalFiles.some(pattern => this.matchesPattern(filePath, pattern))
  }

  estimateComplexity(data) {
    // Simple complexity estimation based on branches and functions
    const branches = data.branchMap ? Object.keys(data.branchMap).length : 0
    const functions = data.fnMap ? Object.keys(data.fnMap).length : 0
    return branches + functions
  }

  extractTestMetrics(testResults) {
    // Extract test metrics from test results
    return {
      total: testResults.numTotalTests || 0,
      passed: testResults.numPassedTests || 0,
      failed: testResults.numFailedTests || 0,
      skipped: testResults.numPendingTests || 0,
      duration: testResults.testExecTime || 0,
    }
  }

  getCoverageClass(percentage) {
    if (percentage >= 90) return 'high'
    if (percentage >= 70) return 'medium'
    return 'low'
  }

  /**
   * Check coverage thresholds and exit with appropriate code
   */
  async checkCoverageThresholds(report) {
    const failures = []
    
    if (report.summary.overall.lines < this.options.minCoverage) {
      failures.push(`Line coverage ${report.summary.overall.lines}% below threshold ${this.options.minCoverage}%`)
    }
    
    if (report.summary.overall.functions < this.options.minCoverage) {
      failures.push(`Function coverage ${report.summary.overall.functions}% below threshold ${this.options.minCoverage}%`)
    }
    
    if (failures.length > 0) {
      console.error('❌ Coverage thresholds not met:')
      failures.forEach(failure => console.error(`  • ${failure}`))
      process.exit(1)
    } else {
      console.log('✅ All coverage thresholds met')
    }
  }

  /**
   * Generate coverage badges
   */
  async generateBadges(report) {
    const badges = [
      {
        label: 'coverage',
        message: `${report.summary.overall.lines}%`,
        color: this.getBadgeColor(report.summary.overall.lines),
      },
      {
        label: 'tests',
        message: `${report.tests.passed}/${report.tests.total}`,
        color: report.tests.failed > 0 ? 'red' : 'green',
      }
    ]
    
    const badgesPath = path.join(this.options.outputDir, 'badges.json')
    await fs.writeFile(badgesPath, JSON.stringify(badges, null, 2))
  }

  getBadgeColor(percentage) {
    if (percentage >= 90) return 'brightgreen'
    if (percentage >= 80) return 'green'
    if (percentage >= 70) return 'yellow'
    if (percentage >= 60) return 'orange'
    return 'red'
  }
}

// CLI interface
if (require.main === module) {
  const reporter = new SquareCoverageReporter({
    outputDir: process.argv[2] || './coverage',
    minCoverage: parseInt(process.argv[3]) || 85,
  })
  
  reporter.generateReport().catch(error => {
    console.error('Coverage report generation failed:', error)
    process.exit(1)
  })
}

module.exports = SquareCoverageReporter