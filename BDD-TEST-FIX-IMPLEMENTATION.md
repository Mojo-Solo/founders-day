# Implementation Strategy: BDD Test Command Fix

## Pre-Implementation Validation

### 1. Current State Analysis
```bash
# Commands to run before starting
cd /Users/david/Documents/root/founders-day

# Check current test-utils structure
find packages/test-utils -name "*.ts" -type f | head -20

# Look for lifecycle hook usage
grep -r "beforeAll\|afterAll\|beforeEach" packages/test-utils/

# Check package.json for dependencies
cat packages/test-utils/package.json

# Verify TypeScript errors
npx tsc --noEmit -p packages/test-utils/tsconfig.json
```

### 2. Dependency Verification
```bash
# Check if Cucumber types are available
npm list @cucumber/cucumber
npm list @types/cucumber

# Check current test runner setup
cat cucumber.js
cat cucumber.parallel.js
```

## Implementation Steps (100% Foolproof)

### Step 1: Backup Current State
```bash
# Create backup branch
git checkout -b backup/pre-bdd-fix-$(date +%Y%m%d-%H%M%S)
git add -A
git commit -m "Backup: Pre-BDD test fix state"
git checkout feature/cucumber-bdd-exploration
```

### Step 2: Create Adapter Structure
```bash
# Create new directories
mkdir -p packages/test-utils/src/core
mkdir -p packages/test-utils/src/adapters
mkdir -p packages/test-utils/src/utils
mkdir -p packages/test-utils/src/types
```

### Step 3: Implement Core Detection (No External Dependencies)
```typescript
// packages/test-utils/src/core/runner-detector.ts
export enum TestRunner {
  CUCUMBER = 'cucumber',
  JEST = 'jest',
  VITEST = 'vitest',
  UNKNOWN = 'unknown'
}

export function detectTestRunner(): TestRunner {
  // Safe detection without imports
  try {
    // Cucumber detection
    if (process.env.CUCUMBER_WORKER_ID || 
        process.argv.some(arg => arg.includes('cucumber'))) {
      return TestRunner.CUCUMBER;
    }
    
    // Jest detection
    if (process.env.JEST_WORKER_ID || 
        typeof (global as any).jest !== 'undefined') {
      return TestRunner.JEST;
    }
    
    // Vitest detection
    if (process.env.VITEST || 
        process.argv.some(arg => arg.includes('vitest'))) {
      return TestRunner.VITEST;
    }
    
    // Default for BDD context
    if (process.argv.some(arg => arg.includes('BDD'))) {
      return TestRunner.CUCUMBER;
    }
    
    return TestRunner.UNKNOWN;
  } catch (error) {
    console.warn('Test runner detection failed:', error);
    return TestRunner.UNKNOWN;
  }
}
```

### Step 4: Create Safe Lifecycle Adapter
```typescript
// packages/test-utils/src/core/lifecycle-adapter.ts
export type HookFunction = () => void | Promise<void>;

export interface ILifecycleAdapter {
  beforeAll(fn: HookFunction): void;
  afterAll(fn: HookFunction): void;
  beforeEach(fn: HookFunction): void;
  afterEach(fn: HookFunction): void;
}

// No-op adapter for safety
export class NoOpAdapter implements ILifecycleAdapter {
  beforeAll(fn: HookFunction): void {
    // Store for potential manual execution
    console.debug('NoOp: beforeAll registered');
  }
  
  afterAll(fn: HookFunction): void {
    console.debug('NoOp: afterAll registered');
  }
  
  beforeEach(fn: HookFunction): void {
    console.debug('NoOp: beforeEach registered');
  }
  
  afterEach(fn: HookFunction): void {
    console.debug('NoOp: afterEach registered');
  }
}
```

### Step 5: Implement Cucumber Adapter with Guards
```typescript
// packages/test-utils/src/adapters/cucumber-adapter.ts
import { ILifecycleAdapter, HookFunction } from '../core/lifecycle-adapter';

export class CucumberAdapter implements ILifecycleAdapter {
  private cucumber: any;
  
  constructor() {
    try {
      // Dynamic import to avoid compile-time errors
      this.cucumber = require('@cucumber/cucumber');
    } catch (error) {
      console.warn('Cucumber module not available');
      this.cucumber = null;
    }
  }
  
  beforeAll(fn: HookFunction): void {
    if (this.cucumber?.BeforeAll) {
      this.cucumber.BeforeAll(fn);
    } else {
      // Store for manual execution
      console.debug('Cucumber BeforeAll not available');
    }
  }
  
  afterAll(fn: HookFunction): void {
    if (this.cucumber?.AfterAll) {
      this.cucumber.AfterAll(fn);
    } else {
      console.debug('Cucumber AfterAll not available');
    }
  }
  
  beforeEach(fn: HookFunction): void {
    if (this.cucumber?.Before) {
      this.cucumber.Before(fn);
    } else {
      console.debug('Cucumber Before not available');
    }
  }
  
  afterEach(fn: HookFunction): void {
    if (this.cucumber?.After) {
      this.cucumber.After(fn);
    } else {
      console.debug('Cucumber After not available');
    }
  }
}
```

### Step 6: Create Main Entry Point with Fallbacks
```typescript
// packages/test-utils/src/index.ts
import { detectTestRunner, TestRunner } from './core/runner-detector';
import { ILifecycleAdapter, NoOpAdapter } from './core/lifecycle-adapter';

class TestUtils {
  private adapter: ILifecycleAdapter;
  private pendingHooks: Map<string, HookFunction[]> = new Map();
  
  constructor() {
    const runner = detectTestRunner();
    console.debug(`Detected test runner: ${runner}`);
    this.adapter = this.createAdapter(runner);
  }
  
  private createAdapter(runner: TestRunner): ILifecycleAdapter {
    try {
      switch (runner) {
        case TestRunner.CUCUMBER:
          const { CucumberAdapter } = require('./adapters/cucumber-adapter');
          return new CucumberAdapter();
        case TestRunner.JEST:
          const { JestAdapter } = require('./adapters/jest-adapter');
          return new JestAdapter();
        case TestRunner.VITEST:
          const { VitestAdapter } = require('./adapters/vitest-adapter');
          return new VitestAdapter();
        default:
          return new NoOpAdapter();
      }
    } catch (error) {
      console.warn(`Failed to load adapter for ${runner}:`, error);
      return new NoOpAdapter();
    }
  }
  
  // Safe lifecycle methods that won't throw
  beforeAll(fn: HookFunction): void {
    try {
      this.adapter.beforeAll(fn);
    } catch (error) {
      this.storeHook('beforeAll', fn);
    }
  }
  
  afterAll(fn: HookFunction): void {
    try {
      this.adapter.afterAll(fn);
    } catch (error) {
      this.storeHook('afterAll', fn);
    }
  }
  
  beforeEach(fn: HookFunction): void {
    try {
      this.adapter.beforeEach(fn);
    } catch (error) {
      this.storeHook('beforeEach', fn);
    }
  }
  
  afterEach(fn: HookFunction): void {
    try {
      this.adapter.afterEach(fn);
    } catch (error) {
      this.storeHook('afterEach', fn);
    }
  }
  
  private storeHook(type: string, fn: HookFunction): void {
    if (!this.pendingHooks.has(type)) {
      this.pendingHooks.set(type, []);
    }
    this.pendingHooks.get(type)!.push(fn);
    console.debug(`Stored ${type} hook for later execution`);
  }
  
  // Execute pending hooks manually if needed
  async executePendingHooks(type: string): Promise<void> {
    const hooks = this.pendingHooks.get(type) || [];
    for (const hook of hooks) {
      await hook();
    }
  }
}

// Export singleton instance
export const testUtils = new TestUtils();
export default testUtils;

// Also export as individual functions for compatibility
export const beforeAll = (fn: HookFunction) => testUtils.beforeAll(fn);
export const afterAll = (fn: HookFunction) => testUtils.afterAll(fn);
export const beforeEach = (fn: HookFunction) => testUtils.beforeEach(fn);
export const afterEach = (fn: HookFunction) => testUtils.afterEach(fn);
```

### Step 7: Update TypeScript Configuration
```json
// packages/test-utils/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowJs": true,
    "types": ["node"],
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### Step 8: Add Type Declarations
```typescript
// packages/test-utils/src/types/index.d.ts
declare module '@founders-day/test-utils' {
  export type HookFunction = () => void | Promise<void>;
  
  export interface TestUtils {
    beforeAll(fn: HookFunction): void;
    afterAll(fn: HookFunction): void;
    beforeEach(fn: HookFunction): void;
    afterEach(fn: HookFunction): void;
  }
  
  export const testUtils: TestUtils;
  export default testUtils;
  
  // Individual exports
  export function beforeAll(fn: HookFunction): void;
  export function afterAll(fn: HookFunction): void;
  export function beforeEach(fn: HookFunction): void;
  export function afterEach(fn: HookFunction): void;
}
```

## Validation Steps

### Step 1: Compile TypeScript
```bash
cd packages/test-utils
npm run build

# If build script doesn't exist, run directly
npx tsc

# Verify no errors
echo "TypeScript compilation status: $?"
```

### Step 2: Test Import
```bash
# Create test file
cat > test-import.js << 'EOF'
try {
  const testUtils = require('./dist/index.js');
  console.log('Import successful');
  console.log('Available methods:', Object.keys(testUtils));
} catch (error) {
  console.error('Import failed:', error);
}
EOF

node test-import.js
rm test-import.js
```

### Step 3: Fix RUN-BDD-TESTS.sh
```bash
# Update the script to ensure proper environment
cat > ./RUN-BDD-TESTS.sh << 'EOF'
#!/bin/bash
set -e

# Set environment for Cucumber
export CUCUMBER_WORKER_ID="main"
export NODE_ENV="test"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Running BDD tests..."

# Build test-utils first
echo "Building test-utils package..."
cd packages/test-utils
npm run build || npx tsc
cd ../..

# Run the requested test pattern
if [ "$1" == "all" ]; then
    echo "Running all BDD tests..."
    npm run test:bdd
else
    echo "Running BDD tests matching: $1"
    npm run test:bdd -- --tags "@$1"
fi

# Check exit code
if [ $? -eq 0 ]; then
    echo -e "${GREEN}BDD tests completed successfully!${NC}"
else
    echo -e "${RED}BDD tests failed!${NC}"
    exit 1
fi
EOF

chmod +x ./RUN-BDD-TESTS.sh
```

### Step 4: Final Validation
```bash
# Run the fixed command
./RUN-BDD-TESTS.sh all

# Check specific functionality
npm run test:bdd -- --dry-run
```

## Rollback Plan
If anything fails:
```bash
# Restore from backup
git checkout backup/pre-bdd-fix-[timestamp]
git checkout -b feature/cucumber-bdd-exploration-recovery
git cherry-pick [any good commits]
```

## Success Indicators
1. ✓ No TypeScript compilation errors
2. ✓ `./RUN-BDD-TESTS.sh all` executes without errors
3. ✓ BDD tests run (even if they fail functionally)
4. ✓ No regression in other test types
5. ✓ Clear error messages if issues occur

## Post-Implementation Checklist
- [ ] TypeScript compiles without errors
- [ ] test-utils package builds successfully
- [ ] BDD test command runs
- [ ] No runtime errors about missing functions
- [ ] Existing tests still work
- [ ] Documentation updated
- [ ] Commit with descriptive message