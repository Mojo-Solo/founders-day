#!/usr/bin/env node

/**
 * Enhanced API Integration Test Runner
 * Tests the integration between Founders Day Frontend and Admin Backend
 * 
 * Usage:
 *   node test-admin-integration-enhanced.js
 *   npm run test:integration:enhanced
 */

const https = require('https');
const http = require('http');

// Configuration
const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'https://founders-day-admin-d5dnibu2i-mojosolos-projects.vercel.app';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_KEY = process.env.ADMIN_API_KEY || 'test-api-key';
const TIMEOUT = 10000; // 10 seconds

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  results: [],
  startTime: Date.now()
};

// Colored console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestModule = url.startsWith('https:') ? https : http;
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, TIMEOUT);

    const req = requestModule.request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Origin': 'http://localhost:3000',
        'User-Agent': 'Founders-Day-Integration-Test/1.0',
        ...options.headers
      },
      ...options
    }, (res) => {
      clearTimeout(timeout);
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            success: res.statusCode >= 200 && res.statusCode < 300,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runTest(name, testFunction, category = 'General') {
  testResults.total++;
  const startTime = Date.now();
  
  try {
    log(`  🧪 ${name}`, 'cyan');
    const result = await testFunction();
    const duration = Date.now() - startTime;
    
    if (result.success !== false) {
      testResults.passed++;
      log(`    ✅ PASSED (${duration}ms)`, 'green');
      testResults.results.push({
        name,
        category,
        status: 'PASSED',
        duration,
        details: result
      });
    } else {
      testResults.failed++;
      log(`    ❌ FAILED (${duration}ms): ${result.error || 'Unknown error'}`, 'red');
      testResults.results.push({
        name,
        category,
        status: 'FAILED',
        duration,
        error: result.error,
        details: result
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.failed++;
    log(`    ❌ ERROR (${duration}ms): ${error.message}`, 'red');
    testResults.results.push({
      name,
      category,
      status: 'ERROR',
      duration,
      error: error.message
    });
  }
}

// Test Suite Definitions
const testSuites = {
  'Health & Connectivity': [
    {
      name: 'Admin API Health Check',
      test: async () => {
        const response = await makeRequest(`${ADMIN_API_URL}/api/health`);
        if (!response.success) {
          return { success: false, error: `HTTP ${response.status}` };
        }
        if (!response.data || response.data.status !== 'healthy') {
          return { success: false, error: 'Health check returned unhealthy status' };
        }
        return { success: true, data: response.data };
      }
    },
    {
      name: 'Frontend Health Check',
      test: async () => {
        try {
          const response = await makeRequest(`${FRONTEND_URL}/api/health`);
          return response.success ? 
            { success: true, data: response.data } : 
            { success: false, error: `HTTP ${response.status}` };
        } catch (error) {
          return { success: false, error: `Frontend not accessible: ${error.message}` };
        }
      }
    },
    {
      name: 'CORS Configuration',
      test: async () => {
        const response = await makeRequest(`${ADMIN_API_URL}/api/public/content`, {
          method: 'OPTIONS',
          headers: {
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type'
          }
        });
        
        const corsHeader = response.headers['access-control-allow-origin'];
        if (!corsHeader) {
          return { success: false, error: 'Missing CORS headers' };
        }
        
        return { success: true, corsHeaders: response.headers };
      }
    }
  ],

  'Content Management': [
    {
      name: 'Fetch All Content',
      test: async () => {
        const response = await makeRequest(`${ADMIN_API_URL}/api/public/content`);
        if (!response.success) {
          return { success: false, error: `HTTP ${response.status}` };
        }
        if (!response.data || !Array.isArray(response.data.content)) {
          return { success: false, error: 'Invalid content structure' };
        }
        return { success: true, contentCount: response.data.content.length };
      }
    },
    {
      name: 'Fetch Content by Category',
      test: async () => {
        const response = await makeRequest(`${ADMIN_API_URL}/api/public/content?category=home`);
        if (!response.success) {
          return { success: false, error: `HTTP ${response.status}` };
        }
        return { success: true, data: response.data };
      }
    },
    {
      name: 'Fetch Specific Content Key',
      test: async () => {
        const response = await makeRequest(`${ADMIN_API_URL}/api/public/content/hero-title`);
        // This might return 404 if content doesn't exist, which is OK
        if (response.status === 404) {
          return { success: true, note: 'Content key not found (expected in test)' };
        }
        if (!response.success) {
          return { success: false, error: `HTTP ${response.status}` };
        }
        return { success: true, data: response.data };
      }
    }
  ],

  'Event Data': [
    {
      name: 'Fetch Event Schedule',
      test: async () => {
        const response = await makeRequest(`${ADMIN_API_URL}/api/schedule`);
        if (!response.success) {
          return { success: false, error: `HTTP ${response.status}` };
        }
        if (!response.data || !response.data.date || !Array.isArray(response.data.schedule)) {
          return { success: false, error: 'Invalid schedule structure' };
        }
        return { success: true, scheduleItems: response.data.schedule.length };
      }
    }
  ],

  'Registration System': [
    {
      name: 'Create Valid Registration',
      test: async () => {
        const testRegistration = {
          firstName: 'Integration',
          lastName: 'Test',
          email: `integration-test-${Date.now()}@example.com`,
          phone: '555-0199',
          homeGroup: 'API Test Group',
          tickets: {
            eventTickets: 1,
            banquetTickets: 0,
            hotelRooms: 0
          }
        };

        const response = await makeRequest(`${ADMIN_API_URL}/api/public/registrations`, {
          method: 'POST',
          body: testRegistration
        });

        if (!response.success) {
          return { success: false, error: `HTTP ${response.status}: ${JSON.stringify(response.data)}` };
        }

        if (!response.data || !response.data.id || !response.data.confirmationNumber) {
          return { success: false, error: 'Missing required fields in response' };
        }

        return { 
          success: true, 
          registrationId: response.data.id,
          confirmationNumber: response.data.confirmationNumber 
        };
      }
    },
    {
      name: 'Reject Invalid Registration',
      test: async () => {
        const invalidRegistration = {
          firstName: '', // Invalid: empty
          lastName: 'Test',
          email: 'not-an-email', // Invalid: not an email
          tickets: {
            eventTickets: -1 // Invalid: negative
          }
        };

        const response = await makeRequest(`${ADMIN_API_URL}/api/public/registrations`, {
          method: 'POST',
          body: invalidRegistration
        });

        // Should return error for invalid data
        if (response.success) {
          return { success: false, error: 'Should have rejected invalid registration' };
        }

        if (response.status !== 400) {
          return { success: false, error: `Expected 400 status, got ${response.status}` };
        }

        return { success: true, validationWorking: true };
      }
    },
    {
      name: 'Lookup Registration by Email',
      test: async () => {
        // First create a registration
        const testEmail = `lookup-test-${Date.now()}@example.com`;
        const testRegistration = {
          firstName: 'Lookup',
          lastName: 'Test',
          email: testEmail,
          phone: '555-0198',
          tickets: {
            eventTickets: 1,
            banquetTickets: 0,
            hotelRooms: 0
          }
        };

        const createResponse = await makeRequest(`${ADMIN_API_URL}/api/public/registrations`, {
          method: 'POST',
          body: testRegistration
        });

        if (!createResponse.success) {
          return { success: false, error: 'Failed to create test registration' };
        }

        // Now try to find it
        const lookupResponse = await makeRequest(`${ADMIN_API_URL}/api/public/registrations?email=${encodeURIComponent(testEmail)}`);

        if (!lookupResponse.success) {
          return { success: false, error: `Lookup failed: HTTP ${lookupResponse.status}` };
        }

        if (!lookupResponse.data || lookupResponse.data.email !== testEmail) {
          return { success: false, error: 'Registration not found or email mismatch' };
        }

        return { success: true, found: true };
      }
    }
  ],

  'Volunteer System': [
    {
      name: 'Create Valid Volunteer Application',
      test: async () => {
        const testVolunteer = {
          firstName: 'Volunteer',
          lastName: 'Test',
          email: `volunteer-test-${Date.now()}@example.com`,
          phone: '555-0197',
          experience: 'This is a comprehensive test of the volunteer application system through API integration testing.',
          availability: ['morning', 'afternoon'],
          roles: ['registration', 'setup']
        };

        const response = await makeRequest(`${ADMIN_API_URL}/api/public/volunteers`, {
          method: 'POST',
          body: testVolunteer
        });

        if (!response.success) {
          return { success: false, error: `HTTP ${response.status}: ${JSON.stringify(response.data)}` };
        }

        if (!response.data || !response.data.id) {
          return { success: false, error: 'Missing volunteer ID in response' };
        }

        return { success: true, volunteerId: response.data.id };
      }
    },
    {
      name: 'Reject Invalid Volunteer Application',
      test: async () => {
        const invalidVolunteer = {
          firstName: '', // Invalid: empty
          lastName: 'Test',
          email: 'not-an-email', // Invalid: not an email
          experience: 'Short' // Invalid: too short
        };

        const response = await makeRequest(`${ADMIN_API_URL}/api/public/volunteers`, {
          method: 'POST',
          body: invalidVolunteer
        });

        // Should return error for invalid data
        if (response.success) {
          return { success: false, error: 'Should have rejected invalid volunteer application' };
        }

        return { success: true, validationWorking: true };
      }
    }
  ],

  'Performance & Security': [
    {
      name: 'Response Time Performance',
      test: async () => {
        const startTime = Date.now();
        const response = await makeRequest(`${ADMIN_API_URL}/api/health`);
        const responseTime = Date.now() - startTime;

        if (!response.success) {
          return { success: false, error: 'Health check failed' };
        }

        if (responseTime > 5000) {
          return { success: false, error: `Response too slow: ${responseTime}ms` };
        }

        return { success: true, responseTime: `${responseTime}ms` };
      }
    },
    {
      name: 'API Key Validation',
      test: async () => {
        const response = await makeRequest(`${ADMIN_API_URL}/api/public/registrations`, {
          method: 'POST',
          headers: { 'x-api-key': 'invalid-key' },
          body: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com'
          }
        });

        // Should return unauthorized/forbidden for invalid API key
        if (response.success) {
          return { success: false, error: 'Should have rejected invalid API key' };
        }

        if (![401, 403].includes(response.status)) {
          return { success: false, error: `Expected 401/403, got ${response.status}` };
        }

        return { success: true, securityWorking: true };
      }
    },
    {
      name: 'Error Handling for Non-existent Endpoints',
      test: async () => {
        const response = await makeRequest(`${ADMIN_API_URL}/api/non-existent-endpoint`);

        if (response.status !== 404) {
          return { success: false, error: `Expected 404, got ${response.status}` };
        }

        return { success: true, errorHandling: 'working' };
      }
    }
  ]
};

// Main test runner
async function runAllTests() {
  log('\n🚀 Starting Enhanced API Integration Tests\n', 'bold');
  log(`Admin API URL: ${ADMIN_API_URL}`, 'blue');
  log(`Frontend URL: ${FRONTEND_URL}`, 'blue');
  log(`API Key: ${API_KEY ? 'Configured' : 'Not configured'}`, 'blue');
  log('─'.repeat(60), 'cyan');

  for (const [suiteName, tests] of Object.entries(testSuites)) {
    log(`\n📋 ${suiteName}`, 'yellow');
    
    for (const { name, test } of tests) {
      await runTest(name, test, suiteName);
    }
  }

  // Generate test report
  const duration = Date.now() - testResults.startTime;
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'bold');
  log('='.repeat(60), 'cyan');
  log(`Total Tests: ${testResults.total}`, 'blue');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 'cyan');
  log(`Total Duration: ${duration}ms`, 'blue');
  
  // Show failed tests
  const failedTests = testResults.results.filter(r => r.status !== 'PASSED');
  if (failedTests.length > 0) {
    log('\n❌ Failed Tests:', 'red');
    failedTests.forEach(test => {
      log(`  • ${test.name}: ${test.error || 'Unknown error'}`, 'red');
    });
  }

  // Generate JSON report
  const report = {
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: (testResults.passed / testResults.total) * 100,
      duration: duration,
      timestamp: new Date().toISOString()
    },
    configuration: {
      adminApiUrl: ADMIN_API_URL,
      frontendUrl: FRONTEND_URL,
      hasApiKey: !!API_KEY
    },
    results: testResults.results
  };

  // Save report to file
  const fs = require('fs');
  const reportPath = './api-integration-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n📄 Detailed report saved to: ${reportPath}`, 'cyan');

  // Exit with appropriate code
  const exitCode = testResults.failed > 0 ? 1 : 0;
  log(`\n${exitCode === 0 ? '✅ All tests passed!' : '❌ Some tests failed'}`, exitCode === 0 ? 'green' : 'red');
  
  return exitCode;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      log(`\n💥 Test runner crashed: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testResults };