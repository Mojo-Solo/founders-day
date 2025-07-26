# TDD-BDD Workflow Integration Guide

## Quick Start

This guide provides the team with a practical workflow for integrating TDD and BDD in the Founders Day Minnesota application development.

## Development Workflow

### 1. Start with User Story (BDD)

**Example User Story:**
```
As a Lodge Administrator
I want to create events with capacity limits
So that we don't overbook our venues
```

### 2. Write BDD Feature File

Create `features/event-capacity.feature`:
```gherkin
Feature: Event Capacity Management
  As a Lodge Administrator
  I want to manage event capacity
  So that we don't overbook our venues

  Scenario: Set capacity when creating event
    Given I am logged in as a lodge administrator
    When I create an event with capacity 50
    Then the event should show "50 spots available"
    And registrations should be limited to 50
```

### 3. Generate Step Definitions

Run: `npm run bdd:generate-steps features/event-capacity.feature`

This creates `step-definitions/event-capacity.steps.ts`

### 4. Run BDD Tests (Should Fail)

Run: `npm run test:bdd -- features/event-capacity.feature`

Expected: All scenarios fail (no implementation)

### 5. Switch to TDD for Implementation

**Write failing unit test first:**

`src/services/__tests__/event.service.test.ts`:
```typescript
describe('EventService', () => {
  it('should create event with capacity limit', async () => {
    const eventData = {
      name: 'Test Event',
      capacity: 50
    };
    
    const event = await eventService.createEvent(eventData);
    
    expect(event.capacity).toBe(50);
    expect(event.spotsAvailable).toBe(50);
  });
});
```

### 6. Implement Code (Make Unit Tests Pass)

`src/services/event.service.ts`:
```typescript
async createEvent(data: EventData): Promise<Event> {
  const event = {
    ...data,
    spotsAvailable: data.capacity,
    registrations: []
  };
  
  return await this.eventRepository.save(event);
}
```

### 7. Run Integration Tests

Run: `npm run test:integration`

### 8. Verify BDD Scenarios Pass

Run: `npm run test:bdd -- features/event-capacity.feature`

All scenarios should now pass!

## Team Commands

### BDD Commands
```bash
# Create new feature
npm run bdd:create-feature -- [feature-name]

# Generate step definitions
npm run bdd:generate-steps -- [feature-file]

# Run specific feature
npm run test:bdd -- features/[feature-name].feature

# Run all BDD tests
npm run test:bdd

# Run with tags
npm run test:bdd -- --tags @smoke
```

### TDD Commands
```bash
# Create new test file
npm run tdd:create-test -- [service-name]

# Run unit tests in watch mode
npm run test:unit -- --watch

# Run specific test file
npm run test:unit -- [test-file]

# Run with coverage
npm run test:unit -- --coverage
```

### Integration Commands
```bash
# Run all tests (unit + integration + e2e)
npm run test:all

# Run tests in CI mode
npm run test:ci

# Generate test report
npm run test:report
```

## File Organization

```
founders-day/
├── features/                 # BDD feature files
│   ├── user-registration.feature
│   └── event-management.feature
├── step-definitions/         # Cucumber step implementations
│   ├── user-registration.steps.ts
│   └── event-management.steps.ts
├── e2e/                     # Playwright E2E tests
│   ├── registration.spec.ts
│   └── events.spec.ts
├── src/
│   ├── services/
│   │   ├── __tests__/       # TDD unit tests
│   │   │   ├── user.service.test.ts
│   │   │   └── event.service.test.ts
│   │   ├── user.service.ts
│   │   └── event.service.ts
│   └── integration/         # Integration tests
│       └── api.test.ts
└── pages/                   # Page objects for E2E
    ├── registration.page.ts
    └── event.page.ts
```

## Best Practices

### BDD Best Practices

1. **Write scenarios in user language**
   - ❌ "When I POST to /api/events"
   - ✅ "When I create a new event"

2. **Focus on behavior, not implementation**
   - ❌ "Then the database should contain the event"
   - ✅ "Then I should see the event in my events list"

3. **Keep scenarios independent**
   - Each scenario should run in isolation
   - Use Background for common setup

4. **Use meaningful examples**
   - Real lodge names and realistic data
   - Edge cases that matter to users

### TDD Best Practices

1. **Red-Green-Refactor Cycle**
   - Write failing test
   - Write minimal code to pass
   - Refactor for clarity

2. **One assertion per test (when possible)**
   ```typescript
   // Good
   it('should calculate correct total', () => {
     expect(calculateTotal(items)).toBe(150);
   });
   
   it('should apply member discount', () => {
     expect(calculateDiscount(total, 'member')).toBe(15);
   });
   ```

3. **Test behavior, not implementation**
   ```typescript
   // Bad - testing implementation
   it('should call database.save()', () => {
     expect(mockDb.save).toHaveBeenCalled();
   });
   
   // Good - testing behavior
   it('should persist user data', async () => {
     await service.createUser(data);
     const user = await service.findUser(data.email);
     expect(user).toBeDefined();
   });
   ```

4. **Use descriptive test names**
   ```typescript
   // Bad
   it('should work', () => {});
   
   // Good
   it('should reject registration when email already exists', () => {});
   ```

## Integration Patterns

### Pattern 1: Feature-First Development

1. Stakeholder describes feature
2. Write BDD scenarios together
3. Developers implement using TDD
4. Validate with stakeholders

### Pattern 2: Bug-Fix Workflow

1. Write failing E2E test reproducing bug
2. Write unit test for specific issue
3. Fix implementation
4. Verify both tests pass

### Pattern 3: Refactoring Workflow

1. Ensure BDD tests pass (behavior unchanged)
2. Refactor using TDD
3. Verify BDD tests still pass

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: TDD-BDD Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        test-type: [unit, integration, bdd]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ${{ matrix.test-type }} tests
        run: npm run test:${{ matrix.test-type }}
      
      - name: Upload coverage
        if: matrix.test-type == 'unit'
        uses: codecov/codecov-action@v3
```

### Pre-commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit

# Run unit tests for changed files
npm run test:unit -- --findRelatedTests $(git diff --cached --name-only)

# Run linting
npm run lint

# Run type checking
npm run type-check
```

## Troubleshooting

### Common Issues

**BDD tests fail but manual testing works**
- Check step definitions match feature file exactly
- Verify selectors in page objects
- Add waits for async operations

**Unit tests pass but integration fails**
- Check mock behavior matches reality
- Verify database state between tests
- Look for missing error handling

**Flaky E2E tests**
- Add explicit waits
- Use data-testid attributes
- Isolate test data

## Templates

### Quick Copy Templates

**New BDD Feature:**
```gherkin
Feature: [Feature Name]
  As a [user role]
  I want to [action]
  So that [benefit]

  Scenario: [Happy path]
    Given [precondition]
    When [action]
    Then [expected result]
```

**New TDD Test:**
```typescript
describe('[Component/Service]', () => {
  let [instance]: [Type];

  beforeEach(() => {
    // Setup
  });

  describe('[method]', () => {
    it('should [expected behavior]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**New Page Object:**
```typescript
export class [PageName]Page {
  constructor(private page: Page) {}

  async [action]() {
    // Implementation
  }

  async expect[Assertion]() {
    // Assertion
  }
}
```

## Resources

- [Cucumber Documentation](https://cucumber.io/docs)
- [Jest Testing Guide](https://jestjs.io/docs/getting-started)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [TDD Kata Exercises](https://kata-log.rocks/tdd)