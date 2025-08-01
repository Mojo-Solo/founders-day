const fs = require('fs');
const path = require('path');

console.log('=== FOUNDERS DAY SQUARE PAYMENT INTEGRATION ANALYSIS ===\n');

// Check package.json
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`Project: ${packageJson.name}`);
  console.log(`Version: ${packageJson.version}`);
  
  // Check for payment-related dependencies
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const paymentDeps = Object.keys(allDeps).filter(dep => 
    ['square', 'payment', 'stripe', 'checkout', 'axios', 'react-hook-form'].some(keyword => 
      dep.toLowerCase().includes(keyword)
    )
  );
  
  if (paymentDeps.length > 0) {
    console.log('\n=== RELEVANT DEPENDENCIES ===');
    paymentDeps.forEach(dep => {
      console.log(`  ${dep}: ${allDeps[dep]}`);
    });
  }
} catch (error) {
  console.log('No package.json found or error reading it');
}

// Check directory structure
console.log('\n=== PROJECT STRUCTURE ===');
function listDir(dirPath, indent = 0) {
  try {
    const items = fs.readdirSync(dirPath).filter(item => 
      !item.startsWith('.') && item !== 'node_modules'
    ).sort();
    
    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);
      const prefix = '  '.repeat(indent);
      
      if (stats.isDirectory()) {
        console.log(`${prefix}📁 ${item}/`);
        if (indent < 2) {
          listDir(fullPath, indent + 1);
        }
      } else if (item.includes('square') || item.includes('payment') || item.includes('checkout')) {
        console.log(`${prefix}📄 ${item} (PAYMENT RELATED)`);
      } else if (indent <= 1 && (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx'))) {
        console.log(`${prefix}📄 ${item}`);
      }
    });
  } catch (error) {
    // Skip directories we can't read
  }
}

listDir('.');

// Look for specific files that might contain Square integration
console.log('\n=== SEARCHING FOR SQUARE/PAYMENT FILES ===');
function findPaymentFiles(dirPath, results = []) {
  try {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      if (item.startsWith('.') || item === 'node_modules') return;
      
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        findPaymentFiles(fullPath, results);
      } else if (item.match(/\.(ts|tsx|js|jsx|json)$/)) {
        const lowerItem = item.toLowerCase();
        if (['square', 'payment', 'checkout', 'billing', 'order', 'customer'].some(keyword => 
            lowerItem.includes(keyword) || fullPath.toLowerCase().includes(keyword)
        )) {
          results.push(fullPath);
        }
      }
    });
  } catch (error) {
    // Skip directories we can't read
  }
  
  return results;
}

const paymentFiles = findPaymentFiles('.');
paymentFiles.forEach(file => {
  console.log(`  📄 ${file}`);
});

console.log(`\nFound ${paymentFiles.length} payment-related files`);