# Immediate Actions - BDD Integration Sprint

## Day 1 Actions (Monday)

### 1. Create Test Utils Package (Morning)
```bash
# Create package structure
mkdir -p packages/test-utils/src/{assertions,factories,helpers,types}

# Initialize package
cd packages/test-utils
npm init -y
npm install @playwright/test @cucumber/cucumber
```

### 2. Set Up Shared Assertions (Afternoon)
Create `/packages/test-utils/src/assertions/index.ts`:
```typescript
import { expect, Page } from '@playwright/test';

export class SharedAssertions {
  static async assertUserAuthenticated(page: Page, username: string) {
    await expect(page.locator('[data-testid="user-menu"]')).toContainText(username);
    await expect(page).toHaveURL(/\/dashboard/);
  }

  static async assertElementVisible(page: Page, selector: string, timeout = 5000) {
    await expect(page.locator(selector)).toBeVisible({ timeout });
  }

  static async assertNotificationShown(page: Page, message: string) {
    await expect(page.locator('.notification')).toContainText(message);
  }
}
```

### 3. Create Test Data Factories
Create `/packages/test-utils/src/factories/user.factory.ts`:
```typescript
import { faker } from '@faker-js/faker';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'speaker';
}

export class UserFactory {
  static create(overrides?: Partial<TestUser>): TestUser {
    return {
      email: faker.internet.email(),
      password: 'Test123!@#',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: 'user',
      ...overrides
    };
  }

  static createAdmin(): TestUser {
    return this.create({ role: 'admin', email: 'admin@founders-test.com' });
  }

  static createSpeaker(): TestUser {
    return this.create({ role: 'speaker' });
  }
}
```

## Day 2-3 Actions

### 1. Write Critical Feature Files
Priority order:
1. Profile Management (`/features/profile/profile-management.feature`)
2. Public Navigation (`/features/public/navigation.feature`)
3. Search (`/features/search/search.feature`)

### 2. Implement Step Definitions
Create reusable step patterns in `/features/step-definitions/common-steps.ts`:
```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { SharedAssertions } from '@founders-day/test-utils';

Given('I am logged in as {string}', async function(email: string) {
  await this.loginHelper.login(email);
  await SharedAssertions.assertUserAuthenticated(this.page, email);
});

When('I click {string}', async function(text: string) {
  await this.page.getByRole('button', { name: text }).click();
});

Then('I should see {string}', async function(text: string) {
  await expect(this.page.getByText(text)).toBeVisible();
});
```

## Day 4-5 Actions

### 1. Set Up GitHub Actions
Create `.github/workflows/bdd-tests.yml`:
```yaml
name: BDD Test Suite

on:
  pull_request:
    paths:
      - 'features/**'
      - 'e2e/**'
      - 'founders-day-frontend/**'
      - 'founders-day-admin/**'
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
      with:
        submodules: recursive
        
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run BDD tests
      run: npm run test:bdd
      
    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: cucumber-report
        path: reports/
```

### 2. Configure Parallel Execution
Update `cucumber.js`:
```javascript
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/step-definitions/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: ['html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
    parallel: 4,
    retry: 1
  }
};
```

## Quick Wins Checklist

- [ ] Install Cucumber VSCode extension
- [ ] Create `.vscode/snippets/cucumber.code-snippets`
- [ ] Add npm scripts for common tasks
- [ ] Set up pre-commit hooks for feature file linting
- [ ] Create team Slack channel for BDD questions
- [ ] Schedule weekly BDD pairing sessions

## Resources & References

1. **Cucumber Documentation**: https://cucumber.io/docs/cucumber/
2. **Playwright Best Practices**: https://playwright.dev/docs/best-practices
3. **Team Contacts**:
   - BDD Champion: QA Lead
   - DevOps Support: DevOps Engineer
   - Architecture Questions: Senior Developer

## Next Checkpoint
- **When**: End of Day 3
- **What**: Review feature file coverage, adjust sprint plan if needed
- **Who**: Entire team

---
*Remember: Focus on delivering value incrementally. Better to have 3 fully working features than 10 incomplete ones.*