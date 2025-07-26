# Cucumber Proof-of-Concept Setup Guide

## Installation and Configuration

### 1. Install Dependencies

```bash
# Core Cucumber packages
npm install --save-dev @cucumber/cucumber @cucumber/pretty-formatter

# TypeScript support
npm install --save-dev ts-node @types/node

# Assertion library (if not already installed)
npm install --save-dev chai @types/chai

# HTML reporting
npm install --save-dev @cucumber/html-formatter

# Cucumber-Playwright integration
npm install --save-dev @cucumber/playwright
```

### 2. Create Cucumber Configuration

Create `cucumber.js` in the root directory:

```javascript
module.exports = {
  default: {
    require: [
      'features/support/**/*.ts',
      'features/step-definitions/**/*.ts'
    ],
    requireModule: ['ts-node/register'],
    format: [
      'progress-bar',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json',
      '@cucumber/pretty-formatter'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
    paths: ['features/**/*.feature'],
    tags: 'not @skip',
    parallel: 2,
    retry: 1
  },
  smoke: {
    tags: '@smoke',
    parallel: 1
  }
};
```

### 3. TypeScript Configuration

Create `features/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "resolveJsonModule": true,
    "esModuleInterop": true
  },
  "include": [
    "**/*.ts"
  ]
}
```

### 4. Create Support Files

Create `features/support/world.ts`:

```typescript
import { setWorldConstructor, World } from '@cucumber/cucumber';
import { BrowserContext, Page, Browser } from '@playwright/test';
import { chromium } from 'playwright';

export interface CustomWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  testData: Record<string, any>;
}

setWorldConstructor(function(this: CustomWorld) {
  this.testData = {};
});
```

Create `features/support/hooks.ts`:

```typescript
import { Before, After, BeforeAll, AfterAll, Status } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { CustomWorld } from './world';

BeforeAll(async function() {
  // Global setup
  console.log('Starting Cucumber test suite...');
});

Before(async function(this: CustomWorld) {
  this.browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });
  this.context = await this.browser.newContext({
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    viewport: { width: 1280, height: 720 }
  });
  this.page = await this.context.newPage();
});

After(async function(this: CustomWorld, scenario) {
  if (scenario.result?.status === Status.FAILED && this.page) {
    const screenshot = await this.page.screenshot();
    this.attach(screenshot, 'image/png');
  }
  
  await this.page?.close();
  await this.context?.close();
  await this.browser?.close();
});

AfterAll(async function() {
  // Global cleanup
  console.log('Cucumber test suite completed.');
});
```

### 5. Create Step Definitions

Create `features/step-definitions/registration.steps.ts`:

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { CustomWorld } from '../support/world';

Given('the Founders Day {int} event is open for registration', async function(this: CustomWorld, year: number) {
  // This would check your database or API
  this.testData.eventYear = year;
  this.testData.eventOpen = true;
});

Given('I am on the Founders Day website', async function(this: CustomWorld) {
  await this.page!.goto('/');
  await expect(this.page!.title()).to.eventually.include('Founders Day');
});

When('I navigate to the registration page', async function(this: CustomWorld) {
  await this.page!.click('a[href*="register"]');
  await this.page!.waitForURL('**/register');
});

When('I select {string} individual ticket(s)', async function(this: CustomWorld, quantity: string) {
  await this.page!.fill('[data-testid="ticket-quantity"]', quantity);
  this.testData.ticketQuantity = parseInt(quantity);
});

When('I fill in my registration details:', async function(this: CustomWorld, dataTable) {
  const details = dataTable.rowsHash();
  
  for (const [field, value] of Object.entries(details)) {
    const fieldName = field.toLowerCase().replace(/\s+/g, '-');
    await this.page!.fill(`[data-testid="${fieldName}"]`, value as string);
  }
  
  this.testData.registrationDetails = details;
});

When('I complete payment with test card {string}', async function(this: CustomWorld, cardNumber: string) {
  // Wait for Square iframe
  const squareFrame = this.page!.frameLocator('#square-payment-frame');
  
  await squareFrame.locator('[data-testid="card-number"]').fill(cardNumber);
  await squareFrame.locator('[data-testid="expiry"]').fill('12/25');
  await squareFrame.locator('[data-testid="cvv"]').fill('123');
  await squareFrame.locator('[data-testid="postal-code"]').fill('55401');
  
  await this.page!.click('[data-testid="submit-payment"]');
});

Then('I should see a confirmation page with:', async function(this: CustomWorld, dataTable) {
  await this.page!.waitForSelector('[data-testid="confirmation-page"]');
  
  const expectedData = dataTable.rowsHash();
  
  if (expectedData['Confirmation Number']) {
    const confirmationNumber = await this.page!.textContent('[data-testid="confirmation-number"]');
    expect(confirmationNumber).to.match(/^FD-\d{6}$/);
  }
  
  if (expectedData['QR Code'] === 'Displayed') {
    const qrCode = await this.page!.isVisible('[data-testid="qr-code"]');
    expect(qrCode).to.be.true;
  }
  
  if (expectedData['Total Paid']) {
    const total = await this.page!.textContent('[data-testid="total-paid"]');
    expect(total).to.equal(expectedData['Total Paid']);
  }
});
```

### 6. Create Page Objects

Create `features/pages/registration.page.ts`:

```typescript
import { Page } from '@playwright/test';

export class RegistrationPage {
  constructor(private page: Page) {}

  async selectTicketType(type: string) {
    await this.page.click(`[data-ticket-type="${type}"]`);
  }

  async setQuantity(quantity: number) {
    await this.page.fill('[data-testid="ticket-quantity"]', quantity.toString());
  }

  async fillPersonalInfo(info: Record<string, string>) {
    for (const [field, value] of Object.entries(info)) {
      const selector = `[name="${field.toLowerCase().replace(/\s+/g, '')}"]`;
      await this.page.fill(selector, value);
    }
  }

  async proceedToPayment() {
    await this.page.click('[data-testid="proceed-to-payment"]');
    await this.page.waitForSelector('#square-payment-frame');
  }

  async getCartTotal(): Promise<string> {
    return await this.page.textContent('[data-testid="cart-total"]') || '';
  }

  async isEarlyBirdPriceShown(): Promise<boolean> {
    return await this.page.isVisible('[data-testid="early-bird-badge"]');
  }
}
```

### 7. Create Test Helpers

Create `features/helpers/test-data.helper.ts`:

```typescript
import { faker } from '@faker-js/faker';

export class TestDataHelper {
  static generateAttendee() {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      phone: faker.phone.number('###-###-####'),
      dietaryNeeds: faker.helpers.arrayElement(['None', 'Vegetarian', 'Vegan', 'Gluten-Free'])
    };
  }

  static getTestCard(type: 'success' | 'decline' | '3ds') {
    const cards = {
      success: '4111 1111 1111 1111',
      decline: '4000 0000 0000 0002',
      '3ds': '4000 0027 6000 3184'
    };
    return cards[type];
  }
}
```

### 8. Add NPM Scripts

Update `package.json`:

```json
{
  "scripts": {
    "test:cucumber": "cucumber-js",
    "test:cucumber:smoke": "cucumber-js --profile smoke",
    "test:cucumber:report": "node generate-cucumber-report.js",
    "test:cucumber:watch": "nodemon --watch features --exec 'npm run test:cucumber'",
    "test:cucumber:debug": "node --inspect-brk ./node_modules/.bin/cucumber-js"
  }
}
```

### 9. Integration with Existing Tests

Create `features/step-definitions/common.steps.ts` to reuse existing test utilities:

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
// Import your existing test utilities
import { DatabaseHelper } from '../../founders-day-frontend/test/helpers/database';
import { APIClient } from '../../founders-day-frontend/test/helpers/api-client';

const db = new DatabaseHelper();
const api = new APIClient();

Given('I have a clean test database', async function(this: CustomWorld) {
  await db.cleanup();
  await db.seed();
});

Given('there are {int} tickets remaining for the event', async function(this: CustomWorld, remaining: number) {
  await db.updateEventCapacity(this.testData.eventId, remaining);
});

Then('a {string} email should be sent to {string}', async function(this: CustomWorld, emailType: string, recipient: string) {
  const emails = await api.getEmailQueue();
  const sent = emails.find(e => e.to === recipient && e.template === emailType);
  expect(sent).to.exist;
});
```

### 10. CI/CD Integration

Create `.github/workflows/cucumber.yml`:

```yaml
name: Cucumber E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  cucumber-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Start application
        run: |
          npm run dev &
          npx wait-on http://localhost:3000
          
      - name: Run Cucumber tests
        run: npm run test:cucumber
        env:
          BASE_URL: http://localhost:3000
          HEADLESS: true
          
      - name: Generate Cucumber report
        if: always()
        run: npm run test:cucumber:report
        
      - name: Upload Cucumber report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: cucumber-report
          path: reports/cucumber-report.html
          
      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: failure-screenshots
          path: screenshots/
```

## Running the Tests

### Local Development
```bash
# Run all Cucumber tests
npm run test:cucumber

# Run only smoke tests
npm run test:cucumber:smoke

# Run with specific tags
npx cucumber-js --tags "@critical and not @skip"

# Run in watch mode
npm run test:cucumber:watch

# Debug mode
npm run test:cucumber:debug
```

### Viewing Reports
After running tests, open `reports/cucumber-report.html` in a browser to see:
- Feature overview
- Scenario pass/fail status
- Step-by-step execution details
- Screenshots of failures
- Execution time metrics

## Benefits Realized

1. **Clear Communication**: Product owners can read and understand test scenarios
2. **Living Documentation**: Tests serve as up-to-date documentation
3. **Reusable Steps**: Step definitions can be shared across features
4. **Better Debugging**: Clear test structure with screenshots on failure
5. **Parallel Execution**: Tests run faster with parallel support

This POC demonstrates how Cucumber can enhance your existing test suite while maintaining the technical rigor you've established.