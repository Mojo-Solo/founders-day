const fetch = require('node-fetch');

async function testCriticalIntegration() {
  console.log('🔍 TESTING CRITICAL FRONTEND-BACKEND INTEGRATION\n');
  
  const tests = {
    passed: 0,
    failed: 0,
    critical: []
  };
  
  // Test 1: Backend API Health
  console.log('1️⃣ Testing Backend API Health...');
  try {
    const healthRes = await fetch('http://localhost:3001/api/health');
    if (healthRes.ok) {
      console.log('✅ Backend API is healthy\n');
      tests.passed++;
    } else {
      console.log('❌ Backend API health check failed\n');
      tests.failed++;
      tests.critical.push('Backend health check');
    }
  } catch (error) {
    console.log('❌ Cannot reach backend API\n');
    tests.failed++;
    tests.critical.push('Backend connectivity');
  }
  
  // Test 2: Content API
  console.log('2️⃣ Testing Content Management API...');
  try {
    const contentRes = await fetch('http://localhost:3001/api/public/content');
    const contentData = await contentRes.json();
    
    if (contentRes.ok && contentData.content && contentData.content.length > 0) {
      console.log(`✅ Content API working - ${contentData.content.length} items loaded`);
      
      // Check for critical content
      const hasHeroTitle = contentData.content.some(c => c.key === 'hero-title');
      const hasPricing = contentData.content.some(c => c.key === 'registration-pricing');
      
      console.log(`   - Hero title: ${hasHeroTitle ? '✅' : '❌'}`);
      console.log(`   - Pricing data: ${hasPricing ? '✅' : '❌'}\n`);
      
      tests.passed++;
    } else {
      console.log('❌ Content API not returning data\n');
      tests.failed++;
      tests.critical.push('Content API');
    }
  } catch (error) {
    console.log('❌ Content API error:', error.message, '\n');
    tests.failed++;
    tests.critical.push('Content API connectivity');
  }
  
  // Test 3: Frontend Loading
  console.log('3️⃣ Testing Frontend Content Loading...');
  try {
    const frontendRes = await fetch('http://localhost:3000');
    const frontendHTML = await frontendRes.text();
    
    const hasContent = frontendHTML.includes('Founders Day Minnesota');
    const hasLoadingState = frontendHTML.includes('Loading event details');
    const hasReactRoot = frontendHTML.includes('__next');
    
    console.log(`   - React app loaded: ${hasReactRoot ? '✅' : '❌'}`);
    console.log(`   - Has content: ${hasContent ? '✅' : '❌'}`);
    console.log(`   - Still loading: ${hasLoadingState ? '❌ YES' : '✅ NO'}\n`);
    
    if (hasReactRoot && hasContent && !hasLoadingState) {
      tests.passed++;
    } else {
      tests.failed++;
      tests.critical.push('Frontend content loading');
    }
  } catch (error) {
    console.log('❌ Frontend not accessible\n');
    tests.failed++;
    tests.critical.push('Frontend accessibility');
  }
  
  // Test 4: CORS Headers
  console.log('4️⃣ Testing CORS Configuration...');
  try {
    const corsRes = await fetch('http://localhost:3001/api/public/content', {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    
    const corsHeader = corsRes.headers.get('access-control-allow-origin');
    if (corsHeader) {
      console.log(`✅ CORS configured: ${corsHeader}\n`);
      tests.passed++;
    } else {
      console.log('❌ CORS headers missing\n');
      tests.failed++;
      tests.critical.push('CORS configuration');
    }
  } catch (error) {
    console.log('❌ CORS test failed\n');
    tests.failed++;
    tests.critical.push('CORS test');
  }
  
  // Test 5: Dynamic Pricing
  console.log('5️⃣ Testing Dynamic Pricing Integration...');
  try {
    const contentRes = await fetch('http://localhost:3001/api/public/content');
    const contentData = await contentRes.json();
    
    const pricingItem = contentData.content?.find(c => c.key === 'registration-pricing');
    if (pricingItem) {
      const pricing = JSON.parse(pricingItem.content);
      console.log(`✅ Dynamic pricing loaded: $${pricing.event.price} for event ticket\n`);
      tests.passed++;
    } else {
      console.log('❌ No pricing data found\n');
      tests.failed++;
      tests.critical.push('Dynamic pricing');
    }
  } catch (error) {
    console.log('❌ Pricing test failed\n');
    tests.failed++;
    tests.critical.push('Pricing data');
  }
  
  // Final Report
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 CRITICAL INTEGRATION TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Tests: ${tests.passed + tests.failed}`);
  console.log(`✅ Passed: ${tests.passed}`);
  console.log(`❌ Failed: ${tests.failed}`);
  console.log(`Success Rate: ${Math.round((tests.passed / (tests.passed + tests.failed)) * 100)}%`);
  
  if (tests.critical.length > 0) {
    console.log('\n🚨 CRITICAL FAILURES:');
    tests.critical.forEach(issue => console.log(`   - ${issue}`));
  }
  
  if (tests.passed === 5) {
    console.log('\n✅ ALL CRITICAL INTEGRATIONS WORKING 100%!');
    console.log('The system is ready for production use.');
  } else {
    console.log('\n⚠️  Some integrations need attention.');
  }
}

testCriticalIntegration();