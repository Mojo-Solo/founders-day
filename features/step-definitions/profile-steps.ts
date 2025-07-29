import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../support/world';
import { expect } from 'chai';

Given('I navigate to my profile page', async function(this: FoundersDayWorld) {
  await this.getPage().goto('/profile');
  await this.getPage().waitForLoadState('networkidle');
});

Then('I should see my profile details:', async function(this: FoundersDayWorld, dataTable: any) {
  const rows = dataTable.hashes();
  const expectedDetails: Record<string, string> = {};
  
  // Convert array of {Field, Value} to object
  for (const row of rows) {
    expectedDetails[row.Field] = row.Value;
  }
  
  // Map from feature file field names to testId attributes
  const fieldMapping: Record<string, string> = {
    'email': 'profile-email',
    'first name': 'profile-first-name',
    'last name': 'profile-last-name',
    'phone': 'profile-phone'
  };
  
  for (const [field, value] of Object.entries(expectedDetails)) {
    const fieldKey = field.toLowerCase();
    const testId = fieldMapping[fieldKey] || `profile-${fieldKey.replace(/\s+/g, '-')}`;
    
    try {
      const fieldElement = await this.getPage().getByTestId(testId);
      const actualValue = await fieldElement.textContent();
      expect(actualValue).to.include(value);
    } catch (error) {
      // Log what testId we're looking for to help debug
      this.attach(`Looking for testId: ${testId} for field: ${field}`, 'text/plain');
      throw error;
    }
  }
});

Then('I should see my registration history', async function(this: FoundersDayWorld) {
  const registrationSection = await this.getPage().getByTestId('registration-history');
  expect(await registrationSection.isVisible()).to.be.true;
});

When('I update my profile with:', async function(this: FoundersDayWorld, dataTable: any) {
  const updates = dataTable.rowsHash();
  
  for (const [field, value] of Object.entries(updates)) {
    await this.getPage().fill(`[name="${field}"]`, String(value));
  }
});

Then('my profile should display:', async function(this: FoundersDayWorld, dataTable: any) {
  const expectedDisplay = dataTable.rowsHash();
  
  for (const [field, value] of Object.entries(expectedDisplay)) {
    const element = await this.getPage().locator(`[data-field="${field}"]`);
    const actualValue = await element.textContent();
    expect(actualValue).to.include(value);
  }
});