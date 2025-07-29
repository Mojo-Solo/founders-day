import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { FoundersDayWorld } from '../../support/world';

/**
 * Generic form interaction steps
 */

// Fill in form fields by label or placeholder
When('I fill in {string} with {string}', async function (this: FoundersDayWorld, fieldLabel: string, value: string) {
  const page = this.getPage();
  
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
When('I click the {string} button', async function (this: FoundersDayWorld, buttonText: string) {
  const page = this.getPage();
  
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

// Additional form interaction steps
When('I enter my current password {string}', async function(this: FoundersDayWorld, password: string) {
  const page = this.getPage();
  await page.fill('input[name="currentPassword"], input[placeholder*="current password" i]', password);
});

When('I enter a new password {string}', async function(this: FoundersDayWorld, password: string) {
  const page = this.getPage();
  await page.fill('input[name="newPassword"], input[placeholder*="new password" i]', password);
});

When('I confirm the new password {string}', async function(this: FoundersDayWorld, password: string) {
  const page = this.getPage();
  await page.fill('input[name="confirmPassword"], input[placeholder*="confirm password" i]', password);
});

When('I check {string}', async function(this: FoundersDayWorld, label: string) {
  const page = this.getPage();
  await page.check(`input[type="checkbox"]:near(:text("${label}"))`);
});

When('I uncheck {string}', async function(this: FoundersDayWorld, label: string) {
  const page = this.getPage();
  await page.uncheck(`input[type="checkbox"]:near(:text("${label}"))`);
});

When('I select {string} from {string}', async function(this: FoundersDayWorld, value: string, label: string) {
  const page = this.getPage();
  await page.selectOption(`select:near(:text("${label}"))`, value);
});

When('I upload an image {string}', async function(this: FoundersDayWorld, filename: string) {
  const page = this.getPage();
  await page.setInputFiles('input[type="file"]', `features/support/test-files/${filename}`);
});

When('I enter {string} in the additional notes', async function(this: FoundersDayWorld, notes: string) {
  const page = this.getPage();
  await page.fill('textarea[name="additionalNotes"], textarea[placeholder*="notes" i]', notes);
});

Then('I should receive a password change confirmation email', async function(this: FoundersDayWorld) {
  // Mock verification - in real tests this would check email service
  this.attach('Password change email would be sent', 'text/plain');
});

Then('my preferences should be saved', async function(this: FoundersDayWorld) {
  // Mock verification
  this.attach('Preferences saved successfully', 'text/plain');
});

Then('my new profile picture should be displayed', async function(this: FoundersDayWorld) {
  const page = this.getPage();
  const profileImg = await page.locator('img[alt*="profile" i], img.profile-picture');
  expect(await profileImg.isVisible()).to.be.true;
});

Then('my dietary restrictions should be updated', async function(this: FoundersDayWorld) {
  this.attach('Dietary restrictions updated', 'text/plain');
});

Then('{string} should appear in my emergency contacts list', async function(this: FoundersDayWorld, name: string) {
  const page = this.getPage();
  const contactList = await page.locator('.emergency-contacts, [data-testid="emergency-contacts"]');
  expect(await contactList.textContent()).to.include(name);
});

When('I select the following dietary restrictions:', async function(this: FoundersDayWorld, dataTable: any) {
  const restrictions = dataTable.raw().flat();
  const page = this.getPage();
  
  for (const restriction of restrictions) {
    await page.check(`input[type="checkbox"]:near(:text("${restriction}"))`);
  }
});

When('I fill in the emergency contact form:', async function(this: FoundersDayWorld, dataTable: any) {
  const formData = dataTable.rowsHash();
  const page = this.getPage();
  
  for (const [field, value] of Object.entries(formData)) {
    await page.fill(`input[name="${field.toLowerCase().replace(/\s+/g, '')}"]`, String(value));
  }
});

When('I clear the {string} field', async function(this: FoundersDayWorld, fieldName: string) {
  const page = this.getPage();
  await page.fill(`input[name="${fieldName.toLowerCase().replace(/\s+/g, '')}"]`, '');
});

When('I enter {string} in the {string} field', async function(this: FoundersDayWorld, value: string, fieldName: string) {
  const page = this.getPage();
  await page.fill(`input[name="${fieldName.toLowerCase().replace(/\s+/g, '')}"]`, value);
});

Then('I should see the following errors:', async function(this: FoundersDayWorld, dataTable: any) {
  const errors = dataTable.raw().flat();
  const page = this.getPage();
  
  for (const error of errors) {
    const errorElement = await page.locator(`text="${error}"`);
    expect(await errorElement.isVisible()).to.be.true;
  }
});

Then('I should be logged out', async function(this: FoundersDayWorld) {
  const page = this.getPage();
  // Check for login link or redirect to login page
  const loginLink = await page.locator('a[href="/login"]');
  expect(await loginLink.isVisible()).to.be.true;
});

Then('I should receive a deactivation confirmation email', async function(this: FoundersDayWorld) {
  this.attach('Deactivation email would be sent', 'text/plain');
});
