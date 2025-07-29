# BDD Test Setup & Execution Guide

## Quick Start

Run all BDD tests:
```bash
./RUN-BDD-TESTS.sh all
```

## What We Fixed

### 1. TypeScript Compilation Issues
- Created adapter pattern for test lifecycle hooks (beforeAll, afterAll, etc.)
- Fixed all import paths and type definitions
- Added proper TypeScript configuration

### 2. Step Definitions
- Created comprehensive step definitions organized by feature area:
  - `common/auth-steps.ts` - Authentication and user management
  - `common/form-steps.ts` - Form interactions
  - `common/ui-steps.ts` - UI visibility and interactions
  - `common/navigation-steps.ts` - Page navigation
  - `admin/dashboard-steps.ts` - Admin dashboard features
  - `mobile/mobile-steps.ts` - Mobile-specific features
  - `search/search-page-steps.ts` - Search functionality
  - `validation/validation-steps.ts` - Form validation

### 3. Database Integration
- Added Supabase initialization in hooks
- Created mock fallback for tests without real database
- Fixed seedTestData to handle both real and mock clients

### 4. Browser Automation
- Playwright browser and page initialization in hooks
- Screenshot capture on test failures
- Proper cleanup after each test

## Test Execution Status

Current test results show:
- **80 scenarios total**
- **38 failed** - Due to missing application pages/features
- **5 ambiguous** - Fixed by removing duplicate step definitions
- **36 undefined** - Need specific implementation
- **1 passed** - Basic setup test

## Environment Configuration

Create `.env.test` with:
```env
# Frontend URL
BASE_URL=http://localhost:3000

# API URL  
API_URL=http://localhost:3001

# Supabase (optional - tests will use mock if not provided)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Test settings
HEADLESS=true
DEBUG=false
```

## Running Specific Tests

```bash
# Run smoke tests only
./RUN-BDD-TESTS.sh smoke

# Run tests in parallel
./RUN-BDD-TESTS.sh parallel

# Run specific feature
./RUN-BDD-TESTS.sh feature registration

# Run with visible browser
HEADLESS=false ./RUN-BDD-TESTS.sh all

# Debug mode
DEBUG=true ./RUN-BDD-TESTS.sh all
```

## Next Steps

1. **Implement Application Pages**
   - The tests are failing because the actual application pages don't exist yet
   - Start with `/login`, `/register`, `/search`, `/admin/dashboard`

2. **Add More Step Definitions**
   - As you see "Undefined" steps, implement them following the patterns in existing files
   - Use the suggested snippets from test output

3. **Connect Real Backend**
   - Set up Supabase project
   - Add environment variables
   - Tests will automatically use real database when available

4. **Add Test Data Fixtures**
   - Create realistic test data in `fixtures/` directory
   - Use in step definitions for consistent testing

## Troubleshooting

### "Cannot find module" errors
- Run `npm install` in root directory
- Make sure to build packages: `npm run build --workspace=@founders-day/test-utils`

### "Page not initialized" errors
- Check that hooks are running (should see "Starting Cucumber test suite...")
- Verify Playwright is installed: `npx playwright install chromium`

### Tests hang or timeout
- Increase timeout in cucumber.js configuration
- Check BASE_URL is correct
- Use DEBUG=true to see browser console logs

## Architecture Overview

```
features/
├── step-definitions/       # Step implementation files
│   ├── common/            # Shared steps
│   ├── admin/             # Admin-specific steps
│   ├── mobile/            # Mobile-specific steps
│   └── search/            # Search-specific steps
├── support/
│   ├── world.ts           # Test context (FoundersDayWorld)
│   ├── hooks.ts           # Before/After hooks
│   └── parameter-types.ts # Custom parameter types
└── *.feature              # Gherkin feature files

packages/test-utils/
├── src/
│   ├── core/              # Core utilities
│   │   ├── runner-detector.ts
│   │   ├── lifecycle-adapter.ts
│   │   └── mock-utils.ts
│   ├── adapters/          # Test runner adapters
│   ├── helpers/           # Helper functions
│   └── test-utils.ts      # Main entry point
```

## Best Practices

1. **Keep Steps Generic**
   - Write reusable step definitions
   - Use parameters for dynamic values
   - Avoid hard-coding test data

2. **Use Page Objects**
   - Create page objects for complex pages
   - Encapsulate selectors and actions
   - Make tests more maintainable

3. **Handle Async Properly**
   - Always use async/await
   - Set appropriate timeouts
   - Handle loading states

4. **Debug Effectively**
   - Use `this.attach()` to add debug info
   - Take screenshots on failure
   - Use browser dev tools with HEADLESS=false

5. **Mock External Services**
   - Use mock Supabase client when needed
   - Stub API calls for isolated testing
   - Control test data precisely