const fs = require('fs');

// Fix webhook enqueue calls
const files = [
  'apps/frontend/app/api/webhooks/square/customers/route.ts',
  'apps/frontend/app/api/webhooks/square/payments/route.ts'
];

files.forEach(file => {
  console.log(`Fixing ${file}...`);
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix enqueue calls - convert from object to individual parameters
  content = content.replace(
    /await webhookQueue\.enqueue\({[\s\S]*?}\)/g,
    (match) => {
      // Extract values from the object
      const idMatch = match.match(/id:\s*([^,]+),/);
      const typeMatch = match.match(/type:\s*([^,]+),/);
      const dataMatch = match.match(/data:\s*([^,]+),/);
      const priorityMatch = match.match(/priority:\s*([^,]+),/);
      
      const id = idMatch ? idMatch[1].trim() : 'eventData.event_id || `${Date.now()}`';
      const type = typeMatch ? typeMatch[1].trim() : 'eventType';
      const data = dataMatch ? dataMatch[1].trim() : 'eventData';
      const priority = priorityMatch ? priorityMatch[1].trim() : 'WebhookPriority.NORMAL';
      
      // Extract just the event ID part
      const eventId = id.includes('||') ? id.split('||')[0].trim() : id;
      
      return `await webhookQueue.enqueue(${eventId}, ${type}, ${data}, ${priority})`;
    }
  );
  
  fs.writeFileSync(file, content);
  console.log(`✅ Fixed ${file}`);
});

console.log('Done!');