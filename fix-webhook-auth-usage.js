const fs = require('fs');

// Fix webhook auth usage in both files
const files = [
  'apps/frontend/app/api/webhooks/square/customers/route.ts',
  'apps/frontend/app/api/webhooks/square/payments/route.ts'
];

files.forEach(file => {
  console.log(`Fixing ${file}...`);
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix error property reference (remove it)
  content = content.replace(
    /error: authResult\.error,/g,
    ''
  );
  
  // Fix data property reference to parsedBody
  content = content.replace(
    /const eventData = authResult\.data/g,
    'const eventData = authResult.parsedBody'
  );
  
  fs.writeFileSync(file, content);
  console.log(`✅ Fixed ${file}`);
});

console.log('Done!');