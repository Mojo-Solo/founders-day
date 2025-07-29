# Technical Architecture: BDD Test Command Fix

## System Overview
```
┌─────────────────────────────────────────────────────────────┐
│                     Test Execution Layer                      │
├─────────────────┬────────────────┬──────────────────────────┤
│   BDD/Cucumber   │   Jest Tests   │    Vitest Tests          │
├─────────────────┴────────────────┴──────────────────────────┤
│                    Test Utils Adapter Layer                   │
├──────────────────────────────────────────────────────────────┤
│                    Shared Test Utilities                      │
└──────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Test Runner Detection Module
```typescript
// packages/test-utils/src/core/runner-detector.ts
export enum TestRunner {
  CUCUMBER = 'cucumber',
  JEST = 'jest',
  VITEST = 'vitest',
  UNKNOWN = 'unknown'
}

export function detectTestRunner(): TestRunner {
  // Detection logic based on:
  // 1. Process environment variables
  // 2. Global object inspection
  // 3. Module availability checks
}
```

### 2. Lifecycle Adapter Interface
```typescript
// packages/test-utils/src/core/lifecycle-adapter.ts
export interface ILifecycleAdapter {
  beforeAll(fn: HookFunction): void;
  afterAll(fn: HookFunction): void;
  beforeEach(fn: HookFunction): void;
  afterEach(fn: HookFunction): void;
}

export type HookFunction = () => void | Promise<void>;
```

### 3. Runner-Specific Implementations

#### Cucumber Adapter
```typescript
// packages/test-utils/src/adapters/cucumber-adapter.ts
import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';

export class CucumberAdapter implements ILifecycleAdapter {
  beforeAll(fn: HookFunction): void {
    BeforeAll(fn);
  }
  
  afterAll(fn: HookFunction): void {
    AfterAll(fn);
  }
  
  beforeEach(fn: HookFunction): void {
    Before(fn);
  }
  
  afterEach(fn: HookFunction): void {
    After(fn);
  }
}
```

#### Jest Adapter
```typescript
// packages/test-utils/src/adapters/jest-adapter.ts
export class JestAdapter implements ILifecycleAdapter {
  beforeAll(fn: HookFunction): void {
    global.beforeAll(fn);
  }
  
  afterAll(fn: HookFunction): void {
    global.afterAll(fn);
  }
  
  beforeEach(fn: HookFunction): void {
    global.beforeEach(fn);
  }
  
  afterEach(fn: HookFunction): void {
    global.afterEach(fn);
  }
}
```

### 4. Unified Test Utils Facade
```typescript
// packages/test-utils/src/index.ts
import { detectTestRunner, TestRunner } from './core/runner-detector';
import { ILifecycleAdapter } from './core/lifecycle-adapter';
import { CucumberAdapter } from './adapters/cucumber-adapter';
import { JestAdapter } from './adapters/jest-adapter';
import { VitestAdapter } from './adapters/vitest-adapter';

class TestUtils {
  private adapter: ILifecycleAdapter;
  
  constructor() {
    const runner = detectTestRunner();
    this.adapter = this.createAdapter(runner);
  }
  
  private createAdapter(runner: TestRunner): ILifecycleAdapter {
    switch (runner) {
      case TestRunner.CUCUMBER:
        return new CucumberAdapter();
      case TestRunner.JEST:
        return new JestAdapter();
      case TestRunner.VITEST:
        return new VitestAdapter();
      default:
        throw new Error(`Unsupported test runner: ${runner}`);
    }
  }
  
  // Lifecycle methods
  beforeAll(fn: HookFunction): void {
    this.adapter.beforeAll(fn);
  }
  
  afterAll(fn: HookFunction): void {
    this.adapter.afterAll(fn);
  }
  
  beforeEach(fn: HookFunction): void {
    this.adapter.beforeEach(fn);
  }
  
  afterEach(fn: HookFunction): void {
    this.adapter.afterEach(fn);
  }
  
  // Other shared utilities
  async setupTestEnvironment(): Promise<void> {
    // Common setup logic
  }
  
  async teardownTestEnvironment(): Promise<void> {
    // Common teardown logic
  }
}

export const testUtils = new TestUtils();
export default testUtils;
```

## File Structure
```
packages/test-utils/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── core/
│   │   ├── runner-detector.ts      # Test runner detection
│   │   ├── lifecycle-adapter.ts    # Adapter interface
│   │   └── types.ts               # Shared types
│   ├── adapters/
│   │   ├── cucumber-adapter.ts    # Cucumber implementation
│   │   ├── jest-adapter.ts        # Jest implementation
│   │   └── vitest-adapter.ts      # Vitest implementation
│   └── utils/
│       ├── database.ts            # DB utilities
│       ├── fixtures.ts            # Test fixtures
│       └── helpers.ts             # General helpers
├── package.json
└── tsconfig.json
```

## TypeScript Configuration

### Base tsconfig.json
```json
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
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Type Definitions
```typescript
// packages/test-utils/src/types/global.d.ts
declare global {
  namespace NodeJS {
    interface Global {
      beforeAll?: (fn: () => void | Promise<void>) => void;
      afterAll?: (fn: () => void | Promise<void>) => void;
      beforeEach?: (fn: () => void | Promise<void>) => void;
      afterEach?: (fn: () => void | Promise<void>) => void;
    }
  }
}

export {};
```

## Implementation Steps

### Step 1: Create Detection Logic
```typescript
// Reliable detection based on multiple signals
function detectTestRunner(): TestRunner {
  // Check for Cucumber
  if (process.env.CUCUMBER_WORKER_ID || hasCucumberModules()) {
    return TestRunner.CUCUMBER;
  }
  
  // Check for Jest
  if (process.env.JEST_WORKER_ID || typeof jest !== 'undefined') {
    return TestRunner.JEST;
  }
  
  // Check for Vitest
  if (process.env.VITEST || hasVitestModules()) {
    return TestRunner.VITEST;
  }
  
  return TestRunner.UNKNOWN;
}
```

### Step 2: Implement Adapters
Each adapter translates the common interface to runner-specific APIs.

### Step 3: Update Existing Code
Replace direct lifecycle hook usage with adapter calls:
```typescript
// Before
beforeAll(() => {
  // setup
});

// After
import testUtils from '@founders-day/test-utils';

testUtils.beforeAll(() => {
  // setup
});
```

### Step 4: Validation Strategy
1. Compile TypeScript with strict mode
2. Run each test type in isolation
3. Verify no runtime errors
4. Check for proper cleanup

## Performance Considerations
- Adapter selection happens once at module load
- No runtime overhead after initialization
- Type checking at compile time only
- Minimal memory footprint

## Error Handling
```typescript
class TestRunnerError extends Error {
  constructor(message: string, public runner: TestRunner) {
    super(message);
    this.name = 'TestRunnerError';
  }
}

// Usage in adapter
if (!hasRequiredModules()) {
  throw new TestRunnerError(
    'Required test runner modules not found',
    TestRunner.CUCUMBER
  );
}
```

## Migration Guide
1. Install updated test-utils package
2. Update imports in test files
3. Run TypeScript compiler to check for errors
4. Execute tests to verify functionality
5. Remove any runner-specific workarounds

## Monitoring and Logging
```typescript
// Debug mode for troubleshooting
if (process.env.TEST_UTILS_DEBUG) {
  console.log(`Detected test runner: ${runner}`);
  console.log(`Using adapter: ${adapter.constructor.name}`);
}
```