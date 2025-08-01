const fs = require('fs');
const path = require('path');

// Files to fix
const files = [
  'apps/frontend/app/api/webhooks/square/customers/route.ts',
  'apps/frontend/app/api/webhooks/square/payments/route.ts'
];

files.forEach(filePath => {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix logger calls - add metadata wrapper
  content = content.replace(
    /logger\.(info|warn|error)\(([^,]+),\s*\{([^}]+)\}\)/g,
    (match, method, message, properties) => {
      // Check if already has metadata
      if (properties.includes('metadata:')) {
        return match;
      }
      return `logger.${method}(${message}, {\n    metadata: {${properties}\n    }\n  })`;
    }
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Fixed ${filePath}`);
});

console.log('All files fixed!');