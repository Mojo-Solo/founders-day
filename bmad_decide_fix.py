#!/usr/bin/env python3
"""BMAD DECIDE Phase: Implement fixes for 100% test success"""

import os
import re
import subprocess

os.chdir('/Users/david/Documents/root/founders-day')

# Define the fixes needed
FORM_STEPS_CONTENT = '''import { Given, When, Then } from '@cucumber/cucumber';
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
  const nameInput = await page.locator(`input[name*="${fieldLabel.toLowerCase().replace(/\\s+/g, '')}"]`).first();
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

// Submit forms
When('I submit the form', async function (this: CustomWorld) {
  const { page } = this;
  await page.locator('form').first().evaluate(form => form.submit());
});

// Check/uncheck checkboxes
When('I check {string}', async function (this: CustomWorld, checkboxLabel: string) {
  const { page } = this;
  await page.locator(`label:has-text("${checkboxLabel}")`).locator('input[type="checkbox"]').check();
});

When('I uncheck {string}', async function (this: CustomWorld, checkboxLabel: string) {
  const { page } = this;
  await page.locator(`label:has-text("${checkboxLabel}")`).locator('input[type="checkbox"]').uncheck();
});

// Select from dropdowns
When('I select {string} from {string}', async function (this: CustomWorld, option: string, selectLabel: string) {
  const { page } = this;
  
  // Find select by label
  const labelElement = await page.locator(`label:has-text("${selectLabel}")`).first();
  if (await labelElement.count() > 0) {
    const selectId = await labelElement.getAttribute('for');
    if (selectId) {
      await page.selectOption(`#${selectId}`, option);
      return;
    }
  }
  
  // Find select near label text
  await page.locator(`text="${selectLabel}"`).locator('..').locator('select').first().selectOption(option);
});

// Verify form field values
Then('the {string} field should contain {string}', async function (this: CustomWorld, fieldLabel: string, expectedValue: string) {
  const { page } = this;
  
  // Try multiple strategies to find the input
  let actualValue = '';
  
  // 1. By label
  const labelElement = await page.locator(`label:has-text("${fieldLabel}")`).first();
  if (await labelElement.count() > 0) {
    const inputId = await labelElement.getAttribute('for');
    if (inputId) {
      actualValue = await page.inputValue(`#${inputId}`);
    }
  }
  
  if (!actualValue) {
    // 2. By placeholder
    const placeholderInput = await page.locator(`input[placeholder*="${fieldLabel}"]`).first();
    if (await placeholderInput.count() > 0) {
      actualValue = await placeholderInput.inputValue();
    }
  }
  
  if (!actualValue) {
    // 3. Generic approach
    actualValue = await page.locator(`text="${fieldLabel}"`).locator('..').locator('input').first().inputValue();
  }
  
  expect(actualValue).toBe(expectedValue);
});

// Clear form fields
When('I clear the {string} field', async function (this: CustomWorld, fieldLabel: string) {
  const { page } = this;
  
  // Find and clear the input using similar strategies as fill
  const labelElement = await page.locator(`label:has-text("${fieldLabel}")`).first();
  if (await labelElement.count() > 0) {
    const inputId = await labelElement.getAttribute('for');
    if (inputId) {
      await page.fill(`#${inputId}`, '');
      return;
    }
  }
  
  // Try other strategies
  const placeholderInput = await page.locator(`input[placeholder*="${fieldLabel}"]`).first();
  if (await placeholderInput.count() > 0) {
    await placeholderInput.fill('');
    return;
  }
  
  // Generic approach
  await page.locator(`text="${fieldLabel}"`).locator('..').locator('input').first().fill('');
});
'''

PROFILE_STEPS_UPDATE = '''import { Given, When, Then } from '@cucumber/cucumber';
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

Then('I should see {string}', async function (this: CustomWorld, message: string) {
  const { page } = this;
  await expect(page.locator(`text="${message}"`)).toBeVisible();
});

Then('my profile should display {string} as {string}', async function (this: CustomWorld, field: string, value: string) {
  const { page } = this;
  const content = await page.textContent('body');
  expect(content).toContain(value);
});
'''

NAVIGATION_STEPS_UPDATE = '''import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../../support/world';

// Basic navigation
Given('I am on the {string} page', async function (this: CustomWorld, pageName: string) {
  const { page } = this;
  
  const pageMap: { [key: string]: string } = {
    'home': '/',
    'login': '/login',
    'registration': '/register',
    'profile': '/profile',
    'search': '/search',
    'dashboard': '/dashboard'
  };
  
  const path = pageMap[pageName.toLowerCase()] || `/${pageName.toLowerCase()}`;
  await page.goto(path);
  await page.waitForLoadState('networkidle');
});

When('I navigate to the {string} page', async function (this: CustomWorld, pageName: string) {
  const { page } = this;
  
  const pageMap: { [key: string]: string } = {
    'home': '/',
    'login': '/login',
    'registration': '/register',
    'profile': '/profile',
    'search': '/search',
    'dashboard': '/dashboard'
  };
  
  const path = pageMap[pageName.toLowerCase()] || `/${pageName.toLowerCase()}`;
  await page.goto(path);
});

When('I click on the {string} link', async function (this: CustomWorld, linkText: string) {
  const { page } = this;
  await page.click(`a:has-text("${linkText}")`);
});

Then('I should be on the {string} page', async function (this: CustomWorld, pageName: string) {
  const { page } = this;
  
  const pageMap: { [key: string]: string } = {
    'home': '/',
    'login': '/login',
    'registration': '/register',
    'profile': '/profile',
    'search': '/search',
    'dashboard': '/dashboard'
  };
  
  const expectedPath = pageMap[pageName.toLowerCase()] || `/${pageName.toLowerCase()}`;
  await expect(page).toHaveURL(new RegExp(expectedPath));
});

// Browser navigation
When('I go back', async function (this: CustomWorld) {
  const { page } = this;
  await page.goBack();
});

When('I go forward', async function (this: CustomWorld) {
  const { page } = this;
  await page.goForward();
});

When('I refresh the page', async function (this: CustomWorld) {
  const { page } = this;
  await page.reload();
});

// URL verification
Then('the URL should contain {string}', async function (this: CustomWorld, urlPart: string) {
  const { page } = this;
  await expect(page).toHaveURL(new RegExp(urlPart));
});
'''

def update_search_steps():
    """Remove ambiguous steps from search-steps.ts"""
    search_steps_path = 'features/step-definitions/common/search-steps.ts'
    if os.path.exists(search_steps_path):
        with open(search_steps_path, 'r') as f:
            content = f.read()
        
        # Remove any duplicate click handlers that might conflict
        # Keep only search-specific steps
        lines = content.split('\n')
        filtered_lines = []
        skip_next = False
        
        for i, line in enumerate(lines):
            if skip_next:
                skip_next = False
                continue
                
            # Skip generic click handlers in search steps
            if "When('I click" in line and 'search' not in line.lower():
                # Skip this line and the function body
                j = i + 1
                while j < len(lines) and not lines[j].strip().startswith(('When(', 'Then(', 'Given(')):
                    j += 1
                skip_next = j - i - 1
                continue
                
            filtered_lines.append(line)
        
        new_content = '\n'.join(filtered_lines)
        with open(search_steps_path, 'w') as f:
            f.write(new_content)
        print(f"Updated {search_steps_path} to remove ambiguous steps")

def implement_fixes():
    """Implement all the fixes"""
    print("=== BMAD DECIDE PHASE: Implementing Fixes ===\n")
    
    # 1. Create/Update form-steps.ts
    form_steps_path = 'features/step-definitions/common/form-steps.ts'
    print(f"1. Creating {form_steps_path}...")
    with open(form_steps_path, 'w') as f:
        f.write(FORM_STEPS_CONTENT)
    print("   ✓ Form steps created")
    
    # 2. Update profile-steps.ts
    profile_steps_path = 'features/step-definitions/profile-steps.ts'
    print(f"\n2. Creating/Updating {profile_steps_path}...")
    with open(profile_steps_path, 'w') as f:
        f.write(PROFILE_STEPS_UPDATE)
    print("   ✓ Profile steps updated")
    
    # 3. Update navigation-steps.ts
    nav_steps_path = 'features/step-definitions/common/navigation-steps.ts'
    print(f"\n3. Updating {nav_steps_path}...")
    if os.path.exists(nav_steps_path):
        # Read existing content to preserve any custom steps
        with open(nav_steps_path, 'r') as f:
            existing_content = f.read()
        
        # If it's mostly empty or just imports, replace it
        if len(existing_content.strip()) < 200:
            with open(nav_steps_path, 'w') as f:
                f.write(NAVIGATION_STEPS_UPDATE)
            print("   ✓ Navigation steps replaced")
        else:
            # Append our steps
            with open(nav_steps_path, 'a') as f:
                f.write("\n\n// Additional navigation steps\n")
                f.write(NAVIGATION_STEPS_UPDATE)
            print("   ✓ Navigation steps appended")
    else:
        with open(nav_steps_path, 'w') as f:
            f.write(NAVIGATION_STEPS_UPDATE)
        print("   ✓ Navigation steps created")
    
    # 4. Fix search ambiguity
    print("\n4. Resolving search step ambiguities...")
    update_search_steps()
    
    # 5. Run tests to verify fixes
    print("\n5. Running tests to verify fixes...")
    result = subprocess.run(['npm', 'run', 'test:bdd'], capture_output=True, text=True)
    
    # Parse results
    output = result.stdout + result.stderr
    if '6 scenarios' in output and '6 passed' in output:
        print("\n✅ SUCCESS! All tests are now passing!")
    else:
        print("\n⚠️  Some tests may still be failing. Output:")
        print(output)
    
    # Save the final report
    report = {
        'phase': 'DECIDE',
        'actions_taken': [
            'Created form-steps.ts with generic form interaction steps',
            'Updated profile-steps.ts to fix step definition patterns',
            'Updated navigation-steps.ts with comprehensive navigation steps',
            'Resolved search step ambiguities'
        ],
        'test_output': output,
        'success': '6 passed' in output
    }
    
    with open('BMAD-DECIDE-REPORT.json', 'w') as f:
        import json
        json.dump(report, f, indent=2)
    
    print("\n\nReport saved to BMAD-DECIDE-REPORT.json")
    
    return report

if __name__ == '__main__':
    implement_fixes()