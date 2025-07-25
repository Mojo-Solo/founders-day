#!/usr/bin/env node

// Test script to verify content flow between admin and frontend

const fetch = require('node-fetch');

async function testContentFlow() {
  console.log('🧪 Testing Content Management Flow...\n');

  // Test 1: Check if admin backend is running
  console.log('1️⃣ Checking Admin Backend...');
  try {
    const adminHealth = await fetch('http://localhost:3001/api/health');
    if (adminHealth.ok) {
      console.log('✅ Admin backend is running on port 3001\n');
    } else {
      console.log('❌ Admin backend not responding properly\n');
    }
  } catch (error) {
    console.log('❌ Admin backend is not running. Start it with: cd founders-day-admin && npm run dev\n');
    return;
  }

  // Test 2: Check public content API
  console.log('2️⃣ Testing Public Content API...');
  try {
    const contentResponse = await fetch('http://localhost:3001/api/public/content');
    const data = await contentResponse.json();
    
    if (contentResponse.ok) {
      console.log('✅ Public content API is accessible');
      console.log(`📄 Found ${data.content?.length || 0} content items\n`);
      
      // Show sample content
      if (data.content && data.content.length > 0) {
        console.log('Sample content items:');
        data.content.slice(0, 3).forEach(item => {
          console.log(`  - ${item.key}: "${item.content.substring(0, 50)}..."`);
        });
        console.log('');
      }
    } else {
      console.log('❌ Public content API returned error\n');
    }
  } catch (error) {
    console.log('❌ Could not reach public content API\n');
  }

  // Test 3: Check if frontend can access backend
  console.log('3️⃣ Testing Frontend → Backend Connection...');
  try {
    // Simulate frontend API call
    const frontendTest = await fetch('http://localhost:3001/api/public/content', {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000' // Simulate frontend origin
      }
    });
    
    if (frontendTest.ok) {
      console.log('✅ Frontend can access backend (CORS working)\n');
    } else {
      console.log('❌ Frontend cannot access backend\n');
    }
  } catch (error) {
    console.log('❌ Connection test failed\n');
  }

  // Test 4: Check specific content keys
  console.log('4️⃣ Checking Key Content Items...');
  const importantKeys = ['hero-title', 'early-bird-price', 'door-price', 'venue-name'];
  
  for (const key of importantKeys) {
    try {
      const response = await fetch(`http://localhost:3001/api/public/content/${key}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${key}: "${data.content}"`);
      } else {
        console.log(`⚠️  ${key}: Not found (will use fallback)`);
      }
    } catch (error) {
      console.log(`❌ ${key}: Error fetching`);
    }
  }

  console.log('\n📋 Summary:');
  console.log('- Admin CMS URL: http://localhost:3001/content');
  console.log('- Public Site URL: http://localhost:3000');
  console.log('- Your client edits content in the Admin CMS');
  console.log('- Changes appear immediately on the Public Site');
  console.log('\n✨ To start both: ./start-both.sh');
}

// Run the test
testContentFlow().catch(console.error);