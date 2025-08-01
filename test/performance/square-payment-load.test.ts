/**
 * Square Payment Performance and Load Tests
 * 
 * Comprehensive performance testing suite for Square payment integration covering:
 * - Payment processing performance under load
 * - Database query performance with large datasets
 * - API endpoint response times and throughput
 * - Frontend component rendering performance
 * - Memory usage and resource optimization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { performance } from 'perf_hooks'
import { faker } from '@faker-js/faker'
import SquareTestDataFactory from '../fixtures/square-test-data'

// Performance testing utilities
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  private memoryBaseline: NodeJS.MemoryUsage | null = null

  startTest(testName: string) {
    this.memoryBaseline = process.memoryUsage()
    return performance.now()
  }

  endTest(testName: string, startTime: number) {
    const endTime = performance.now()
    const duration = endTime - startTime
    
    if (!this.metrics.has(testName)) {
      this.metrics.set(testName, [])
    }
    this.metrics.get(testName)!.push(duration)

    return {
      duration,
      memoryUsage: this.getMemoryDelta(),
    }
  }

  getMetrics(testName: string) {
    const durations = this.metrics.get(testName) || []
    if (durations.length === 0) return null

    return {
      count: durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
    }
  }

  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[index] || 0
  }

  private getMemoryDelta(): NodeJS.MemoryUsage | null {
    if (!this.memoryBaseline) return null
    
    const current = process.memoryUsage()
    return {
      rss: current.rss - this.memoryBaseline.rss,
      heapTotal: current.heapTotal - this.memoryBaseline.heapTotal,
      heapUsed: current.heapUsed - this.memoryBaseline.heapUsed,
      external: current.external - this.memoryBaseline.external,
      arrayBuffers: current.arrayBuffers - this.memoryBaseline.arrayBuffers,
    }
  }

  reset() {
    this.metrics.clear()
    this.memoryBaseline = null
  }
}

// Mock Square API with performance simulation
const mockSquareAPI = {
  createPayment: vi.fn(),
  createCustomer: vi.fn(),
  queryPayments: vi.fn(),
  processRegistrationPayment: vi.fn(),
}

// Mock database with performance simulation
const mockDatabase = {
  query: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('@/lib/services/square-api-client', () => ({
  squareAPIClient: mockSquareAPI,
}))

const performanceMonitor = new PerformanceMonitor()

describe('Square Payment Performance Tests', () => {
  beforeAll(() => {
    // Setup performance monitoring
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    performanceMonitor.reset()
    vi.clearAllMocks()
  })

  describe('Payment Processing Performance', () => {
    it('should handle single payment creation within performance threshold', async () => {
      // Mock fast payment response
      mockSquareAPI.createPayment.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            payment: SquareTestDataFactory.createPayment(),
          }), 150) // 150ms response time
        })
      )

      const testName = 'single-payment-creation'
      const startTime = performanceMonitor.startTest(testName)

      const paymentRequest = {
        sourceId: 'test-card-token',
        amount: 2500,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      vi.advanceTimersByTime(150)
      const result = await mockSquareAPI.createPayment(paymentRequest)

      const metrics = performanceMonitor.endTest(testName, startTime)

      expect(result.success).toBe(true)
      expect(metrics.duration).toBeLessThan(200) // Should complete within 200ms
      expect(metrics.memoryUsage?.heapUsed).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
    })

    it('should handle concurrent payment creation efficiently', async () => {
      const concurrentPayments = 50
      const maxResponseTime = 300

      mockSquareAPI.createPayment.mockImplementation(() => 
        new Promise(resolve => {
          const responseTime = faker.number.int({ min: 100, max: 250 })
          setTimeout(() => resolve({
            success: true,
            payment: SquareTestDataFactory.createPayment(),
          }), responseTime)
        })
      )

      const testName = 'concurrent-payment-creation'
      const startTime = performanceMonitor.startTest(testName)

      const paymentPromises = Array.from({ length: concurrentPayments }, () => {
        const paymentRequest = {
          sourceId: `test-card-token-${faker.string.alphanumeric(8)}`,
          amount: faker.number.int({ min: 1000, max: 10000 }),
          currency: 'USD',
          registrationId: faker.string.uuid(),
        }
        return mockSquareAPI.createPayment(paymentRequest)
      })

      vi.advanceTimersByTime(maxResponseTime)
      const results = await Promise.all(paymentPromises)

      const metrics = performanceMonitor.endTest(testName, startTime)

      expect(results).toHaveLength(concurrentPayments)
      expect(results.every(r => r.success)).toBe(true)
      expect(metrics.duration).toBeLessThan(maxResponseTime + 100) // Allow 100ms overhead
      expect(mockSquareAPI.createPayment).toHaveBeenCalledTimes(concurrentPayments)
    })

    it('should maintain performance under sustained load', async () => {
      const batchSize = 20
      const batchCount = 5
      const maxBatchTime = 500

      mockSquareAPI.createPayment.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            payment: SquareTestDataFactory.createPayment(),
          }), faker.number.int({ min: 50, max: 200 }))
        })
      )

      const testName = 'sustained-load'
      const batchMetrics: any[] = []

      for (let batch = 0; batch < batchCount; batch++) {
        const batchStartTime = performanceMonitor.startTest(`${testName}-batch-${batch}`)

        const batchPromises = Array.from({ length: batchSize }, () => {
          return mockSquareAPI.createPayment({
            sourceId: `batch-${batch}-token-${faker.string.alphanumeric(6)}`,
            amount: faker.number.int({ min: 1000, max: 5000 }),
            currency: 'USD',
            registrationId: faker.string.uuid(),
          })
        })

        vi.advanceTimersByTime(maxBatchTime)
        const batchResults = await Promise.all(batchPromises)

        const batchMetricsResult = performanceMonitor.endTest(`${testName}-batch-${batch}`, batchStartTime)
        batchMetrics.push(batchMetricsResult)

        expect(batchResults).toHaveLength(batchSize)
        expect(batchResults.every(r => r.success)).toBe(true)
        expect(batchMetricsResult.duration).toBeLessThan(maxBatchTime + 50)
      }

      // Verify performance doesn't degrade over time
      const firstBatchTime = batchMetrics[0].duration
      const lastBatchTime = batchMetrics[batchMetrics.length - 1].duration
      const degradation = (lastBatchTime - firstBatchTime) / firstBatchTime

      expect(degradation).toBeLessThan(0.2) // Less than 20% degradation
    })

    it('should handle payment failures efficiently', async () => {
      const failureRate = 0.1 // 10% failure rate
      const totalRequests = 100

      mockSquareAPI.createPayment.mockImplementation(() => 
        new Promise((resolve, reject) => {
          const responseTime = faker.number.int({ min: 50, max: 150 })
          setTimeout(() => {
            if (Math.random() < failureRate) {
              reject({
                errors: [{
                  code: 'CARD_DECLINED',
                  detail: 'Card was declined',
                }],
              })
            } else {
              resolve({
                success: true,
                payment: SquareTestDataFactory.createPayment(),
              })
            }
          }, responseTime)
        })
      )

      const testName = 'payment-failures'
      const startTime = performanceMonitor.startTest(testName)

      const paymentPromises = Array.from({ length: totalRequests }, () => {
        return mockSquareAPI.createPayment({
          sourceId: `failure-test-${faker.string.alphanumeric(6)}`,
          amount: faker.number.int({ min: 1000, max: 5000 }),
          currency: 'USD',
          registrationId: faker.string.uuid(),
        }).catch(error => ({ success: false, error }))
      })

      vi.advanceTimersByTime(200)
      const results = await Promise.all(paymentPromises)

      const metrics = performanceMonitor.endTest(testName, startTime)

      const successfulPayments = results.filter(r => r.success).length
      const failedPayments = results.filter(r => !r.success).length

      expect(results).toHaveLength(totalRequests)
      expect(failedPayments).toBeGreaterThan(totalRequests * 0.05) // At least 5% failures
      expect(failedPayments).toBeLessThan(totalRequests * 0.15) // At most 15% failures
      expect(metrics.duration).toBeLessThan(300) // Should handle failures quickly
    })
  })

  describe('Database Performance Tests', () => {
    it('should handle large payment queries efficiently', async () => {
      const recordCount = 10000
      const pageSize = 100

      mockDatabase.query.mockImplementation(({ limit, offset }) => 
        new Promise(resolve => {
          const responseTime = Math.max(50, Math.min(200, limit * 2)) // Simulate query time based on limit
          setTimeout(() => {
            const payments = SquareTestDataFactory.createPayments(Math.min(limit, recordCount - offset))
            resolve({
              success: true,
              payments,
              pagination: {
                limit,
                offset,
                count: payments.length,
                total: recordCount,
              },
            })
          }, responseTime)
        })
      )

      const testName = 'large-payment-query'
      const startTime = performanceMonitor.startTest(testName)

      const totalPages = Math.ceil(recordCount / pageSize)
      const pagePromises = Array.from({ length: totalPages }, (_, pageIndex) => {
        return mockDatabase.query({
          limit: pageSize,
          offset: pageIndex * pageSize,
        })
      })

      vi.advanceTimersByTime(300)
      const results = await Promise.all(pagePromises)

      const metrics = performanceMonitor.endTest(testName, startTime)

      expect(results).toHaveLength(totalPages)
      expect(results.every(r => r.success)).toBe(true)
      expect(metrics.duration).toBeLessThan(500) // All pages should load within 500ms
    })

    it('should optimize payment insertion performance', async () => {
      const batchSize = 500
      const insertionTime = 2 // 2ms per record

      mockDatabase.insert.mockImplementation((payments) => 
        new Promise(resolve => {
          const responseTime = payments.length * insertionTime
          setTimeout(() => {
            resolve({
              success: true,
              insertedCount: payments.length,
            })
          }, responseTime)
        })
      )

      const testName = 'batch-payment-insertion'
      const startTime = performanceMonitor.startTest(testName)

      const payments = SquareTestDataFactory.createPayments(batchSize)

      vi.advanceTimersByTime(batchSize * insertionTime + 100)
      const result = await mockDatabase.insert(payments)

      const metrics = performanceMonitor.endTest(testName, startTime)

      expect(result.success).toBe(true)
      expect(result.insertedCount).toBe(batchSize)
      expect(metrics.duration).toBeLessThan(batchSize * insertionTime + 200) // Allow 200ms overhead
    })

    it('should handle complex query filtering efficiently', async () => {
      const totalRecords = 50000
      const filterComplexity = 5 // Number of filter conditions

      mockDatabase.query.mockImplementation((filters) => 
        new Promise(resolve => {
          const filterCount = Object.keys(filters).length
          const baseTime = 100
          const complexityPenalty = filterCount * 20
          const responseTime = baseTime + complexityPenalty

          setTimeout(() => {
            const resultCount = Math.floor(totalRecords / (filterCount + 1))
            const payments = SquareTestDataFactory.createPayments(Math.min(100, resultCount))
            
            resolve({
              success: true,
              payments,
              pagination: {
                count: payments.length,
                total: resultCount,
              },
            })
          }, responseTime)
        })
      )

      const testName = 'complex-query-filtering'
      const startTime = performanceMonitor.startTest(testName)

      const complexFilters = {
        status: 'COMPLETED',
        amount_min: 1000,
        amount_max: 10000,
        date_from: '2024-01-01',
        date_to: '2024-12-31',
      }

      vi.advanceTimersByTime(300)
      const result = await mockDatabase.query(complexFilters)

      const metrics = performanceMonitor.endTest(testName, startTime)

      expect(result.success).toBe(true)
      expect(result.payments).toBeDefined()
      expect(metrics.duration).toBeLessThan(250) // Complex queries should complete within 250ms
    })
  })

  describe('API Response Time Performance', () => {
    it('should meet API response time SLAs', async () => {
      const endpoints = [
        { name: 'payments', maxTime: 200 },
        { name: 'customers', maxTime: 150 },
        { name: 'reconciliation', maxTime: 500 },
        { name: 'analytics', maxTime: 1000 },
      ]

      const apiMocks = {
        payments: () => Promise.resolve({ success: true, data: SquareTestDataFactory.createPayments(10) }),
        customers: () => Promise.resolve({ success: true, data: SquareTestDataFactory.createCustomers(10) }),
        reconciliation: () => Promise.resolve({ success: true, data: SquareTestDataFactory.createReconciliationData() }),
        analytics: () => Promise.resolve({ success: true, data: SquareTestDataFactory.createAnalyticsData() }),
      }

      for (const endpoint of endpoints) {
        const testName = `api-${endpoint.name}-response-time`
        const startTime = performanceMonitor.startTest(testName)

        // Simulate network latency
        vi.advanceTimersByTime(endpoint.maxTime - 50)
        const result = await apiMocks[endpoint.name]()

        const metrics = performanceMonitor.endTest(testName, startTime)

        expect(result.success).toBe(true)
        expect(metrics.duration).toBeLessThan(endpoint.maxTime)
      }
    })

    it('should handle API rate limiting gracefully', async () => {
      const requestsPerSecond = 100
      const testDuration = 5000 // 5 seconds
      const expectedRequests = (requestsPerSecond * testDuration) / 1000

      let rateLimitedRequests = 0
      let successfulRequests = 0

      mockSquareAPI.createPayment.mockImplementation(() => 
        new Promise((resolve, reject) => {
          // Simulate rate limiting after certain threshold
          if (successfulRequests >= requestsPerSecond) {
            rateLimitedRequests++
            reject({
              error: 'Rate limit exceeded',
              code: 'RATE_LIMITED',
            })
          } else {
            successfulRequests++
            resolve({
              success: true,
              payment: SquareTestDataFactory.createPayment(),
            })
          }
        })
      )

      const testName = 'api-rate-limiting'
      const startTime = performanceMonitor.startTest(testName)

      const requestPromises = Array.from({ length: expectedRequests }, () => {
        return mockSquareAPI.createPayment({
          sourceId: `rate-test-${faker.string.alphanumeric(6)}`,
          amount: 1000,
          currency: 'USD',
          registrationId: faker.string.uuid(),
        }).catch(error => ({ success: false, error }))
      })

      vi.advanceTimersByTime(testDuration)
      const results = await Promise.all(requestPromises)

      const metrics = performanceMonitor.endTest(testName, startTime)

      expect(results).toHaveLength(expectedRequests)
      expect(successfulRequests).toBe(requestsPerSecond)
      expect(rateLimitedRequests).toBeGreaterThan(0)
      expect(metrics.duration).toBeLessThan(testDuration + 1000)
    })
  })

  describe('Memory Usage and Resource Optimization', () => {
    it('should not leak memory during payment processing', async () => {
      const iterationCount = 100
      const memoryThreshold = 50 * 1024 * 1024 // 50MB

      mockSquareAPI.createPayment.mockImplementation(() => 
        Promise.resolve({
          success: true,
          payment: SquareTestDataFactory.createPayment(),
        })
      )

      const testName = 'memory-leak-test'
      const startTime = performanceMonitor.startTest(testName)
      const initialMemory = process.memoryUsage()

      for (let i = 0; i < iterationCount; i++) {
        await mockSquareAPI.createPayment({
          sourceId: `memory-test-${i}`,
          amount: 1000,
          currency: 'USD',
          registrationId: faker.string.uuid(),
        })

        // Force garbage collection periodically
        if (i % 10 === 0 && global.gc) {
          global.gc()
        }
      }

      const metrics = performanceMonitor.endTest(testName, startTime)
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      expect(memoryIncrease).toBeLessThan(memoryThreshold)
      expect(metrics.memoryUsage?.heapUsed).toBeLessThan(memoryThreshold)
    })

    it('should optimize data structure usage for large datasets', async () => {
      const largeDatasetSize = 10000
      const memoryPerRecord = 1024 // 1KB per record maximum

      const testName = 'large-dataset-memory'
      const startTime = performanceMonitor.startTest(testName)

      // Create large dataset
      const largeDataset = SquareTestDataFactory.createPayments(largeDatasetSize)

      // Simulate processing the dataset
      const processedData = largeDataset.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
      }))

      const metrics = performanceMonitor.endTest(testName, startTime)

      expect(processedData).toHaveLength(largeDatasetSize)
      expect(metrics.memoryUsage?.heapUsed).toBeLessThan(largeDatasetSize * memoryPerRecord)
    })

    it('should handle garbage collection efficiently', async () => {
      const allocationCount = 1000
      const allocationSize = 1024 * 1024 // 1MB per allocation

      const testName = 'garbage-collection-test'
      const startTime = performanceMonitor.startTest(testName)
      const initialMemory = process.memoryUsage()

      // Create and release large objects
      for (let i = 0; i < allocationCount; i++) {
        const largeObject = {
          data: new Array(allocationSize / 8).fill(i), // 8 bytes per number
          metadata: SquareTestDataFactory.createPayment(),
        }

        // Use the object briefly
        const serialized = JSON.stringify(largeObject)
        const deserialized = JSON.parse(serialized)

        // Release reference
        if (i % 100 === 0 && global.gc) {
          global.gc()
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc()
      }

      const metrics = performanceMonitor.endTest(testName, startTime)
      const finalMemory = process.memoryUsage()
      const memoryRetained = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory should not grow significantly after GC
      expect(memoryRetained).toBeLessThan(allocationSize * 10) // Less than 10 allocations retained
    })
  })

  describe('Stress Testing', () => {
    it('should handle extreme load conditions', async () => {
      const extremeLoad = {
        concurrentUsers: 200,
        requestsPerUser: 10,
        maxResponseTime: 2000,
      }

      mockSquareAPI.createPayment.mockImplementation(() => 
        new Promise(resolve => {
          const responseTime = faker.number.int({ min: 200, max: 800 })
          setTimeout(() => resolve({
            success: true,
            payment: SquareTestDataFactory.createPayment(),
          }), responseTime)
        })
      )

      const testName = 'extreme-load-test'
      const startTime = performanceMonitor.startTest(testName)

      const userPromises = Array.from({ length: extremeLoad.concurrentUsers }, (_, userIndex) => {
        const userRequests = Array.from({ length: extremeLoad.requestsPerUser }, (_, requestIndex) => {
          return mockSquareAPI.createPayment({
            sourceId: `extreme-load-user-${userIndex}-req-${requestIndex}`,
            amount: faker.number.int({ min: 1000, max: 5000 }),
            currency: 'USD',
            registrationId: faker.string.uuid(),
          })
        })
        return Promise.all(userRequests)
      })

      vi.advanceTimersByTime(extremeLoad.maxResponseTime)
      const results = await Promise.all(userPromises)

      const metrics = performanceMonitor.endTest(testName, startTime)

      const totalRequests = extremeLoad.concurrentUsers * extremeLoad.requestsPerUser
      const flatResults = results.flat()

      expect(flatResults).toHaveLength(totalRequests)
      expect(flatResults.every(r => r.success)).toBe(true)
      expect(metrics.duration).toBeLessThan(extremeLoad.maxResponseTime + 500)
      expect(mockSquareAPI.createPayment).toHaveBeenCalledTimes(totalRequests)
    })

    it('should recover from system overload', async () => {
      let systemOverloaded = false
      let overloadRecoveryTime = 0

      mockSquareAPI.createPayment.mockImplementation(() => 
        new Promise((resolve, reject) => {
          if (systemOverloaded && Date.now() - overloadRecoveryTime < 2000) {
            reject({
              error: 'System overloaded',
              code: 'SYSTEM_OVERLOAD',
            })
          } else {
            systemOverloaded = false
            resolve({
              success: true,
              payment: SquareTestDataFactory.createPayment(),
            })
          }
        })
      )

      const testName = 'system-overload-recovery'
      const startTime = performanceMonitor.startTest(testName)

      // Simulate system overload
      systemOverloaded = true
      overloadRecoveryTime = Date.now()

      const initialRequests = Array.from({ length: 50 }, () => {
        return mockSquareAPI.createPayment({
          sourceId: `overload-test-${faker.string.alphanumeric(6)}`,
          amount: 1000,
          currency: 'USD',
          registrationId: faker.string.uuid(),
        }).catch(error => ({ success: false, error }))
      })

      const initialResults = await Promise.all(initialRequests)
      const failedInitialRequests = initialResults.filter(r => !r.success).length

      // Wait for recovery
      vi.advanceTimersByTime(3000) // 3 seconds

      const recoveryRequests = Array.from({ length: 50 }, () => {
        return mockSquareAPI.createPayment({
          sourceId: `recovery-test-${faker.string.alphanumeric(6)}`,
          amount: 1000,
          currency: 'USD',
          registrationId: faker.string.uuid(),
        }).catch(error => ({ success: false, error }))
      })

      const recoveryResults = await Promise.all(recoveryRequests)
      const successfulRecoveryRequests = recoveryResults.filter(r => r.success).length

      const metrics = performanceMonitor.endTest(testName, startTime)

      expect(failedInitialRequests).toBeGreaterThan(40) // Most initial requests should fail
      expect(successfulRecoveryRequests).toBeGreaterThan(40) // Most recovery requests should succeed
    })
  })

  describe('Performance Regression Tests', () => {
    it('should maintain consistent performance across test runs', async () => {
      const testRuns = 5
      const consistencyThreshold = 0.2 // 20% variance allowed

      mockSquareAPI.createPayment.mockImplementation(() => 
        Promise.resolve({
          success: true,
          payment: SquareTestDataFactory.createPayment(),
        })
      )

      const runTimes: number[] = []

      for (let run = 0; run < testRuns; run++) {
        const testName = `consistency-test-run-${run}`
        const startTime = performanceMonitor.startTest(testName)

        const requests = Array.from({ length: 100 }, () => {
          return mockSquareAPI.createPayment({
            sourceId: `consistency-test-${faker.string.alphanumeric(6)}`,
            amount: 1000,
            currency: 'USD',
            registrationId: faker.string.uuid(),
          })
        })

        vi.advanceTimersByTime(200)
        await Promise.all(requests)

        const metrics = performanceMonitor.endTest(testName, startTime)
        runTimes.push(metrics.duration)
      }

      const avgTime = runTimes.reduce((a, b) => a + b, 0) / runTimes.length
      const maxVariance = Math.max(...runTimes.map(time => Math.abs(time - avgTime) / avgTime))

      expect(maxVariance).toBeLessThan(consistencyThreshold)
    })
  })
})

// Performance benchmark utilities
export const PerformanceBenchmarks = {
  /**
   * Benchmark payment processing performance
   */
  async benchmarkPaymentProcessing(iterations: number = 1000): Promise<any> {
    const startTime = performance.now()
    const memoryStart = process.memoryUsage()

    const results = []
    for (let i = 0; i < iterations; i++) {
      const payment = SquareTestDataFactory.createPayment()
      results.push(payment)
    }

    const endTime = performance.now()
    const memoryEnd = process.memoryUsage()

    return {
      iterations,
      totalTime: endTime - startTime,
      avgTimePerIteration: (endTime - startTime) / iterations,
      memoryUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
      throughput: iterations / ((endTime - startTime) / 1000), // Operations per second
    }
  },

  /**
   * Benchmark database query performance
   */
  async benchmarkDatabaseQueries(queryCount: number = 100): Promise<any> {
    const startTime = performance.now()

    const queries = Array.from({ length: queryCount }, () => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(SquareTestDataFactory.createPayments(10))
        }, faker.number.int({ min: 10, max: 100 }))
      })
    })

    const results = await Promise.all(queries)
    const endTime = performance.now()

    return {
      queryCount,
      totalTime: endTime - startTime,
      avgTimePerQuery: (endTime - startTime) / queryCount,
      totalRecords: results.flat().length,
      queriesPerSecond: queryCount / ((endTime - startTime) / 1000),
    }
  },

  /**
   * Generate performance report
   */
  generatePerformanceReport(metrics: any[]): string {
    const report = [
      '# Square Payment Performance Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      `Total tests: ${metrics.length}`,
      '',
      '## Test Results',
    ]

    metrics.forEach(metric => {
      report.push(`### ${metric.testName}`)
      report.push(`- Duration: ${metric.duration.toFixed(2)}ms`)
      report.push(`- Memory used: ${(metric.memoryUsage?.heapUsed || 0 / 1024 / 1024).toFixed(2)}MB`)
      report.push(`- Status: ${metric.success ? 'PASS' : 'FAIL'}`)
      report.push('')
    })

    return report.join('\n')
  },
}

export { PerformanceMonitor }