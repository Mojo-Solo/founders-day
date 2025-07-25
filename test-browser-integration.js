const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Testing Frontend-Backend Integration in Browser...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text()
    });
  });
  
  // Capture network errors
  const networkErrors = [];
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure()
    });
  });
  
  // Navigate to frontend
  console.log('📱 Loading Frontend...');
  await page.goto('http://localhost:3000', { 
    waitUntil: 'networkidle0',
    timeout: 30000 
  });
  
  // Wait a bit for any async operations
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check page content
  const pageContent = await page.content();
  const hasLoadingScreen = pageContent.includes('Loading event details');
  const hasContent = pageContent.includes('Founders Day Minnesota');
  const hasAPIUrl = pageContent.includes('http://localhost:3001');
  
  console.log('\n📊 Page Analysis:');
  console.log(`- Loading screen visible: ${hasLoadingScreen ? '❌ YES' : '✅ NO'}`);
  console.log(`- Main content visible: ${hasContent ? '✅ YES' : '❌ NO'}`);
  console.log(`- API URL referenced: ${hasAPIUrl ? '✅ YES' : '❌ NO'}`);
  
  console.log('\n🖥️  Console Logs:');
  consoleLogs.forEach(log => {
    if (log.text.includes('[API]') || log.text.includes('[Frontend]') || log.text.includes('error')) {
      console.log(`${log.type}: ${log.text}`);
    }
  });
  
  if (networkErrors.length > 0) {
    console.log('\n❌ Network Errors:');
    networkErrors.forEach(error => {
      console.log(`- ${error.url}: ${error.failure.errorText}`);
    });
  }
  
  // Check if isLoading state
  const isLoading = await page.evaluate(() => {
    // Try to check React state if possible
    const rootElement = document.querySelector('#__next');
    return rootElement && rootElement.innerHTML.includes('Loading event details');
  });
  
  console.log('\n🎯 Integration Status:');
  if (!isLoading && hasContent) {
    console.log('✅ INTEGRATION WORKING! Frontend successfully loads content from backend.');
  } else if (isLoading && hasContent) {
    console.log('⚠️  PARTIAL INTEGRATION: Content exists but loading state persists.');
  } else {
    console.log('❌ INTEGRATION BROKEN: Frontend cannot load content from backend.');
  }
  
  await browser.close();
})();