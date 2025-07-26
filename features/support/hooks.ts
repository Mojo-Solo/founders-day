import { Before, After, BeforeAll, AfterAll, setWorldConstructor, Status } from '@cucumber/cucumber';
import { FoundersDayWorld } from './world';

// Set our custom world constructor
setWorldConstructor(FoundersDayWorld);

// Global setup
BeforeAll(async function() {
  console.log('Starting Cucumber test suite...');
  // Add any global setup here (e.g., database migrations, test server startup)
});

// Global teardown
AfterAll(async function() {
  console.log('Cucumber test suite completed.');
  // Add any global cleanup here
});

// Before each scenario
Before(async function(this: FoundersDayWorld) {
  // Reset test data for each scenario
  this.testData = {
    users: [],
    registrations: [],
    payments: []
  };
  
  // Clear any previous context
  this.currentUser = undefined;
  this.lastResponse = undefined;
  this.lastError = undefined;
});

// After each scenario
After(async function(this: FoundersDayWorld, { result }) {
  // Attach debug information on failure
  if (result?.status === Status.FAILED) {
    if (this.lastResponse) {
      this.attachJSON({
        url: this.lastResponse.url,
        status: this.lastResponse.status,
        statusText: this.lastResponse.statusText
      });
    }
    
    if (this.lastError) {
      this.attachJSON({
        error: this.lastError.message,
        stack: this.lastError.stack
      });
    }
  }
  
  // Clean up test data
  // TODO: Add cleanup API calls to remove test data from backend
});

// Tagged hooks for specific scenarios
Before('@admin', async function(this: FoundersDayWorld) {
  // Setup specific to admin scenarios
  console.log('Setting up admin scenario context');
});

Before('@payment', async function(this: FoundersDayWorld) {
  // Setup specific to payment scenarios
  console.log('Setting up payment scenario context');
});