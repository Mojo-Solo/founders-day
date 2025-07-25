const http = require('http');

function fetchAndCheck(url, checkFor) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const hasLoading = data.includes('Loading event details');
        const hasContent = data.includes(checkFor);
        const hasSkeletons = data.includes('animate-pulse');
        
        console.log(`\n${url}:`);
        console.log(`- Has loading screen: ${hasLoading}`);
        console.log(`- Has content "${checkFor}": ${hasContent}`);
        console.log(`- Has loading skeletons: ${hasSkeletons}`);
        
        // Check for actual content in the HTML
        if (hasContent && !hasLoading) {
          console.log('✅ Frontend is displaying content properly!');
        } else if (hasLoading || hasSkeletons) {
          console.log('⚠️  Frontend is still showing loading state');
        }
        
        resolve({ hasLoading, hasContent, hasSkeletons });
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('🧪 Testing Frontend Content Loading...\n');
  
  // First check backend
  console.log('1️⃣ Checking Backend API...');
  await fetchAndCheck('http://localhost:3001/api/public/content', 'hero-title');
  
  // Then check frontend
  console.log('\n2️⃣ Checking Frontend Page...');
  await fetchAndCheck('http://localhost:3000', 'Founders Day Minnesota');
  
  console.log('\n📊 Summary:');
  console.log('If frontend shows loading state, the API integration is not working.');
  console.log('If frontend shows content, the integration is fixed!');
}

test().catch(console.error);