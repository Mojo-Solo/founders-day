# Immediate BDD Implementation Action Plan

## Quick Start: Fix Undefined Steps Today

### Step 1: Create Base Step Definitions Structure

```bash
# Create step definitions directory if not exists
mkdir -p features/step_definitions
```

### Step 2: Create Common Steps File

Create `features/step_definitions/common.steps.ts`:

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { page } from '../support/hooks';

// Navigation steps
Given('I am on the {string} page', async function(pageName: string) {
  const urls: Record<string, string> = {
    'login': '/login',
    'home': '/',
    'registration': '/register',
    // Add more page mappings
  };
  await page.goto(urls[pageName] || pageName);
});

// Click actions
When('I click the {string} button', async function(buttonText: string) {
  await page.click(`button:has-text("${buttonText}")`);
});

When('I click on {string}', async function(element: string) {
  await page.click(`text="${element}"`);
});

// Form interactions
When('I enter {string} in the {string} field', async function(value: string, fieldName: string) {
  await page.fill(`[name="${fieldName}"], [placeholder*="${fieldName}" i], [aria-label*="${fieldName}" i]`, value);
});

When('I move to the next field', async function() {
  await page.keyboard.press('Tab');
});

// Validation steps
Then('I should see {string}', async function(text: string) {
  await expect(page.locator(`text="${text}"`)).toBeVisible();
});

Then('I should see validation message {string}', async function(message: string) {
  await expect(page.locator('.error-message, .validation-error, [role="alert"]').filter({ hasText: message })).toBeVisible();
});

Then('I should be on the {string} page', async function(pageName: string) {
  const urls: Record<string, string> = {
    'login': '/login',
    'home': '/',
    'dashboard': '/dashboard',
    // Add more page mappings
  };
  await expect(page).toHaveURL(new RegExp(urls[pageName] || pageName));
});
```

### Step 3: Create Hooks File

Create `features/support/hooks.ts`:

```typescript
import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

let browser: Browser;
let context: BrowserContext;
let page: Page;

BeforeAll(async function() {
  browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
  });
});

Before(async function() {
  context = await browser.newContext();
  page = await context.newPage();
  // Make page available globally or through world
  this.page = page;
});

After(async function(scenario) {
  if (scenario.result?.status === 'FAILED') {
    const screenshot = await page.screenshot();
    this.attach(screenshot, 'image/png');
  }
  await context.close();
});

AfterAll(async function() {
  await browser.close();
});

export { page };
```

### Step 4: Identify Your Top 5 Critical Scenarios

Run this command to see which scenarios are most critical:

```bash
# List all scenarios
grep -n "Scenario:" features/**/*.feature | head -20
```

### Step 5: Run Tests with New Step Definitions

```bash
# Run specific feature
npm run test:e2e -- features/login.feature

# Run with specific tags
npm run test:e2e -- --tags "@critical"
```

### Step 6: Pattern Templates for Common Steps

```typescript
// Field validation patterns
Then('the {string} field should be {string}', async function(fieldName: string, state: string) {
  const field = await page.locator(`[name="${fieldName}"]`);
  switch(state) {
    case 'required':
      await expect(field).toHaveAttribute('required', '');
      break;
    case 'disabled':
      await expect(field).toBeDisabled();
      break;
    case 'invalid':
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      break;
  }
});

// Table/List validations
Then('I should see the following items:', async function(dataTable) {
  const expectedItems = dataTable.raw().flat();
  for (const item of expectedItems) {
    await expect(page.locator(`text="${item}"`)).toBeVisible();
  }
});

// Wait patterns
When('I wait for {int} seconds', async function(seconds: number) {
  await page.waitForTimeout(seconds * 1000);
});

When('I wait for the {string} to load', async function(element: string) {
  await page.waitForSelector(`[data-testid="${element}"], .${element}, #${element}`);
});
```

## Troubleshooting Common Issues

### Issue: Step still showing as undefined
**Solution**: Check that your glob pattern in cucumber config matches your file structure

### Issue: Cannot find page element
**Solution**: Add data-testid attributes to your components:
```tsx
<button data-testid="submit-button">Submit</button>
```

### Issue: Timing issues
**Solution**: Use proper Playwright waits:
```typescript
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible({ timeout: 10000 });
```

## Next Actions After Implementation

1. **Run report**: `npm run test:e2e -- --format html:reports/cucumber-report.html`
2. **Check coverage**: Count defined vs undefined steps
3. **Add to CI**: Create `.github/workflows/e2e-tests.yml`
4. **Share patterns**: Document reusable step patterns for team

---

Remember: Start with ONE scenario working end-to-end before scaling up!