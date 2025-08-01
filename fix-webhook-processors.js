const fs = require('fs');

// Fix webhook processor registrations in customer and payment routes
const files = [
  'apps/frontend/app/api/webhooks/square/customers/route.ts',
  'apps/frontend/app/api/webhooks/square/payments/route.ts'
];

files.forEach(file => {
  console.log(`Fixing ${file}...`);
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the registerProcessor calls with the correct format
  content = content.replace(
    /webhookQueue\.registerProcessor\({[\s\S]*?}\)/g,
    (match) => {
      // Extract the function name from the match
      const processMatch = match.match(/process:\s*(\w+)/);
      const processFunc = processMatch ? processMatch[1] : 'processWebhook';
      
      // Extract event types
      const eventTypesMatch = match.match(/eventTypes:\s*Object\.keys\((\w+)\)/);
      const eventTypes = eventTypesMatch ? eventTypesMatch[1] : 'EVENT_PRIORITIES';
      
      // Create individual processors for each event type
      return `// Register webhook processors for each event type
Object.entries(${eventTypes}).forEach(([eventType, priority]) => {
  webhookQueue.registerProcessor({
    eventType,
    handler: ${processFunc},
    priority: priority as WebhookPriority,
    maxAttempts: 3,
    retryDelayMs: 5000
  })
})`;
    }
  );
  
  fs.writeFileSync(file, content);
  console.log(`✅ Fixed ${file}`);
});

console.log('Done!');