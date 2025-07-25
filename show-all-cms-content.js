const fetch = require('node-fetch');

async function showAllCMSContent() {
  console.log('🔍 SHOWING ALL CMS CONTENT IN DATABASE\n');
  console.log('================================================================================');
  
  try {
    const response = await fetch('http://localhost:3001/api/public/content');
    const data = await response.json();
    
    console.log(`📊 TOTAL CONTENT ITEMS: ${data.content.length}\n`);
    
    // Group by category
    const byCategory = {};
    data.content.forEach(item => {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item);
    });
    
    // Display by category
    Object.keys(byCategory).sort().forEach(category => {
      console.log(`\n📁 CATEGORY: ${category.toUpperCase()} (${byCategory[category].length} items)`);
      console.log('--------------------------------------------------------------------------------');
      
      byCategory[category].forEach(item => {
        console.log(`\n📄 ${item.title}`);
        console.log(`   Key: ${item.key}`);
        console.log(`   Type: ${item.type}`);
        console.log(`   Status: ${item.published ? '✅ Published' : '📝 Draft'}`);
        console.log(`   Content: ${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}`);
        console.log(`   Updated: ${new Date(item.updatedAt).toLocaleString()}`);
      });
    });
    
    console.log('\n================================================================================');
    console.log('✅ ALL CONTENT IS IN THE DATABASE AND ACCESSIBLE!');
    console.log('\nTo view this in a nice UI, visit: http://localhost:3001/public-content');
    console.log('To manage content (requires login), visit: http://localhost:3001/content');
    
  } catch (error) {
    console.error('❌ Error fetching content:', error.message);
  }
}

showAllCMSContent();