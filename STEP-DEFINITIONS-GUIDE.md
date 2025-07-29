# Step Definitions Implementation Guide

## Current Status

- **80 scenarios** are currently undefined
- **578 steps** need implementation
- Tests are parsing correctly but not executing

## Why This Is Critical

1. **No Test Coverage**: Your BDD tests provide zero value until step definitions are implemented
2. **False Security**: Tests appear to "pass" but aren't actually testing anything
3. **Growing Debt**: Each new feature adds more undefined steps

## Implementation Strategy

### Phase 1: Common Steps (Week 1)
Implement reusable step definitions that cover 60% of scenarios:

```typescript
// Already implemented in:
// - features/step-definitions/common/form-steps.ts
// - features/step-definitions/common/ui-steps.ts
// - features/step-definitions/common/setup-steps.ts
```

### Phase 2: Feature-Specific Steps (Week 2)
Implement steps for each feature:

```typescript
// Already started:
// - features/step-definitions/profile-steps.ts
// - features/step-definitions/navigation-steps.ts
// - features/step-definitions/search-steps.ts
```

## Common Patterns

### 1. Form Interactions
```typescript
When('I fill in {string} with {string}')
When('I select {string} from {string}')
When('I check {string}')
When('I click {string}')
```

### 2. Validations
```typescript
Then('I should see {string}')
Then('I should see validation message {string}')
Then('the {string} field should be highlighted in red')
```

### 3. Navigation
```typescript
Given('I am on the homepage')
When('I navigate to {string}')
Then('I should be on the {string} page')
```

### 4. Authentication
```typescript
Given('I am logged in as {string}')
Then('I should be logged out')
```

## Quick Start

1. **Run tests to see undefined steps**:
   ```bash
   ./RUN-BDD-TESTS.sh all
   ```

2. **Copy undefined step snippets** from the output

3. **Add to appropriate file**:
   - Common UI steps → `common/ui-steps.ts`
   - Form steps → `common/form-steps.ts`
   - Feature-specific → `[feature]-steps.ts`

4. **Implement using test utilities**:
   ```typescript
   import { fillForm, waitForElement } from '@founders-day/test-utils';
   
   When('...', async function() {
     // Use shared utilities
     await fillForm(this.page, data);
   });
   ```

## Priority Order

1. **Login/Logout** - Critical path
2. **Registration** - Core business flow
3. **Form Validation** - Reused everywhere
4. **Navigation** - User journey
5. **Search** - Key feature

## Reusable Templates

### Basic Step Template
```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../support/world';
import { expect } from 'chai';

When('step pattern', async function(this: FoundersDayWorld, param: string) {
  // Implementation
  await this.page.click(`text=${param}`);
});
```

### Data Table Template
```typescript
Then('I should see:', async function(this: FoundersDayWorld, dataTable: any) {
  const items = dataTable.raw().flat();
  for (const item of items) {
    const element = await this.page.getByText(item);
    expect(await element.isVisible()).to.be.true;
  }
});
```

### Wait and Assert Template
```typescript
Then('result assertion', async function(this: FoundersDayWorld) {
  const element = await waitForElement(this.page, '.selector');
  expect(await element.isVisible()).to.be.true;
});
```

## Next Steps

1. **Today**: Implement remaining undefined steps for one complete feature
2. **This Week**: Cover all critical user journeys
3. **Next Week**: Complete all 80 scenarios

## Verification

After implementing steps:

```bash
# Run specific feature to verify
./RUN-BDD-TESTS.sh feature profile

# Run all to see progress
./RUN-BDD-TESTS.sh all
```

You should see scenarios change from "undefined" to "passed" or "failed" (which means they're actually running!).