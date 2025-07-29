import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../../support/world';
import { expect } from 'chai';
// import { createTestUser } from '@founders-day/test-utils';

Given('the test environment is configured', async function(this: FoundersDayWorld) {
  // Verify basic configuration
  expect(this.apiUrl).to.exist;
  expect(this.testData).to.exist;
  
  this.attach('Test environment configured successfully', 'text/plain');
});

When('I run a simple test', async function(this: FoundersDayWorld) {
  // Perform a simple operation
  this.testData.testRun = true;
  this.attach('Simple test executed', 'text/plain');
});

Then('the test should pass successfully', async function(this: FoundersDayWorld) {
  // Verify the test ran
  expect(this.testData.testRun).to.equal(true);
  this.attach('Test passed successfully', 'text/plain');
});

Given('I am logged in as {string}', { timeout: 30000 }, async function(this: FoundersDayWorld, email: string) {
  // Create or use test user
  const testUser = {
    email: email,
    password: 'TestPassword123!',
    id: `test-user-${Date.now()}`
  };
  this.testData.currentUser = testUser;
  
  // Navigate to login page
  await this.getPage().goto('/login');
  
  // Fill login form
  await this.getPage().fill('[name="email"]', email);
  await this.getPage().fill('[name="password"]', 'TestPassword123!');
  
  // For mocked tests, simulate successful login and navigate
  await this.getPage().evaluate((userEmail) => {
    localStorage.setItem('auth_token', 'mock-auth-token');
    localStorage.setItem('user_email', userEmail);
  }, email);
  
  // Navigate directly to profile page
  await this.getPage().goto('/profile');
  
  // Store auth token in context
  this.testData.authToken = 'mock-auth-token';
  
  this.attach(`Logged in as ${email}`, 'text/plain');
});

Given('I am on the homepage', async function(this: FoundersDayWorld) {
  await this.retryOperation(async () => {
    const page = this.getPage();
    
    // Navigate with optimized settings for speed
    await page.goto('/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Faster page readiness check with shorter timeouts
    await Promise.race([
      page.waitForLoadState('domcontentloaded', { timeout: 3000 }),
      page.waitForSelector('body', { timeout: 3000 }),
      new Promise(resolve => setTimeout(resolve, 2000)) // Max 2 second wait
    ]).catch(() => {
      // Continue even if load state check fails
    });
    
    // Quick error state check
    const hasError = await page.locator('.error, [data-testid="error"]').count() > 0;
    if (hasError) {
      const errorContent = await page.locator('.error, [data-testid="error"]').first().textContent();
      throw new Error(`Homepage shows error: ${errorContent}`);
    }
    
    // Verify we're on the homepage
    const currentUrl = page.url();
    expect(currentUrl).to.include('/');
    
    // Quick structure verification
    const hasBody = await page.locator('body').count() > 0;
    if (!hasBody) {
      throw new Error('Homepage does not have basic structure');
    }
    
    this.attach(`Successfully loaded homepage: ${currentUrl}`, 'text/plain');
  }, 2); // Reduced retry attempts
});

Then('the page should load with basic structure', async function(this: FoundersDayWorld) {
  const page = this.getPage();
  
  // Check that we have basic page structure
  const hasStructure = await this.verifyPageStructure();
  expect(hasStructure).to.be.true;
  
  this.attach('Page has basic structure', 'text/plain');
});