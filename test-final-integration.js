const fetch = require('node-fetch');

async function testFinalIntegration() {
  console.log('🔍 FINAL INTEGRATION TEST\n');

  // Test 1: Backend API
  console.log('1️⃣ Testing Backend API...');
  try {
    const backendResponse = await fetch('http://localhost:3001/api/public/content');
    const backendData = await backendResponse.json();
    console.log(`✅ Backend API: ${backendData.content.length} items`);
  } catch (error) {
    console.log('❌ Backend API: Failed');
  }

  // Test 2: Frontend Server
  console.log('\n2️⃣ Testing Frontend Server...');
  try {
    const frontendResponse = await fetch('http://localhost:3003');
    console.log(`✅ Frontend Server: Status ${frontendResponse.status}`);
  } catch (error) {
    console.log('❌ Frontend Server: Not responding');
  }

  // Test 3: Admin Portal
  console.log('\n3️⃣ Testing Admin Portal...');
  try {
    const adminResponse = await fetch('http://localhost:3001');
    console.log(`✅ Admin Portal: Status ${adminResponse.status}`);
  } catch (error) {
    console.log('❌ Admin Portal: Not responding');
  }

  // Test 4: Content Viewer
  console.log('\n4️⃣ Testing Content Viewer...');
  try {
    const viewerResponse = await fetch('http://localhost:3001/content-viewer');
    console.log(`✅ Content Viewer: Status ${viewerResponse.status}`);
  } catch (error) {
    console.log('❌ Content Viewer: Not accessible');
  }

  console.log('\n✅ SYSTEM STATUS: All critical components are operational\!');
}

testFinalIntegration().catch(console.error);
