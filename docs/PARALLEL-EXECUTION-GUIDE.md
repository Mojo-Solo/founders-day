# Parallel Test Execution Guide

This guide explains how to run Cucumber tests in parallel for faster execution.

## Overview

Parallel execution allows multiple feature files or scenarios to run simultaneously, significantly reducing total test execution time.

## Configuration

### Cucumber Profiles

We have several profiles configured in `cucumber.parallel.js`:

1. **default** - Standard execution with retry for flaky tests
2. **parallel** - 4 parallel workers, excludes @sequential tests
3. **sequential** - Single worker for tests that must run in sequence
4. **smoke** - Fast fail smoke tests with 2 workers
5. **ci** - CI-optimized with detailed reporting

## Running Tests in Parallel

### Local Development

```bash
# Run all tests in parallel (4 workers)
npm run test:cucumber:parallel

# Run smoke tests in parallel (2 workers)
npm run test:cucumber:smoke

# Run specific features in parallel
npx cucumber-js features/registration/*.feature --parallel 4
```

### CI/CD Pipeline

```bash
# GitHub Actions automatically runs tests in parallel
npm run test:cucumber:ci

# Manual CI run with custom workers
PARALLEL_WORKERS=8 npm run test:cucumber:parallel
```

## Tagging Strategy

### Parallel-Safe Tags

Most tests can run in parallel:
```gherkin
@registration @parallel
Scenario: User registers successfully
```

### Sequential-Only Tags

Some tests must run sequentially:
```gherkin
@sequential @database-cleanup
Scenario: Reset database state
```

### Flaky Test Handling

Mark unstable tests for automatic retry:
```gherkin
@flaky @network-dependent
Scenario: External API integration
```

## Best Practices

### 1. Test Isolation

Each test should be completely independent:

```typescript
// Good - isolated test
beforeEach(async function() {
  this.testUser = createTestUser();
  await this.page.context().clearCookies();
});

// Bad - shared state
let sharedUser; // Don't do this!
```

### 2. Unique Test Data

Generate unique data for each test:

```typescript
// Use timestamps or UUIDs
const email = `test-${Date.now()}@example.com`;
const username = `user-${uuidv4()}`;
```

### 3. Resource Management

Clean up resources properly:

```typescript
afterEach(async function() {
  // Clean up test data
  if (this.testUser) {
    await deleteTestUser(this.testUser.id);
  }
  
  // Close any opened pages
  if (this.page) {
    await this.page.close();
  }
});
```

### 4. Avoid Race Conditions

Use proper waits and assertions:

```typescript
// Good - explicit wait
await waitForElement(page, '.success-message');

// Bad - fixed timeout
await page.waitForTimeout(5000);
```

## Parallel Execution Architecture

```
┌─────────────────┐
│  Test Runner    │
│  (Cucumber.js)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Workers │
    └────┬────┘
         │
┌────────┼────────┬────────┬────────┐
│        │        │        │        │
▼        ▼        ▼        ▼        ▼
Worker 1  Worker 2  Worker 3  Worker 4
│        │        │        │
▼        ▼        ▼        ▼
Feature A Feature B Feature C Feature D
```

## Performance Optimization

### 1. Worker Count

Optimal worker count depends on:
- CPU cores available
- Test complexity
- Resource constraints

```javascript
// Dynamic worker calculation
const workers = process.env.CI 
  ? 4 // Fixed for CI
  : Math.min(os.cpus().length - 1, 8); // Local
```

### 2. Test Distribution

Cucumber automatically distributes tests across workers. For better distribution:

```bash
# Split by scenarios instead of features
cucumber-js --parallel 4 --parallel-type scenarios
```

### 3. Resource Pooling

Share expensive resources across tests:

```typescript
// Browser context pool
const contextPool = new BrowserContextPool({
  max: 4,
  min: 2,
  idleTimeoutMillis: 30000
});
```

## Troubleshooting

### Common Issues

1. **Tests fail in parallel but pass sequentially**
   - Check for shared state
   - Ensure unique test data
   - Add @sequential tag if needed

2. **Resource exhaustion**
   - Reduce worker count
   - Implement resource pooling
   - Add memory limits

3. **Flaky tests**
   - Add retry logic
   - Increase timeouts
   - Mark with @flaky tag

### Debug Mode

Run tests sequentially to debug:

```bash
# Debug specific scenario
npm run test:cucumber:sequential -- --name "Scenario name"

# Debug with headed browser
HEADLESS=false npm run test:cucumber:sequential
```

## Monitoring & Reporting

### Execution Metrics

Track these metrics:
- Total execution time
- Worker utilization
- Failure rate by worker
- Resource usage

### Report Aggregation

Combine parallel execution reports:

```bash
# Merge all worker reports
npm run report:merge

# Generate HTML report
npm run report:generate

# Open report
open reports/final-report.html
```

## CI/CD Integration

### GitHub Actions Matrix

```yaml
strategy:
  matrix:
    worker: [1, 2, 3, 4]
steps:
  - run: npm run test:cucumber -- --shard=${{ matrix.worker }}/4
```

### Artifacts Collection

All parallel execution artifacts are collected:
- Individual worker reports
- Screenshots on failure
- Merged final report

## Migration Guide

### From Sequential to Parallel

1. **Audit existing tests**
   ```bash
   # Find tests with shared state
   grep -r "let shared" features/
   ```

2. **Add isolation**
   ```typescript
   // Add to each test file
   beforeEach(async function() {
     this.context = await browser.newContext();
     this.page = await this.context.newPage();
   });
   ```

3. **Tag appropriately**
   ```gherkin
   # Mark tests that can't be parallelized
   @sequential
   Scenario: Database migration test
   ```

4. **Test incrementally**
   ```bash
   # Start with 2 workers
   npm run test:cucumber:parallel -- --parallel 2
   
   # Increase gradually
   npm run test:cucumber:parallel -- --parallel 4
   ```

## Next Steps

1. Monitor execution times
2. Optimize slow tests
3. Increase parallel workers
4. Implement test sharding for large suites