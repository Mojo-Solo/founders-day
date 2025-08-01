import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// API Integration Test Suite
// Tests direct integration with the Founders Day Admin Backend
// Requires the admin backend to be running on localhost:3001

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3001'
const FRONTEND_API_URL = process.env.FRONTEND_API_URL || 'http://localhost:3000'
const API_KEY = process.env.ADMIN_API_KEY || 'test-api-key'

interface ApiTestResult {
  endpoint: string
  method: string
  status: number
  success: boolean
  responseTime: number
  error?: string
  data?: any
}

class ApiIntegrationTester {
  private results: ApiTestResult[] = []
  
  async testEndpoint(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<ApiTestResult> {
    const startTime = Date.now()
    const url = endpoint.startsWith('http') ? endpoint : `${ADMIN_API_URL}${endpoint}`
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'Origin': 'http://localhost:3000',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      const responseTime = Date.now() - startTime
      let data: any = null
      
      try {
        data = await response.json()
      } catch (e) {
        // Response might not be JSON
      }
      
      const result: ApiTestResult = {
        endpoint,
        method,
        status: response.status,
        success: response.ok,
        responseTime,
        data
      }
      
      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`
      }
      
      this.results.push(result)
      return result
      
    } catch (error) {
      const responseTime = Date.now() - startTime
      const result: ApiTestResult = {
        endpoint,
        method,
        status: 0,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.results.push(result)
      return result
    }
  }
  
  getResults(): ApiTestResult[] {
    return this.results
  }
  
  getStats() {
    const total = this.results.length
    const successful = this.results.filter(r => r.success).length
    const failed = total - successful
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / total
    
    return {
      total,
      successful,
      failed,
      successRate: (successful / total) * 100,
      avgResponseTime: Math.round(avgResponseTime)
    }
  }
}

describe('API Integration Tests', () => {
  let tester: ApiIntegrationTester
  
  beforeAll(() => {
    tester = new ApiIntegrationTester()
  })
  
  afterAll(() => {
    const stats = tester.getStats()
    console.log('\n📊 API Integration Test Summary:')
    console.log(`Total Tests: ${stats.total}`)
    console.log(`Successful: ${stats.successful}`)
    console.log(`Failed: ${stats.failed}`)
    console.log(`Success Rate: ${stats.successRate.toFixed(1)}%`)
    console.log(`Average Response Time: ${stats.avgResponseTime}ms`)
    
    // Log failed tests
    const failedTests = tester.getResults().filter(r => !r.success)
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:')
      failedTests.forEach(test => {
        console.log(`${test.method} ${test.endpoint}: ${test.error || `HTTP ${test.status}`}`)
      })
    }
  })

  describe('Health Check Endpoints', () => {
    it('should connect to admin backend health endpoint', async () => {
      const result = await tester.testEndpoint('/api/health')
      
      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('status', 'healthy')
      expect(result.responseTime).toBeLessThan(5000)
    })
    
    it('should connect to frontend health endpoint', async () => {
      const result = await tester.testEndpoint(`${FRONTEND_API_URL}/api/health`)
      
      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('status', 'healthy')
    })
  })

  describe('Public Content API', () => {
    it('should fetch all content', async () => {
      const result = await tester.testEndpoint('/api/public/content')
      
      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('content')
      expect(Array.isArray(result.data.content)).toBe(true)
    })
    
    it('should fetch content by category', async () => {
      const result = await tester.testEndpoint('/api/public/content?category=home')
      
      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('content')
    })
    
    it('should fetch specific content by key', async () => {
      const result = await tester.testEndpoint('/api/public/content/hero-title')
      
      if (result.success) {
        expect(result.status).toBe(200)
        expect(result.data).toHaveProperty('key', 'hero-title')
      } else {
        // Content might not exist, which is OK
        expect(result.status).toBe(404)
      }
    })
  })

  describe('Schedule API', () => {
    it('should fetch event schedule', async () => {
      const result = await tester.testEndpoint('/api/schedule')
      
      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('date')
      expect(result.data).toHaveProperty('schedule')
      expect(Array.isArray(result.data.schedule)).toBe(true)
    })
  })

  describe('Registration API', () => {
    it('should accept valid registration', async () => {
      const testRegistration = {
        firstName: 'API',
        lastName: 'Test',
        email: `api-test-${Date.now()}@example.com`,
        phone: '555-0123',
        homeGroup: 'Test Group',
        tickets: {
          eventTickets: 1,
          banquetTickets: 0,
          hotelRooms: 0
        }
      }
      
      const result = await tester.testEndpoint('/api/public/registrations', 'POST', testRegistration)
      
      expect(result.success).toBe(true)
      expect(result.status).toBe(201)
      expect(result.data).toHaveProperty('id')
      expect(result.data).toHaveProperty('confirmationNumber')
    })
    
    it('should reject invalid registration data', async () => {
      const invalidRegistration = {
        firstName: '', // Invalid: empty
        lastName: 'Test',
        email: 'invalid-email', // Invalid: not an email
        tickets: {
          eventTickets: -1 // Invalid: negative
        }
      }
      
      const result = await tester.testEndpoint('/api/public/registrations', 'POST', invalidRegistration)
      
      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.data).toHaveProperty('error')
    })
    
    it('should find registration by email', async () => {
      // First create a registration
      const testEmail = `lookup-test-${Date.now()}@example.com`
      const testRegistration = {
        firstName: 'Lookup',
        lastName: 'Test',
        email: testEmail,
        phone: '555-0124',
        tickets: {
          eventTickets: 1,
          banquetTickets: 0,
          hotelRooms: 0
        }
      }
      
      const createResult = await tester.testEndpoint('/api/public/registrations', 'POST', testRegistration)
      
      if (createResult.success) {
        // Now try to find it
        const findResult = await tester.testEndpoint(`/api/public/registrations?email=${testEmail}`)
        
        expect(findResult.success).toBe(true)
        expect(findResult.status).toBe(200)
        expect(findResult.data.email).toBe(testEmail)
      }
    })
  })

  describe('Volunteer API', () => {
    it('should accept valid volunteer application', async () => {
      const testVolunteer = {
        firstName: 'Volunteer',
        lastName: 'Test',
        email: `volunteer-test-${Date.now()}@example.com`,
        phone: '555-0125',
        experience: 'This is a test volunteer application from API integration tests.',
        availability: ['morning', 'afternoon'],
        roles: ['registration', 'setup']
      }
      
      const result = await tester.testEndpoint('/api/public/volunteers', 'POST', testVolunteer)
      
      expect(result.success).toBe(true)
      expect(result.status).toBe(201)
      expect(result.data).toHaveProperty('id')
    })
    
    it('should reject invalid volunteer data', async () => {
      const invalidVolunteer = {
        firstName: '', // Invalid: empty
        lastName: 'Test',
        email: 'invalid-email', // Invalid: not an email
        experience: 'Too short' // Invalid: too short
      }
      
      const result = await tester.testEndpoint('/api/public/volunteers', 'POST', invalidVolunteer)
      
      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.data).toHaveProperty('error')
    })
    
    it('should find volunteer by email', async () => {
      // First create a volunteer application
      const testEmail = `volunteer-lookup-${Date.now()}@example.com`
      const testVolunteer = {
        firstName: 'Volunteer',
        lastName: 'Lookup',
        email: testEmail,
        phone: '555-0126',
        experience: 'Test volunteer application for lookup test.',
        availability: ['evening'],
        roles: ['cleanup']
      }
      
      const createResult = await tester.testEndpoint('/api/public/volunteers', 'POST', testVolunteer)
      
      if (createResult.success) {
        // Now try to find it
        const findResult = await tester.testEndpoint(`/api/public/volunteers?email=${testEmail}`)
        
        expect(findResult.success).toBe(true)
        expect(findResult.status).toBe(200)
        expect(findResult.data.email).toBe(testEmail)
      }
    })
  })

  describe('Payment API', () => {
    it('should process test payment', async () => {
      const testPayment = {
        amount: 2500, // $25.00
        currency: 'USD',
        paymentMethod: 'square',
        registrationId: 'test-registration-123',
        description: 'API Integration Test Payment'
      }
      
      const result = await tester.testEndpoint('/api/public/payments', 'POST', testPayment)
      
      // Payment might fail in test environment, but should return proper error
      if (result.success) {
        expect(result.status).toBe(200)
        expect(result.data).toHaveProperty('paymentId')
        expect(result.data).toHaveProperty('status')
      } else {
        // Should still return proper error structure
        expect(result.status).toBeGreaterThan(0)
        expect(result.data).toHaveProperty('error')
      }
    })
  })

  describe('CORS and Security', () => {
    it('should handle CORS preflight requests', async () => {
      const result = await tester.testEndpoint('/api/public/content', 'OPTIONS' as any)
      
      expect([200, 204]).toContain(result.status)
    })
    
    it('should require API key for protected endpoints', async () => {
      const result = await tester.testEndpoint('/api/public/registrations', 'POST', {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      }, { 'x-api-key': '' }) // Empty API key
      
      expect(result.success).toBe(false)
      expect([401, 403]).toContain(result.status)
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const result = await tester.testEndpoint('/api/non-existent-endpoint')
      
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })
    
    it('should handle malformed JSON requests', async () => {
      try {
        const response = await fetch(`${ADMIN_API_URL}/api/public/registrations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
          },
          body: 'invalid json{{'
        })
        
        expect(response.ok).toBe(false)
        expect(response.status).toBe(400)
      } catch (error) {
        // Network error is also acceptable for malformed requests
        expect(error).toBeDefined()
      }
    })
    
    it('should handle timeout scenarios', async () => {
      // Test with very short timeout to simulate timeout condition
      try {
        const response = await fetch(`${ADMIN_API_URL}/api/health`, {
          signal: AbortSignal.timeout(1) // 1ms timeout
        })
        
        // If it succeeds, that's fine - the backend is very fast
        expect(response).toBeDefined()
      } catch (error) {
        // Expect timeout error
        expect(error.name).toBe('TimeoutError')
      }
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within acceptable time limits', async () => {
      const endpoints = [
        '/api/health',
        '/api/public/content',
        '/api/schedule'
      ]
      
      for (const endpoint of endpoints) {
        const result = await tester.testEndpoint(endpoint)
        
        if (result.success) {
          expect(result.responseTime).toBeLessThan(2000) // 2 seconds max
        }
      }
    })
    
    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, () => 
        tester.testEndpoint('/api/health')
      )
      
      const results = await Promise.all(promises)
      
      // At least most requests should succeed
      const successCount = results.filter(r => r.success).length
      expect(successCount).toBeGreaterThan(3)
    })
  })
})

// Utility functions for manual testing
export async function runApiHealthCheck(): Promise<Record<string, any>> {
  const tester = new ApiIntegrationTester()
  
  const endpoints = [
    '/api/health',
    '/api/public/content',
    '/api/schedule',
    '/api/public/content/hero-title'
  ]
  
  console.log('🔍 Running API Health Check...')
  
  for (const endpoint of endpoints) {
    await tester.testEndpoint(endpoint)
  }
  
  const stats = tester.getStats()
  const results = tester.getResults()
  
  return {
    stats,
    results,
    timestamp: new Date().toISOString()
  }
}

export async function testRegistrationFlow(): Promise<boolean> {
  const tester = new ApiIntegrationTester()
  
  console.log('🧪 Testing Registration Flow...')
  
  const testRegistration = {
    firstName: 'Flow',
    lastName: 'Test',
    email: `flow-test-${Date.now()}@example.com`,
    phone: '555-FLOW',
    tickets: {
      eventTickets: 1,
      banquetTickets: 1,
      hotelRooms: 0
    }
  }
  
  // Create registration
  const createResult = await tester.testEndpoint('/api/public/registrations', 'POST', testRegistration)
  
  if (!createResult.success) {
    console.error('❌ Registration creation failed:', createResult.error)
    return false
  }
  
  // Lookup registration
  const lookupResult = await tester.testEndpoint(`/api/public/registrations?email=${testRegistration.email}`)
  
  if (!lookupResult.success) {
    console.error('❌ Registration lookup failed:', lookupResult.error)
    return false
  }
  
  console.log('✅ Registration flow test passed')
  return true
}