#!/bin/bash

# Fix all logger calls to use metadata wrapper in the frontend app

echo "Fixing logger metadata in webhook files..."

# Fix customer webhook
sed -i.bak 's/logger\.info(\(.*\), {$/logger.info(\1, {\n    metadata: {/g' apps/frontend/app/api/webhooks/square/customers/route.ts
sed -i.bak 's/logger\.warn(\(.*\), {$/logger.warn(\1, {\n    metadata: {/g' apps/frontend/app/api/webhooks/square/customers/route.ts
sed -i.bak 's/logger\.error(\(.*\), {$/logger.error(\1, {\n    metadata: {/g' apps/frontend/app/api/webhooks/square/customers/route.ts

# Fix closing braces
sed -i.bak '/metadata: {/{
  :a
  N
  /}\)/!ba
  s/}\)/    }\n  })/
}' apps/frontend/app/api/webhooks/square/customers/route.ts

# Fix payment webhook
sed -i.bak 's/logger\.info(\(.*\), {$/logger.info(\1, {\n    metadata: {/g' apps/frontend/app/api/webhooks/square/payments/route.ts
sed -i.bak 's/logger\.warn(\(.*\), {$/logger.warn(\1, {\n    metadata: {/g' apps/frontend/app/api/webhooks/square/payments/route.ts
sed -i.bak 's/logger\.error(\(.*\), {$/logger.error(\1, {\n    metadata: {/g' apps/frontend/app/api/webhooks/square/payments/route.ts

# Fix closing braces for payments
sed -i.bak '/metadata: {/{
  :a
  N
  /}\)/!ba
  s/}\)/    }\n  })/
}' apps/frontend/app/api/webhooks/square/payments/route.ts

# Clean up backup files
rm -f apps/frontend/app/api/webhooks/square/*.bak

echo "✅ Logger metadata fixes complete"