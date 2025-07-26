# Cucumber BDD Quick Start Guide

## 🚀 Getting Started

### 1. Run Your First Test
```bash
# Verify the setup is working
npm run test:cucumber -- features/test-setup.feature
```

### 2. Run All Tests
```bash
npm run test:cucumber
```

### 3. Run Smoke Tests Only
```bash
npm run test:cucumber:smoke
```

## 📝 Writing Your First Test

### 1. Create a Feature File
```gherkin
# features/my-feature.feature
Feature: My New Feature
  As a user
  I want to do something
  So that I achieve a goal

  Scenario: Basic scenario
    Given I have a precondition
    When I perform an action
    Then I see the expected result
```

### 2. Generate Step Definitions
Run the test - Cucumber will provide snippets for undefined steps:
```bash
npm run test:cucumber -- features/my-feature.feature
```

### 3. Implement Step Definitions
```typescript
// features/step-definitions/my-steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../support/world';
import { expect } from 'chai';

Given('I have a precondition', async function(this: FoundersDayWorld) {
  // Your implementation
});

When('I perform an action', async function(this: FoundersDayWorld) {
  // Your implementation
});

Then('I see the expected result', async function(this: FoundersDayWorld) {
  // Your implementation
  expect(something).to.equal(expected);
});
```

## 🏗️ Project Structure

```
features/
├── support/
│   ├── world.ts          # Test context (this.testData, this.apiCall)
│   ├── hooks.ts          # Setup/teardown
│   └── parameter-types.ts # Custom types (@role, @amount, etc.)
├── step-definitions/
│   ├── common/           # Shared steps
│   ├── admin/            # Admin-specific
│   └── frontend/         # Frontend-specific
└── *.feature             # Your feature files
```

## 🔧 Available Tools in Tests

### World Context
```typescript
// Available in all steps via 'this'
this.testData        // Store test data
this.apiCall()       // Make API calls
this.attach()        // Attach data to reports
this.attachJSON()    // Attach JSON to reports
```

### Assertions (Chai)
```typescript
expect(value).to.equal(expected);
expect(value).to.exist;
expect(value).to.be.true;
expect(value).to.match(/pattern/);
expect(array).to.include(item);
```

### Custom Parameter Types
```gherkin
Given I am logged in as an {role}        # admin|volunteer|attendee|sponsor
When I pay {amount}                      # $75.50 or 75.50
And I select {ticketType} ticket         # individual|group|vip|sponsor
```

## 🏷️ Using Tags

### In Feature Files
```gherkin
@smoke @critical
Scenario: Important test

@wip @manual
Scenario: Work in progress
```

### Running Tagged Tests
```bash
# Run only smoke tests
npm run test:cucumber -- --tags @smoke

# Run critical but not wip
npm run test:cucumber -- --tags "@critical and not @wip"
```

## 📊 Reports

### Generate HTML Report
```bash
npm run test:cucumber:report
# Opens: reports/cucumber-report.html
```

### View Test Results
- Progress bar in terminal
- HTML report with screenshots/attachments
- JSON report for CI/CD integration

## 🐛 Debugging

### 1. Add Console Logs
```typescript
When('I do something', async function() {
  console.log('Debug:', this.testData);
  // Your code
});
```

### 2. Attach Debug Info
```typescript
Then('I verify something', async function() {
  this.attachJSON({
    expected: expectedValue,
    actual: actualValue
  });
});
```

### 3. Check Failed Test Attachments
Failed tests automatically attach:
- Last API response
- Error details
- Test data context

## 🔄 Common Patterns

### API Testing
```typescript
const response = await this.apiCall('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
});
const result = await response.json();
expect(response.ok).to.be.true;
```

### Data Tables
```gherkin
When I fill in:
  | Field | Value |
  | Name  | John  |
  | Email | j@example.com |
```

```typescript
When('I fill in:', async function(dataTable) {
  const data = dataTable.rowsHash();
  // data = { Name: 'John', Email: 'j@example.com' }
});
```

### Multiple Assertions
```typescript
Then('I see the confirmation', async function() {
  const { confirmationNumber, totalPaid } = this.testData.lastRegistration;
  
  expect(confirmationNumber).to.match(/^FD-\d{6}$/);
  expect(totalPaid).to.equal('$75.00');
});
```

## ⚡ Tips

1. **Keep Steps Reusable** - Write generic steps that can be used across features
2. **Use World for State** - Store data in `this.testData` between steps
3. **Tag Strategically** - Use tags for test organization and CI/CD
4. **Fail Fast** - Add assertions early to catch issues quickly
5. **Document Complex Steps** - Add comments for non-obvious implementations

## 🆘 Troubleshooting

### "Step is undefined"
- Check step definition file is in `features/step-definitions/`
- Verify the step text matches exactly (including parameters)
- Ensure TypeScript compilation succeeded

### "Cannot find module"
- Run `npm install` at root level
- Check `tsconfig.json` paths configuration
- Verify import paths are correct

### "API call failed"
- Ensure backend is running on port 3001
- Check `this.apiUrl` is set correctly
- Verify network connectivity

## 📚 Learn More

- [Cucumber.js Docs](https://cucumber.io/docs/cucumber/)
- [Gherkin Syntax](https://cucumber.io/docs/gherkin/)
- [BDD Best Practices](https://cucumber.io/docs/bdd/)