import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../../support/world';
import { expect } from 'chai';

// Admin authentication
Given('I am logged in as an admin with email {string}', async function(this: FoundersDayWorld, email: string) {
  this.currentUser = {
    id: 'admin-user-id',
    email: email,
    password: 'AdminPassword123!',
    role: 'admin'
  };
  
  // Navigate to site first to access localStorage
  await this.getPage().goto('/');
  
  // Mock admin authentication
  await this.getPage().evaluate((user: any) => {
    localStorage.setItem('auth_token', 'mock-admin-token');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isAdmin', 'true');
  }, this.currentUser);
  
  this.testData.authToken = 'mock-admin-token';
});

// Admin navigation
Given('I am on the admin dashboard', async function(this: FoundersDayWorld) {
  await this.getPage().goto('/admin/dashboard');
});

When('I navigate to the admin section', async function(this: FoundersDayWorld) {
  await this.getPage().goto('/admin');
});

// Dashboard metrics
Given('the dashboard is displaying current metrics:', async function(this: FoundersDayWorld, dataTable: any) {
  const metrics = dataTable.rowsHash();
  
  // Store metrics in test data
  this.testData.currentMetrics = metrics;
  
  // In real tests, this would verify the displayed metrics
  for (const [metric, value] of Object.entries(metrics)) {
    const metricElement = await this.getPage().locator(`[data-metric="${metric}"]`);
    await metricElement.waitFor({ state: 'visible' });
  }
});

// Event capacity management
Given('the event has a capacity of {string} attendees', async function(this: FoundersDayWorld, capacity: string) {
  this.testData.eventCapacity = parseInt(capacity);
});

Given('{string} tickets have been sold', async function(this: FoundersDayWorld, soldCount: string) {
  this.testData.ticketsSold = parseInt(soldCount);
});

// Real-time updates
When('a new registration is completed for {string} tickets at {string} each', async function(this: FoundersDayWorld, ticketCount: string, price: string) {
  // Simulate new registration
  const registration = {
    id: 'new-registration-id',
    ticketCount: parseInt(ticketCount),
    pricePerTicket: parseFloat(price.replace('$', '')),
    timestamp: new Date().toISOString()
  };
  
  this.testData.lastRegistration = registration;
  
  // In real tests, this would trigger a real-time event
  await this.getPage().evaluate((reg: any) => {
    window.dispatchEvent(new CustomEvent('newRegistration', { detail: reg }));
  }, registration);
});

Then('within {string} seconds the dashboard should update to show:', async function(this: FoundersDayWorld, seconds: string, dataTable: any) {
  const timeout = parseInt(seconds) * 1000;
  const expectedMetrics = dataTable.rowsHash();
  
  // Wait for updates with timeout
  await this.getPage().waitForTimeout(500); // Small delay for updates
  
  for (const [metric, value] of Object.entries(expectedMetrics)) {
    const metricElement = await this.getPage().locator(`[data-metric="${metric}"]`);
    await metricElement.waitFor({ state: 'visible', timeout });
    const actualValue = await metricElement.textContent();
    expect(actualValue).to.include(value);
  }
});

// Notifications
Then('a notification should appear {string}', async function(this: FoundersDayWorld, message: string) {
  const notification = await this.getPage().locator('.notification, .toast, [role="alert"]');
  await notification.waitFor({ state: 'visible', timeout: 5000 });
  const text = await notification.textContent();
  expect(text).to.include(message);
});

// Registration management
Given('there are {string} registered attendees', async function(this: FoundersDayWorld, count: string) {
  this.testData.registeredCount = parseInt(count);
});

Given('{string} have dietary restrictions', async function(this: FoundersDayWorld, count: string) {
  this.testData.dietaryRestrictionsCount = parseInt(count);
});

// Export functionality
Then('I should see export options:', async function(this: FoundersDayWorld, dataTable: any) {
  const options = dataTable.raw().flat();
  
  for (const option of options) {
    const exportOption = await this.getPage().locator(`text=${option}`);
    await exportOption.waitFor({ state: 'visible' });
  }
});

Then('a CSV file should be downloaded with the search results', async function(this: FoundersDayWorld) {
  // In real tests, this would verify file download
  const downloadPromise = this.getPage().waitForEvent('download');
  await this.getPage().click('text=Download');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).to.include('.csv');
});

// Email campaigns
When('I create a new email campaign', async function(this: FoundersDayWorld) {
  await this.getPage().click('text=New Campaign');
});

When('I select the segment {string}', async function(this: FoundersDayWorld, segment: string) {
  await this.getPage().selectOption('[name="segment"]', segment);
});

Then('{string} recipients should be selected', async function(this: FoundersDayWorld, count: string) {
  const recipientCount = await this.getPage().locator('[data-testid="recipient-count"]');
  const text = await recipientCount.textContent();
  expect(text).to.include(count);
});

When('I use the template {string}', async function(this: FoundersDayWorld, templateName: string) {
  await this.getPage().selectOption('[name="template"]', templateName);
});

When('I customize the content:', async function(this: FoundersDayWorld, content: string) {
  await this.getPage().fill('[name="emailContent"], textarea[name="content"]', content);
});

Then('the campaign should be queued for delivery', async function(this: FoundersDayWorld) {
  const status = await this.getPage().locator('[data-testid="campaign-status"]');
  const text = await status.textContent();
  expect(text).to.include('Queued');
});

// Capacity warnings
When('I view the capacity warning', async function(this: FoundersDayWorld) {
  const warning = await this.getPage().locator('.capacity-warning, [data-testid="capacity-warning"]');
  await warning.waitFor({ state: 'visible' });
});

// Note: Click steps are defined in form-steps.ts to avoid ambiguity

Then('I can:', async function(this: FoundersDayWorld, dataTable: any) {
  const actions = dataTable.rows();
  
  for (const [action, result] of actions) {
    const actionButton = await this.getPage().locator(`text=${action}`);
    expect(await actionButton.isVisible()).to.be.true;
  }
});

// Recent registrations
Then('the recent registrations list should show the new attendee at the top', async function(this: FoundersDayWorld) {
  const firstRegistration = await this.getPage().locator('[data-testid="registration-list"] > *').first();
  const text = await firstRegistration.textContent();
  expect(text).to.include('new');
});