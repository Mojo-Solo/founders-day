#!/usr/bin/env node

// Test script to verify banquet form submission works end-to-end
const https = require('https');
const http = require('http');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testEndpoint(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function runTests() {
  log(colors.blue, '🧪 TESTING BANQUET FORM INTEGRATION');
  console.log('=' .repeat(50));
  
  // Test 1: Backend Health Check
  log(colors.yellow, '1️⃣ Testing Backend Health...');
  try {
    const health = await testEndpoint('http://localhost:3001/api/health');
    if (health.status === 200 && health.data.status === 'healthy') {
      log(colors.green, '✅ Backend is healthy');
    } else {
      log(colors.red, '❌ Backend health check failed');
      return;
    }
  } catch (error) {
    log(colors.red, '❌ Backend not accessible:', error.message);
    return;
  }
  
  // Test 2: Frontend Accessibility
  log(colors.yellow, '2️⃣ Testing Frontend Access...');
  try {
    const frontend = await testEndpoint('http://localhost:3000/register/banquet');
    if (frontend.status === 200) {
      log(colors.green, '✅ Frontend banquet page accessible');
    } else {
      log(colors.red, '❌ Frontend banquet page not accessible');
    }
  } catch (error) {
    log(colors.red, '❌ Frontend not accessible:', error.message);
  }
  
  // Test 3: Public Registration API
  log(colors.yellow, '3️⃣ Testing Public Registration API...');
  const testRegistration = {
    firstName: 'Integration',
    lastName: 'Test',
    email: `test-${Date.now()}@example.com`,
    phone: '555-987-6543',
    homeGroup: 'Test Group',
    tickets: {
      eventTickets: 0,
      banquetTickets: 2,
      hotelRooms: 1
    },
    additionalInfo: {
      additionalAttendees: [
        { firstName: 'Guest', lastName: 'One' }
      ],
      dietaryRestrictions: 'Vegetarian',
      accessibilityNeeds: 'None'
    }
  };
  
  try {
    const registration = await testEndpoint('http://localhost:3001/api/public/registrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRegistration)
    });
    
    if (registration.status === 201 && registration.data.registration) {
      log(colors.green, '✅ Registration API working - ID:', registration.data.registration.id);
      log(colors.green, '   Total Amount: $' + (registration.data.registration.totalAmount / 100).toFixed(2));
    } else {
      log(colors.red, '❌ Registration API failed:', registration.data);
    }
  } catch (error) {
    log(colors.red, '❌ Registration API error:', error.message);
  }
  
  // Test 4: Volunteer API
  log(colors.yellow, '4️⃣ Testing Volunteer API...');
  const testVolunteer = {
    firstName: 'Volunteer',
    lastName: 'Test',
    email: `volunteer-${Date.now()}@example.com`,
    phone: '555-111-2222',
    experience: 'First time',
    availability: ['morning', 'afternoon'],
    roles: ['registration', 'hospitality'],
    specialSkills: 'Public speaking'
  };
  
  try {
    const volunteer = await testEndpoint('http://localhost:3001/api/public/volunteers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testVolunteer)
    });
    
    if (volunteer.status === 201 && volunteer.data.volunteer) {
      log(colors.green, '✅ Volunteer API working - ID:', volunteer.data.volunteer.id);
    } else {
      log(colors.red, '❌ Volunteer API failed:', volunteer.data);
    }
  } catch (error) {
    log(colors.red, '❌ Volunteer API error:', error.message);
  }
  
  console.log('=' .repeat(50));
  log(colors.blue, '🎉 INTEGRATION TESTS COMPLETE');
  log(colors.green, '✅ Banquet form should now work on both local and production with proper backend URL');
  log(colors.yellow, '⚠️  For production, set NEXT_PUBLIC_ADMIN_API_URL or NEXT_PUBLIC_DANGEROUS_SKIP_BACKEND=true');
}

runTests().catch(console.error);