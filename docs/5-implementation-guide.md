# Implementation Guide
## Founders Day Square Payment Integration

### Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Square Configuration](#square-configuration)
5. [Application Installation](#application-installation)
6. [Development Workflow](#development-workflow)
7. [Testing Setup](#testing-setup)
8. [Deployment Guide](#deployment-guide)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
```bash
# Required Software
Node.js >= 18.0.0
npm >= 9.0.0 (or yarn >= 3.0.0)
PostgreSQL >= 15.0
Git >= 2.30.0

# Optional but Recommended
Docker >= 20.10.0
Docker Compose >= 2.0.0
```

### Development Tools
```bash
# Global installations
npm install -g @next/cli
npm install -g prisma
npm install -g typescript
npm install -g eslint

# Optional global tools
npm install -g storybook
npm install -g jest-cli
npm install -g @storybook/cli
```

### Square Account Requirements
- Square Developer Account
- Application created in Square Developer Console
- Production and Sandbox credentials
- Webhook endpoints configured
- OAuth permissions set up (if using OAuth)

---

## Environment Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/founders-day-frontend.git
cd founders-day-frontend

# Checkout main branch
git checkout main

# Create and switch to development branch
git checkout -b development
```

### 2. Environment Variables

Create environment files for different environments:

```bash
# .env.local (Development)
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/founders_day_dev"
DIRECT_URL="postgresql://username:password@localhost:5432/founders_day_dev"

# Square Configuration
SQUARE_APPLICATION_ID="sq0idp-YOUR_SANDBOX_APP_ID"
SQUARE_ACCESS_TOKEN="EAAAEL_YOUR_SANDBOX_ACCESS_TOKEN"
SQUARE_LOCATION_ID="YOUR_SANDBOX_LOCATION_ID"
SQUARE_WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET"
SQUARE_ENVIRONMENT="sandbox"

# NextJS Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key"

# API Configuration
API_BASE_URL="http://localhost:3000/api"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"

# Redis (Optional for caching)
REDIS_URL="redis://localhost:6379"

# Email Service (SendGrid)
SENDGRID_API_KEY="SG.your-sendgrid-api-key"
FROM_EMAIL="noreply@foundersday.com"

# File Storage (Cloudinary)
CLOUDINARY_URL="cloudinary://api_key:api_secret@cloud_name"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"

# Security
JWT_SECRET="your-jwt-secret-key"
ENCRYPTION_KEY="your-32-character-encryption-key"

# Monitoring (Optional)
SENTRY_DSN="https://your-sentry-dsn"
NEW_RELIC_LICENSE_KEY="your-new-relic-key"

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_WISHLIST=true
```

```bash
# .env.production (Production)
# Database
DATABASE_URL="postgresql://username:password@your-db-host:5432/founders_day_prod"
DIRECT_URL="postgresql://username:password@your-db-host:5432/founders_day_prod"

# Square Configuration (Production)
SQUARE_APPLICATION_ID="sq0idp-YOUR_PRODUCTION_APP_ID"
SQUARE_ACCESS_TOKEN="EAAAEL_YOUR_PRODUCTION_ACCESS_TOKEN"
SQUARE_LOCATION_ID="YOUR_PRODUCTION_LOCATION_ID"
SQUARE_WEBHOOK_SECRET="YOUR_PRODUCTION_WEBHOOK_SECRET"
SQUARE_ENVIRONMENT="production"

# Production URLs
NEXTAUTH_URL="https://yourdomain.com"
API_BASE_URL="https://yourdomain.com/api"
NEXT_PUBLIC_API_URL="https://yourdomain.com/api"

# Production services...
```

### 3. Development Dependencies

```bash
# Install dependencies
npm install

# Or with yarn
yarn install

# Install development dependencies
npm install --save-dev @types/node @types/react @types/react-dom
npm install --save-dev eslint prettier husky lint-staged
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev playwright @playwright/test
```

---

## Database Setup

### 1. PostgreSQL Installation

#### Option A: Local Installation
```bash
# macOS (using Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15 postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE founders_day_dev;
CREATE USER founders_day_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE founders_day_dev TO founders_day_user;
\q
```

#### Option B: Docker Setup
```bash
# Create docker-compose.yml for development database
cat > docker-compose.dev.yml << EOF
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: founders_day_dev
      POSTGRES_USER: founders_day_user
      POSTGRES_PASSWORD: your_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: postgres -c log_statement=all

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
EOF

# Start services
docker-compose -f docker-compose.dev.yml up -d
```

#### Option C: Neon (Serverless PostgreSQL)
```bash
# Sign up at https://neon.tech
# Create a new project
# Get connection string from dashboard
# Add to .env.local as DATABASE_URL
```

### 2. Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed database with initial data
npx prisma db seed

# View database in Prisma Studio
npx prisma studio
```

### 3. Prisma Schema Setup

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// Include all models from database documentation
// (Models already defined in database schema documentation)
```

### 4. Database Seeding

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@foundersday.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@foundersday.com',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: adminPassword,
      role: 'admin',
      permissions: {
        orders: ['read', 'write', 'delete'],
        products: ['read', 'write', 'delete'],
        customers: ['read', 'write'],
        analytics: ['read']
      },
      isActive: true,
    },
  });

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'electronics' },
      update: {},
      create: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices and accessories',
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'clothing' },
      update: {},
      create: {
        name: 'Clothing',
        slug: 'clothing',
        description: 'Apparel and fashion items',
        isActive: true,
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'books' },
      update: {},
      create: {
        name: 'Books',
        slug: 'books',
        description: 'Books and publications',
        isActive: true,
        sortOrder: 3,
      },
    }),
  ]);

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Wireless Headphones',
        slug: 'wireless-headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        shortDescription: 'Premium wireless headphones',
        price: 199.99,
        compareAtPrice: 249.99,
        currency: 'USD',
        sku: 'WH-001',
        stockQuantity: 50,
        categoryId: categories[0].id,
        isActive: true,
        isFeatured: true,
        seoTitle: 'Wireless Headphones - Premium Audio',
        seoDescription: 'Experience premium audio quality with our wireless headphones',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Cotton T-Shirt',
        slug: 'cotton-t-shirt',
        description: '100% organic cotton t-shirt in various colors',
        shortDescription: 'Comfortable organic cotton tee',
        price: 29.99,
        currency: 'USD',
        sku: 'TS-001',
        stockQuantity: 100,
        categoryId: categories[1].id,
        isActive: true,
        seoTitle: 'Organic Cotton T-Shirt',
        seoDescription: 'Sustainable and comfortable cotton t-shirts',
      },
    }),
  ]);

  // Create sample customer
  const customerPassword = await bcrypt.hash('customer123', 12);
  const customer = await prisma.customer.create({
    data: {
      email: 'customer@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      passwordHash: customerPassword,
      emailVerified: true,
      isActive: true,
    },
  });

  console.log('Database seeded successfully!');
  console.log(`Admin user: admin@foundersday.com / admin123`);
  console.log(`Customer user: customer@example.com / customer123`);
  console.log(`Created ${categories.length} categories and ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Square Configuration

### 1. Square Developer Account Setup

1. **Create Square Developer Account**
   - Visit [developer.squareup.com](https://developer.squareup.com)
   - Sign up or log in with existing Square account
   - Verify your email address

2. **Create New Application**
   ```bash
   # In Square Developer Console:
   # 1. Click "Create your first application"
   # 2. Enter application name: "Founders Day E-commerce"
   # 3. Select application type: "Custom Application"
   # 4. Click "Create Application"
   ```

3. **Configure Application Settings**
   ```bash
   # Application Settings:
   Application Name: Founders Day E-commerce
   Application Type: Custom Application
   
   # OAuth Settings:
   Redirect URL: https://yourdomain.com/auth/square/callback
   
   # Webhook Settings:
   Notification URL: https://yourdomain.com/api/webhooks/square
   API Version: 2023-10-18 (latest)
   
   # Permissions:
   ✓ PAYMENTS_READ
   ✓ PAYMENTS_WRITE
   ✓ ORDERS_READ
   ✓ ORDERS_WRITE
   ✓ CUSTOMERS_READ
   ✓ CUSTOMERS_WRITE
   ✓ ITEMS_READ
   ✓ ITEMS_WRITE
   ```

### 2. Get Square Credentials

```bash
# From Square Developer Console, copy:

# Sandbox Credentials
SQUARE_APPLICATION_ID_SANDBOX="sq0idp-..."
SQUARE_ACCESS_TOKEN_SANDBOX="EAAAELq..."
SQUARE_LOCATION_ID_SANDBOX="L7H..."

# Production Credentials (after app approval)
SQUARE_APPLICATION_ID_PRODUCTION="sq0idp-..."
SQUARE_ACCESS_TOKEN_PRODUCTION="EAAAELq..."
SQUARE_LOCATION_ID_PRODUCTION="L8P..."

# Webhook Secret (generate in console)
SQUARE_WEBHOOK_SECRET="your_webhook_secret_here"
```

### 3. Configure Webhooks

```bash
# In Square Developer Console > Webhooks:
# 1. Add webhook endpoint: https://yourdomain.com/api/webhooks/square
# 2. Select events to subscribe to:
#    - payment.updated
#    - order.updated
#    - order.fulfilled
#    - customer.created
#    - customer.updated
# 3. Generate and copy webhook signature key
```

### 4. Test Square Integration

```typescript
// scripts/test-square.ts
import { Client, Environment } from 'square';

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' 
    ? Environment.Production 
    : Environment.Sandbox
});

async function testSquareConnection() {
  try {
    // Test locations API
    const locationsResponse = await client.locationsApi.listLocations();
    console.log('✓ Connected to Square API');
    console.log('Locations:', locationsResponse.result.locations?.map(l => l.name));

    // Test payments API
    const paymentsResponse = await client.paymentsApi.listPayments();
    console.log('✓ Payments API accessible');

    // Test customers API
    const customersResponse = await client.customersApi.listCustomers();
    console.log('✓ Customers API accessible');

    console.log('Square integration test passed!');
  } catch (error) {
    console.error('Square integration test failed:', error);
  }
}

testSquareConnection();
```

```bash
# Run Square integration test
npx ts-node scripts/test-square.ts
```

---

## Application Installation

### 1. Install Dependencies

```bash
# Install all dependencies
npm install

# Core dependencies
npm install next react react-dom typescript
npm install @prisma/client prisma
npm install square
npm install bcryptjs jsonwebtoken
npm install zod react-hook-form @hookform/resolvers
npm install @tanstack/react-query
npm install framer-motion
npm install tailwindcss @tailwindcss/forms @tailwindcss/typography
npm install @headlessui/react @heroicons/react
npm install class-variance-authority clsx tailwind-merge

# Development dependencies
npm install --save-dev @types/node @types/react @types/react-dom
npm install --save-dev @types/bcryptjs @types/jsonwebtoken
npm install --save-dev eslint @typescript-eslint/eslint-plugin
npm install --save-dev prettier eslint-config-prettier
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev @playwright/test
npm install --save-dev husky lint-staged
```

### 2. Configure Build Tools

#### Tailwind CSS Configuration
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdedd6',
          500: '#f97316',
          600: '#ea580c',
          900: '#9a3412',
        },
        // ... other colors from design system
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};

export default config;
```

#### Next.js Configuration
```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Image optimization
  images: {
    domains: ['res.cloudinary.com', 'images.squareup.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Environment variables
  env: {
    SQUARE_APPLICATION_ID: process.env.SQUARE_APPLICATION_ID,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/dashboard',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
```

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"],
      "@/utils/*": ["./src/utils/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3. Project Structure Setup

```bash
# Create project structure
mkdir -p src/{components,hooks,lib,types,utils}
mkdir -p src/components/{common,payment,product,cart,customer,admin,layout}
mkdir -p pages/{api,auth,products,orders,admin}
mkdir -p public/{images,icons}
mkdir -p docs
mkdir -p scripts
mkdir -p __tests__

# Create initial files
touch src/lib/prisma.ts
touch src/lib/square.ts
touch src/lib/auth.ts
touch src/types/index.ts
touch src/utils/currency.ts
touch src/utils/validation.ts
```

### 4. Core Configuration Files

#### Prisma Client Setup
```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### Square Client Setup
```typescript
// src/lib/square.ts
import { Client, Environment } from 'square';

const environment = process.env.SQUARE_ENVIRONMENT === 'production'
  ? Environment.Production
  : Environment.Sandbox;

export const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment,
});

export const {
  paymentsApi,
  ordersApi,
  customersApi,
  catalogApi,
  locationsApi,
} = squareClient;
```

---

## Development Workflow

### 1. Start Development Server

```bash
# Start development server
npm run dev

# Or with specific port
npm run dev -- --port 3001

# Start with environment
NODE_ENV=development npm run dev
```

### 2. Database Development Workflow

```bash
# Make schema changes
# Edit prisma/schema.prisma

# Generate migration
npx prisma migrate dev --name add_new_field

# Reset database (development only)
npx prisma migrate reset

# Push schema changes without migration
npx prisma db push

# Generate Prisma client
npx prisma generate

# View database
npx prisma studio
```

### 3. Git Workflow

```bash
# Feature branch workflow
git checkout -b feature/payment-integration
git add .
git commit -m "feat: add Square payment integration"
git push origin feature/payment-integration

# Create pull request via GitHub/GitLab
# After review and approval, merge to main
```

### 4. Code Quality Checks

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check

# Run all checks
npm run check-all
```

#### Package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit",
    "check-all": "npm run lint && npm run type-check && npm run test",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "playwright test",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "db:seed": "prisma db seed",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

---

## Testing Setup

### 1. Unit Testing Configuration

#### Jest Configuration
```typescript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

#### Jest Setup
```typescript
// jest.setup.js
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Square Web SDK
Object.defineProperty(window, 'Square', {
  value: {
    payments: jest.fn(() => ({
      card: jest.fn(() => ({
        attach: jest.fn(),
        tokenize: jest.fn(() => Promise.resolve({ token: 'mock-token' })),
      })),
    })),
  },
});
```

### 2. E2E Testing with Playwright

#### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### Sample E2E Test
```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('complete purchase flow', async ({ page }) => {
    // Navigate to product page
    await page.goto('/products/wireless-headphones');
    
    // Add to cart
    await page.click('[data-testid="add-to-cart"]');
    
    // Open cart
    await page.click('[data-testid="cart-icon"]');
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible();
    
    // Proceed to checkout
    await page.click('[data-testid="checkout-button"]');
    
    // Fill shipping information
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="email"]', 'john@example.com');
    await page.fill('[name="address"]', '123 Main St');
    await page.fill('[name="city"]', 'New York');
    await page.fill('[name="state"]', 'NY');
    await page.fill('[name="postalCode"]', '10001');
    
    // Continue to payment
    await page.click('[data-testid="continue-to-payment"]');
    
    // Fill payment information (using test card)
    await page.fill('[name="cardNumber"]', '4532015112830366');
    await page.fill('[name="expiryDate"]', '12/25');
    await page.fill('[name="cvv"]', '123');
    await page.fill('[name="cardholderName"]', 'John Doe');
    
    // Submit payment
    await page.click('[data-testid="submit-payment"]');
    
    // Verify success
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
    await expect(page.locator('text=Order Confirmed')).toBeVisible();
  });
});
```

### 3. Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- components/PaymentForm.test.tsx

# Run Playwright tests in UI mode
npx playwright test --ui
```

---

## Deployment Guide

### 1. Build Process

```bash
# Production build
npm run build

# Test production build locally
npm run start

# Analyze bundle
npm run analyze
```

### 2. Environment-Specific Deployments

#### Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Set environment variables
vercel env add SQUARE_ACCESS_TOKEN
vercel env add DATABASE_URL
# ... add all environment variables
```

#### Docker Deployment
```dockerfile
# Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["npm", "start"]
```

```bash
# Build Docker image
docker build -t founders-day-frontend .

# Run container
docker run -p 3000:3000 --env-file .env.production founders-day-frontend
```

#### AWS Amplify Deployment
```yaml
# amplify.yml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
        - npx prisma generate
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### 3. Database Migration in Production

```bash
# Production database migration
npx prisma migrate deploy

# OR using Docker
docker run --rm \
  -e DATABASE_URL="$PROD_DATABASE_URL" \
  your-app-image \
  npx prisma migrate deploy
```

### 4. Post-Deployment Checks

```bash
# Health check script
curl -f https://yourdomain.com/api/health || exit 1

# Database connectivity check
curl -f https://yourdomain.com/api/health/db || exit 1

# Square integration check
curl -f https://yourdomain.com/api/health/square || exit 1
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Issues
```bash
# Error: Can't connect to database
# Solution: Check connection string and network access

# Debug connection
npx prisma db pull

# Test with direct connection
psql $DATABASE_URL

# Check firewall and security groups
```

#### 2. Square API Issues
```bash
# Error: Square API authentication failed
# Solution: Verify credentials and environment

# Debug Square connection
node -e "
const { Client, Environment } = require('square');
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox
});
client.locationsApi.listLocations()
  .then(r => console.log('Success:', r.result.locations))
  .catch(e => console.error('Error:', e));
"
```

#### 3. Payment Processing Issues
```bash
# Error: Payment failed or declined
# Solutions:
# 1. Check test card numbers for sandbox
# 2. Verify webhook endpoints are accessible
# 3. Check Square application permissions
# 4. Validate payment amounts (no decimals in cents)

# Test webhook locally with ngrok
npm install -g ngrok
ngrok http 3000
# Use ngrok URL for webhook endpoint in Square console
```

#### 4. Build and Deployment Issues
```bash
# Error: Build failed
# Check for:
# 1. TypeScript errors
npx tsc --noEmit

# 2. Missing environment variables
echo $DATABASE_URL

# 3. Dependency issues
rm -rf node_modules package-lock.json
npm install

# 4. Prisma client issues
npx prisma generate
```

#### 5. Performance Issues
```bash
# Analyze bundle size
npm run analyze

# Check for large dependencies
npx bundle-analyzer

# Monitor performance
# Use Next.js built-in analytics
# Add performance monitoring (New Relic, DataDog)
```

### Debug Scripts

```typescript
// scripts/debug-square.ts
import { squareClient } from '../src/lib/square';

async function debugSquare() {
  try {
    console.log('Testing Square connection...');
    
    const locations = await squareClient.locationsApi.listLocations();
    console.log('✓ Locations API working');
    console.log('Locations:', locations.result.locations?.map(l => ({
      id: l.id,
      name: l.name,
      status: l.status
    })));

    // Test payments API
    const payments = await squareClient.paymentsApi.listPayments();
    console.log('✓ Payments API working');
    
  } catch (error) {
    console.error('Square API Error:', error);
  }
}

debugSquare();
```

```bash
# Run debug script
npx ts-node scripts/debug-square.ts
```

### Monitoring and Logging

```typescript
// src/lib/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
    // Send to monitoring service
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta);
  },
};
```

### Support and Resources

- **Square Developer Documentation**: https://developer.squareup.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **Prisma Documentation**: https://prisma.io/docs
- **Project Repository**: https://github.com/your-org/founders-day-frontend
- **Support Email**: support@foundersday.com

---

This implementation guide provides step-by-step instructions for setting up the complete Square payment integration system. Follow each section carefully and refer to the troubleshooting section if you encounter any issues.