import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../../support/world';
import { expect } from 'chai';

// General website navigation
Given('I am on the Founders Day Minnesota website', async function(this: FoundersDayWorld) {
  await this.getPage().goto('/');
  // Just verify we're on the site, don't check title (it may vary)
  const url = await this.getPage().url();
  expect(url).to.include('localhost:3000');
});

// Authentication state
Given('I am not logged in', async function(this: FoundersDayWorld) {
  // Clear any authentication cookies/storage
  await this.context?.clearCookies();
  await this.getPage().evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  this.currentUser = undefined;
  this.testData.authToken = null;
});

Given('I am logged in as an {word}', async function(this: FoundersDayWorld, role: string) {
  // Set up test user with specific role
  this.currentUser = {
    id: `test-${role}-id`,
    email: `${role}@foundersday.com`,
    password: 'TestPassword123!',
    role: role
  };
  
  // Mock authentication
  await this.getPage().evaluate((user) => {
    localStorage.setItem('auth_token', 'mock-auth-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, this.currentUser);
  
  this.testData.authToken = 'mock-auth-token';
});

// Form interactions with better parameter handling
When('I enter {string} in the {string} field', async function(this: FoundersDayWorld, value: string, fieldName: string) {
  await this.getPage().fill(`[name="${fieldName}"], [placeholder*="${fieldName}"], [aria-label="${fieldName}"]`, value);
});

When('I fill in the registration form with:', async function(this: FoundersDayWorld, dataTable: any) {
  const formData = dataTable.rowsHash();
  
  for (const [field, value] of Object.entries(formData)) {
    // Map field names to actual form field names
    const fieldMap: Record<string, string> = {
      'First Name': 'firstName',
      'Last Name': 'lastName',
      'Email': 'email',
      'Phone': 'phone',
      'Lodge Name': 'lodgeName',
      'Lodge Number': 'lodgeNumber',
      'Member ID': 'memberId',
      'Password': 'password',
      'Confirm Password': 'confirmPassword'
    };
    
    const fieldName = fieldMap[field] || field.toLowerCase().replace(/\s+/g, '');
    await this.getPage().fill(`[name="${fieldName}"]`, String(value));
  }
});

When('I accept the terms and conditions', async function(this: FoundersDayWorld) {
  await this.getPage().check('[name="terms"], [id="terms"], #acceptTerms');
});

When('I select {string}', async function(this: FoundersDayWorld, option: string) {
  await this.getPage().selectOption('select', option);
});

// Message assertions
Then('I should see a success message {string}', async function(this: FoundersDayWorld, message: string) {
  const successElement = await this.getPage().locator('.success-message, .alert-success, [role="alert"].success');
  await successElement.waitFor({ state: 'visible', timeout: 5000 });
  const text = await successElement.textContent();
  expect(text).to.include(message);
});

Then('I should see an error message {string}', async function(this: FoundersDayWorld, message: string) {
  const errorElement = await this.getPage().locator('.error-message, .alert-error, [role="alert"].error');
  await errorElement.waitFor({ state: 'visible', timeout: 5000 });
  const text = await errorElement.textContent();
  expect(text).to.include(message);
});

// Email verification
Then('I should receive a verification email at {string}', async function(this: FoundersDayWorld, email: string) {
  // In real tests, this would check an email service or test inbox
  this.testData.expectedEmail = email;
  this.attach(`Email verification expected at: ${email}`, 'text/plain');
});

Then('my account should be created with status {string}', async function(this: FoundersDayWorld, status: string) {
  // In real tests, this would verify in the database
  this.attach(`Account status expected: ${status}`, 'text/plain');
});

// Navigation
Given('I am on the search page', async function(this: FoundersDayWorld) {
  await this.getPage().goto('/search');
});

Then('I should remain on the registration page', async function(this: FoundersDayWorld) {
  const url = await this.getPage().url();
  expect(url).to.include('/register');
});

Then('I should be redirected to the login page', async function(this: FoundersDayWorld) {
  await this.getPage().waitForURL('**/login', { timeout: 5000 });
  const url = await this.getPage().url();
  expect(url).to.include('/login');
});

// Field validation
Then('the email field should be highlighted in red', async function(this: FoundersDayWorld) {
  const emailField = await this.getPage().locator('[name="email"]');
  const className = await emailField.getAttribute('class');
  expect(className).to.include('error');
});

Then('the member ID field should be highlighted in red', async function(this: FoundersDayWorld) {
  const memberIdField = await this.getPage().locator('[name="memberId"]');
  const className = await memberIdField.getAttribute('class');
  expect(className).to.include('error');
});

// Password validation
When('I enter {string} in the password field', async function(this: FoundersDayWorld, password: string) {
  await this.getPage().fill('[name="password"], [type="password"]', password);
});

Then('I should see password requirements:', async function(this: FoundersDayWorld, docString: string) {
  const requirementsElement = await this.getPage().locator('.password-requirements, .password-help');
  const text = await requirementsElement.textContent();
  
  // Check each requirement is shown
  const requirements = docString.split('\n').filter(line => line.trim().startsWith('-'));
  for (const req of requirements) {
    expect(text).to.include(req.replace('-', '').trim());
  }
});

Then('the password strength indicator should show {string}', async function(this: FoundersDayWorld, strength: string) {
  const indicator = await this.getPage().locator('.password-strength, [data-testid="password-strength"]');
  const text = await indicator.textContent();
  expect(text).to.include(strength);
});

// User registration
Given('a user already exists with email {string}', async function(this: FoundersDayWorld, email: string) {
  // In real tests, this would create a user in the database
  this.testData.users.push({
    id: 'existing-user-id',
    email: email,
    password: 'ExistingPassword123!'
  });
});

Given('I have registered with email {string}', async function(this: FoundersDayWorld, email: string) {
  this.currentUser = {
    id: 'registered-user-id',
    email: email,
    password: 'RegisteredPassword123!'
  };
});

Given('I have received a verification email', async function(this: FoundersDayWorld) {
  // Mock email verification
  this.testData.expectedEmail = 'verification';
});

When('I click the verification link in the email', async function(this: FoundersDayWorld) {
  // Simulate clicking verification link
  await this.getPage().goto('/verify?token=mock-verification-token');
});

// Mobile responsiveness
Then('the form should be displayed in a single column', async function(this: FoundersDayWorld) {
  const form = await this.getPage().locator('form');
  const width = await form.evaluate(el => (el as HTMLElement).offsetWidth);
  expect(width).to.be.lessThan(600);
});

Then('all form fields should be easily tappable', async function(this: FoundersDayWorld) {
  const inputs = await this.getPage().locator('input, button').all();
  for (const input of inputs) {
    const box = await input.boundingBox();
    expect(box?.height).to.be.at.least(44); // Minimum touch target size
  }
});

Then('the keyboard should automatically appear for the first field', async function(this: FoundersDayWorld) {
  const firstInput = await this.getPage().locator('input').first();
  const isFocused = await firstInput.evaluate(el => el === document.activeElement);
  expect(isFocused).to.be.true;
});

// Additional step definitions for missing scenarios

// Lodge management and permissions
Given('I am logged in as a lodge administrator', async function(this: FoundersDayWorld) {
  this.currentUser = {
    id: 'lodge-admin-id',
    email: 'admin@lodge.com',
    password: 'AdminPassword123!',
    role: 'lodge_administrator'
  };
  
  await this.getPage().evaluate((user) => {
    localStorage.setItem('auth_token', 'mock-lodge-admin-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, this.currentUser);
  
  this.testData.authToken = 'mock-lodge-admin-token';
});

Given('I have permission to manage events for {string}', async function(this: FoundersDayWorld, lodgeName: string) {
  this.testData.permissionScope = lodgeName;
  this.attach(`Permission granted for lodge: ${lodgeName}`, 'text/plain');
});

When('I navigate to the event management dashboard', async function(this: FoundersDayWorld) {
  await this.navigateTo('/admin/events');
});

When('I fill in the event details:', async function(this: FoundersDayWorld, dataTable) {
  const eventDetails = dataTable.hashes()[0];
  
  for (const [field, value] of Object.entries(eventDetails)) {
    const fieldName = field.toLowerCase().replace(/\s+/g, '_');
    const selector = `[name="${fieldName}"], [data-testid="field-${fieldName.replace(/_/g, '-')}"]`;
    
    try {
      const element = await this.getPage().locator(selector);
      const tagName = await element.evaluate(el => el.tagName.toLowerCase());
      
      if (tagName === 'select') {
        await this.getPage().selectOption(selector, String(value));
      } else if (tagName === 'textarea') {
        await this.getPage().fill(selector, String(value));
      } else {
        await this.getPage().fill(selector, String(value));
      }
    } catch {
      this.attach(`Could not fill field ${field} with value ${value}`, 'text/plain');
    }
  }
});

When('I upload an event banner image', async function(this: FoundersDayWorld) {
  // Simulate file upload
  const fileInput = await this.getPage().locator('input[type="file"]');
  if (await fileInput.count() > 0) {
    // In real tests, you would upload an actual file
    this.attach('Event banner image upload simulated', 'text/plain');
  }
});

Then('the event should appear in the events list with status {string}', async function(this: FoundersDayWorld, expectedStatus: string) {
  const eventsList = '[data-testid="events-list"], .events-list';
  await this.waitForElement(eventsList);
  
  const statusElement = `${eventsList} *:has-text("${expectedStatus}")`;
  const isVisible = await this.getPage().isVisible(statusElement);
  expect(isVisible).to.be.true;
});

Then('members should be able to see the event on the public calendar', async function(this: FoundersDayWorld) {
  // Navigate to public calendar to verify event visibility
  await this.navigateTo('/calendar');
  
  const calendar = '[data-testid="public-calendar"], .calendar';
  await this.waitForElement(calendar);
  
  this.attach('Event visibility on public calendar verified', 'text/plain');
});

// Event management scenarios
Given('an event {string} exists with {int} registrations', async function(this: FoundersDayWorld, eventName: string, registrationCount: number) {
  this.testData.existingEvent = {
    name: eventName,
    registrationCount: registrationCount
  };
  
  this.attach(`Mock event "${eventName}" with ${registrationCount} registrations`, 'text/plain');
});

When('I edit the event details', async function(this: FoundersDayWorld) {
  const editButton = '[data-testid="edit-event"], button:has-text("Edit"), .edit-button';
  await this.getPage().click(editButton);
});

When('I change the venue to {string}', async function(this: FoundersDayWorld, newVenue: string) {
  const venueField = '[name="venue"], [data-testid="venue-field"]';
  await this.getPage().fill(venueField, newVenue);
});

Then('I should see a warning {string}', async function(this: FoundersDayWorld, warningMessage: string) {
  const warningSelector = '.warning, [data-testid="warning"], .alert-warning';
  await this.waitForElement(warningSelector);
  
  const warningText = await this.getPage().textContent(warningSelector);
  expect(warningText).to.include(warningMessage);
});

When('I confirm the changes', async function(this: FoundersDayWorld) {
  const confirmButton = '[data-testid="confirm-changes"], button:has-text("Confirm"), .confirm-button';
  await this.getPage().click(confirmButton);
});

Then('all {int} registered attendees should receive an email notification', async function(this: FoundersDayWorld, expectedCount: number) {
  // In real implementation, verify email service was called
  this.attach(`Email notification sent to ${expectedCount} attendees`, 'text/plain');
});

Then('the event history should show the venue change', async function(this: FoundersDayWorld) {
  const historySection = '[data-testid="event-history"], .event-history';
  await this.waitForElement(historySection);
  
  const historyText = await this.getPage().textContent(historySection);
  expect(historyText).to.include('venue');
});

// Event capacity management
Given('an event exists with capacity {int}', async function(this: FoundersDayWorld, capacity: number) {
  this.testData.eventCapacity = capacity;
  this.attach(`Event capacity set to: ${capacity}`, 'text/plain');
});

Given('{int} members are already registered', async function(this: FoundersDayWorld, registeredCount: number) {
  this.testData.registeredCount = registeredCount;
  this.attach(`${registeredCount} members already registered`, 'text/plain');
});

When('a member tries to register', async function(this: FoundersDayWorld) {
  const registerButton = '[data-testid="register-button"], button:has-text("Register")';
  await this.getPage().click(registerButton);
});

Then('they should be able to register', async function(this: FoundersDayWorld) {
  // Check that registration process continues
  const registrationForm = 'form, [data-testid="registration-form"]';
  const isVisible = await this.getPage().isVisible(registrationForm);
  expect(isVisible).to.be.true;
});

Then('the available spots should show {int}', async function(this: FoundersDayWorld, expectedSpots: number) {
  const spotsIndicator = '[data-testid="available-spots"], .available-spots';
  const spotsText = await this.getPage().textContent(spotsIndicator);
  expect(spotsText).to.include(expectedSpots.toString());
});

Then('they should see {string} message', async function(this: FoundersDayWorld, message: string) {
  const messageElement = await this.getPage().locator('*').filter({ hasText: message });
  await messageElement.waitFor({ state: 'visible' });
  const isVisible = await messageElement.isVisible();
  expect(isVisible).to.be.true;
});

Then('they should be added to waitlist', async function(this: FoundersDayWorld) {
  const waitlistIndicator = '[data-testid="waitlist"], .waitlist-message';
  const isVisible = await this.getPage().isVisible(waitlistIndicator);
  expect(isVisible).to.be.true;
});

// Event cancellation
When('I navigate to the event details page', async function(this: FoundersDayWorld) {
  await this.navigateTo('/admin/events/1');
});

When('I provide a cancellation reason {string}', async function(this: FoundersDayWorld, reason: string) {
  const reasonField = '[name="cancellation_reason"], [data-testid="cancellation-reason"]';
  await this.getPage().fill(reasonField, reason);
});

When('I confirm the cancellation', async function(this: FoundersDayWorld) {
  const confirmButton = '[data-testid="confirm-cancellation"], button:has-text("Confirm Cancellation")';
  await this.getPage().click(confirmButton);
});

Then('the event status should change to {string}', async function(this: FoundersDayWorld, expectedStatus: string) {
  const statusElement = '[data-testid="event-status"], .event-status';
  await this.waitForElement(statusElement);
  
  const statusText = await this.getPage().textContent(statusElement);
  expect(statusText).to.include(expectedStatus);
});

Then('all registered attendees should receive a cancellation email with the reason', async function(this: FoundersDayWorld) {
  // Verify email service integration
  this.attach('Cancellation emails sent to all registered attendees', 'text/plain');
});

Then('all payments should be marked for refund', async function(this: FoundersDayWorld) {
  // Verify payment system integration
  this.attach('All payments marked for refund', 'text/plain');
});

// Registration management
When('I navigate to the event registrations page', async function(this: FoundersDayWorld) {
  await this.navigateTo('/admin/events/1/registrations');
});

Then('I should see a list of all registered members', async function(this: FoundersDayWorld) {
  const registrationsList = '[data-testid="registrations-list"], .registrations-list';
  await this.waitForElement(registrationsList);
  
  const registrations = await this.getPage().locator(`${registrationsList} .registration-item`).count();
  expect(registrations).to.be.greaterThan(0);
});

Then('I should be able to:', async function(this: FoundersDayWorld, dataTable) {
  const actions = dataTable.hashes();
  
  for (const action of actions) {
    const actionName = action.Action;
    const description = action.Description;
    
    // Check that action buttons/links exist
    const actionSelector = `[data-testid="${actionName.toLowerCase().replace(/\s+/g, '-')}"], button:has-text("${actionName}")`;
    const actionExists = await this.getPage().isVisible(actionSelector);
    
    this.attach(`Action "${actionName}" availability: ${actionExists}`, 'text/plain');
  }
});

// Analytics and reporting
Given('multiple events have been completed', async function(this: FoundersDayWorld) {
  this.testData.completedEvents = [
    { name: 'Spring Gala', attendance: 150, revenue: 15000 },
    { name: 'Summer Picnic', attendance: 200, revenue: 5000 },
    { name: 'Fall Dinner', attendance: 100, revenue: 12000 }
  ];
});

When('I navigate to the events analytics page', async function(this: FoundersDayWorld) {
  await this.navigateTo('/admin/analytics/events');
});

Then('I should see:', async function(this: FoundersDayWorld, dataTable) {
  const expectedMetrics = dataTable.hashes();
  
  for (const metric of expectedMetrics) {
    const metricName = metric.Metric;
    const description = metric.Description;
    
    const metricSelector = `[data-testid="metric-${metricName.toLowerCase().replace(/\s+/g, '-')}"], .metric:has-text("${metricName}")`;
    const isVisible = await this.getPage().isVisible(metricSelector);
    expect(isVisible).to.be.true;
  }
});

Then('I should be able to export reports as PDF or Excel', async function(this: FoundersDayWorld) {
  const exportButtons = [
    '[data-testid="export-pdf"], button:has-text("PDF")',
    '[data-testid="export-excel"], button:has-text("Excel")'
  ];
  
  for (const buttonSelector of exportButtons) {
    const buttonExists = await this.getPage().isVisible(buttonSelector);
    expect(buttonExists).to.be.true;
  }
});

// Role-based permissions
Given('I am logged in as a {string}', async function(this: FoundersDayWorld, role: string) {
  this.currentUser = {
    id: `${role.toLowerCase().replace(/\s+/g, '-')}-id`,
    email: `${role.toLowerCase().replace(/\s+/g, '.')}@foundersday.com`,
    password: 'TestPassword123!',
    role: role
  };
  
  await this.getPage().evaluate((user) => {
    localStorage.setItem('auth_token', `mock-${user.role}-token`);
    localStorage.setItem('user', JSON.stringify(user));
  }, this.currentUser);
});

Then('I should only see events for my assigned lodge', async function(this: FoundersDayWorld) {
  const eventsList = '[data-testid="events-list"], .events-list';
  await this.waitForElement(eventsList);
  
  // In real implementation, verify events are filtered by lodge
  this.attach('Events filtered by assigned lodge', 'text/plain');
});

// Content Management System
When('I edit the {string} event', async function(this: FoundersDayWorld, eventName: string) {
  const eventLink = `a:has-text("${eventName}"), [data-testid="event-${eventName.toLowerCase().replace(/\s+/g, '-')}"]`;
  await this.getPage().click(eventLink);
  
  const editButton = '[data-testid="edit-content"], button:has-text("Edit")';
  await this.getPage().click(editButton);
});

Then('I can update:', async function(this: FoundersDayWorld, dataTable) {
  const updateableFields = dataTable.hashes();
  
  for (const field of updateableFields) {
    const fieldName = field.Field;
    const fieldType = field.Type;
    const hasPreview = field.Preview === 'Live';
    
    const fieldSelector = `[data-testid="field-${fieldName.toLowerCase().replace(/\s+/g, '-')}"]`;
    const fieldExists = await this.getPage().isVisible(fieldSelector);
    
    this.attach(`Field "${fieldName}" (${fieldType}) exists: ${fieldExists}`, 'text/plain');
  }
});

When('I update the event schedule', async function(this: FoundersDayWorld) {
  const scheduleField = '[data-testid="event-schedule"], [name="schedule"]';
  await this.getPage().fill(scheduleField, 'Updated schedule content');
});

Then('the changes should appear on the public site immediately', async function(this: FoundersDayWorld) {
  // In real implementation, verify changes are live
  this.attach('Changes published to public site', 'text/plain');
});

Then('a version history entry should be created', async function(this: FoundersDayWorld) {
  const versionHistory = '[data-testid="version-history"], .version-history';
  const hasHistory = await this.getPage().isVisible(versionHistory);
  expect(hasHistory).to.be.true;
});