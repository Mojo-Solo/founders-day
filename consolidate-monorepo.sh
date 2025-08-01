#!/bin/bash

# Monorepo Consolidation Script
# This script reorganizes the current structure into a proper monorepo

set -e

echo "🚀 Starting monorepo consolidation..."

# Step 1: Create directory structure
echo "📁 Creating monorepo structure..."
mkdir -p apps
mkdir -p packages

# Step 2: Move frontend (current directory contents)
echo "📦 Moving frontend to apps/frontend..."
mkdir -p apps/frontend

# List of frontend items to move (excluding what we're creating and special dirs)
FRONTEND_ITEMS=(
    "app" "components" "contexts" "hooks" "lib" "public" "styles" "supabase" "test"
    "test-results" "test-utils" "tests" "types" "e2e" "features" "pages" "scripts"
    "src" "templates" "reports" "docs"
    "next.config.js" "next-env.d.ts" "package.json" "tsconfig.json" 
    "tailwind.config.js" "postcss.config.js" "vitest.config.ts"
    "playwright.config.ts" "middleware.ts" ".env.local" ".env.local.example"
    ".eslintrc.json" ".gitignore" ".prettierrc"
)

for item in "${FRONTEND_ITEMS[@]}"; do
    if [ -e "$item" ]; then
        echo "  Moving $item..."
        mv "$item" "apps/frontend/" 2>/dev/null || true
    fi
done

# Step 3: Move admin
echo "📦 Moving admin to apps/admin..."
if [ -d "founders-day-admin" ]; then
    mv founders-day-admin apps/admin
else
    echo "  ⚠️  Admin directory not found in expected location"
fi

# Step 4: Move shared-types
echo "📦 Moving shared-types to packages/..."
if [ -d "shared-types" ]; then
    mv shared-types packages/
else
    echo "  ⚠️  shared-types directory not found"
fi

# Step 5: Create root package.json
echo "📝 Creating root package.json..."
cat > package.json << 'EOF'
{
  "name": "founders-day",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "pnpm run --parallel dev",
    "dev:frontend": "pnpm --filter @founders-day/frontend dev",
    "dev:admin": "pnpm --filter @founders-day/admin dev",
    "build": "pnpm run --recursive build",
    "build:frontend": "pnpm --filter @founders-day/frontend build",
    "build:admin": "pnpm --filter @founders-day/admin build",
    "lint": "pnpm run --recursive lint",
    "test": "pnpm run --recursive test",
    "clean": "pnpm run --recursive clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "packageManager": "pnpm@8.15.6",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
EOF

# Step 6: Update pnpm-workspace.yaml
echo "📝 Updating pnpm-workspace.yaml..."
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# Step 7: Create root .gitignore
echo "📝 Creating root .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage
.nyc_output

# Next.js
.next/
out/
build

# Production
dist

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Local env files
.env*.local
.env

# Vercel
.vercel

# Typescript
*.tsbuildinfo
next-env.d.ts

# IDE
.idea
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
EOF

# Step 8: Update frontend package.json name
echo "📝 Updating frontend package.json..."
if [ -f "apps/frontend/package.json" ]; then
    # Update the name field to match workspace reference
    sed -i.bak 's/"name": "[^"]*"/"name": "@founders-day\/frontend"/' apps/frontend/package.json
    rm apps/frontend/package.json.bak
fi

# Step 9: Update admin package.json name
echo "📝 Updating admin package.json..."
if [ -f "apps/admin/package.json" ]; then
    # Update the name field to match workspace reference
    sed -i.bak 's/"name": "[^"]*"/"name": "@founders-day\/admin"/' apps/admin/package.json
    rm apps/admin/package.json.bak
fi

# Step 10: Create README for the monorepo
echo "📝 Creating monorepo README..."
cat > README.md << 'EOF'
# Founders Day Monorepo

This is the consolidated monorepo for the Founders Day platform, containing both the frontend and admin applications.

## Structure

```
founders-day/
├── apps/
│   ├── frontend/      # Main frontend application
│   └── admin/         # Admin dashboard
├── packages/
│   └── shared-types/  # Shared TypeScript types
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run development servers:
   ```bash
   # Run both apps
   pnpm dev

   # Run specific app
   pnpm dev:frontend
   pnpm dev:admin
   ```

3. Build for production:
   ```bash
   # Build all apps
   pnpm build

   # Build specific app
   pnpm build:frontend
   pnpm build:admin
   ```

## Deployment

Both applications are deployed via Vercel:
- Frontend: Set root directory to `apps/frontend`
- Admin: Set root directory to `apps/admin`

## Development

- Frontend: http://localhost:3000
- Admin: http://localhost:3001 (or configured port)
EOF

echo "✅ Monorepo consolidation complete!"
echo ""
echo "Next steps:"
echo "1. Update import paths for shared-types in both apps"
echo "2. Run 'pnpm install' to link workspaces"
echo "3. Test both applications"
echo "4. Configure Vercel deployments"
echo "5. Push to repository"