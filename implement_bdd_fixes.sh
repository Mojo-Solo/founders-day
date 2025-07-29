#!/bin/bash

echo "=== BMAD DECIDE Phase: Implementing BDD Fixes ==="
echo

cd /Users/david/Documents/root/founders-day

# 1. Create form-steps.ts
echo "1. Creating form-steps.ts..."
cat > features/step-definitions/common/form-steps.ts << 'EOF'
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../../support/world';

/**
 * Generic form interaction steps
 */

// Fill in form fields by label or placeholder
When('I fill in {string} with {string}', async function (this: CustomWorld, fieldLabel: string, value: string) {
  const { page } = this;
  
  // Try multiple strategies to find the input
  // 1. By label
  const labelElement = await page.locator(`label:has-text("${fieldLabel}")`).first();
  if (await labelElement.count() > 0) {
    const inputId = await labelElement.getAttribute('for');
    if (inputId) {
      await page.fill(`#${inputId}`, value);
      return;
    }
  }
  
  // 2. By placeholder
  const placeholderInput = await page.locator(`input[placeholder*="${fieldLabel}"]`).first();
  if (await placeholderInput.count() > 0) {
    await placeholderInput.fill(value);
    return;
  }
  
  // 3. By name attribute
  const nameInput = await page.locator(`input[name*="${fieldLabel.toLowerCase().replace(/\s+/g, '')}"]`).first();
  if (await nameInput.count() > 0) {
    await nameInput.fill(value);
    return;
  }
  
  // 4. By aria-label
  const ariaInput = await page.locator(`input[aria-label*="${fieldLabel}"]`).first();
  if (await ariaInput.count() > 0) {
    await ariaInput.fill(value);
    return;
  }
  
  // 5. Generic approach - find input near the label text
  await page.locator(`text="${fieldLabel}"`).locator('..').locator('input').first().fill(value);
});

// Click buttons by text
When('I click the {string} button', async function (this: CustomWorld, buttonText: string) {
  const { page } = this;
  
  // Try multiple strategies to find the button
  // 1. Button with exact text
  const exactButton = await page.locator(`button:has-text("${buttonText}")`).first();
  if (await exactButton.count() > 0) {
    await exactButton.click();
    return;
  }
  
  // 2. Input with type="submit" or type="button"
  const inputButton = await page.locator(`input[type="submit"][value="${buttonText}"], input[type="button"][value="${buttonText}"]`).first();
  if (await inputButton.count() > 0) {
    await inputButton.click();
    return;
  }
  
  // 3. Link styled as button
  const linkButton = await page.locator(`a:has-text("${buttonText}")`).first();
  if (await linkButton.count() > 0) {
    await linkButton.click();
    return;
  }
  
  // 4. Any element with role="button"
  await page.locator(`[role="button"]:has-text("${buttonText}")`).first().click();
});

// Verify text on page
Then('I should see {string}', async function (this: CustomWorld, expectedText: string) {
  const { page } = this;
  await expect(page.locator(`text="${expectedText}"`).first()).toBeVisible();
});
EOF

echo "   ✓ Form steps created"

# 2. Create/Update profile-steps.ts
echo -e "\n2. Creating profile-steps.ts..."
cat > features/step-definitions/profile-steps.ts << 'EOF'
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Profile viewing steps
Given('I am on my profile page', async function (this: CustomWorld) {
  const { page } = this;
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
});

When('I navigate to my profile', async function (this: CustomWorld) {
  const { page } = this;
  await page.goto('/profile');
});

Then('I should see my profile information', async function (this: CustomWorld) {
  const { page } = this;
  // Check for common profile elements
  await expect(page.locator('[data-testid="profile-info"]')).toBeVisible();
});

// Profile editing steps
When('I click on {string}', async function (this: CustomWorld, linkText: string) {
  const { page } = this;
  await page.click(`text="${linkText}"`);
});

When('I update my {string} to {string}', async function (this: CustomWorld, field: string, value: string) {
  const { page } = this;
  // Handle different field types
  const fieldMap: { [key: string]: string } = {
    'bio': 'textarea[name="bio"], #bio',
    'location': 'input[name="location"], #location',
    'website': 'input[name="website"], #website'
  };
  
  const selector = fieldMap[field.toLowerCase()] || `input[name="${field.toLowerCase()}"]`;
  await page.fill(selector, value);
});

When('I save my profile changes', async function (this: CustomWorld) {
  const { page } = this;
  await page.click('button:has-text("Save"), input[type="submit"][value*="Save"]');
});

Then('my profile should display {string} as {string}', async function (this: CustomWorld, field: string, value: string) {
  const { page } = this;
  const content = await page.textContent('body');
  expect(content).toContain(value);
});
EOF

echo "   ✓ Profile steps created"

# 3. Update search-steps.ts to remove ambiguity
echo -e "\n3. Updating search-steps.ts..."
if [ -f "features/step-definitions/common/search-steps.ts" ]; then
  # Remove any generic click handlers from search steps
  sed -i.bak '/When.*I click.*button/,/^}/d' features/step-definitions/common/search-steps.ts
  echo "   ✓ Removed ambiguous steps from search-steps.ts"
fi

# 4. Run the tests
echo -e "\n4. Running BDD tests to verify fixes..."
npm run test:bdd 2>&1 | tee test_results.log

# 5. Check results
echo -e "\n5. Checking results..."
if grep -q "6 scenarios.*6 passed" test_results.log; then
  echo -e "\n✅ SUCCESS! All 6 scenarios are now passing!"
else
  echo -e "\n⚠️  Some tests may still need attention. Current status:"
  grep -E "scenarios|steps" test_results.log
fi

echo -e "\nBMAD DECIDE Phase complete."