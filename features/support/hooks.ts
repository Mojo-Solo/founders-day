import { Before, After, BeforeAll, AfterAll, setWorldConstructor, Status, setDefaultTimeout } from '@cucumber/cucumber';
import { FoundersDayWorld } from './world';
import { TestEnvironment } from './test-environment';
import { browserPool } from './browser-pool';
import { createClient } from '@supabase/supabase-js';
import { setupMockRoutes } from './mock-routes';

// Set our custom world constructor
setWorldConstructor(FoundersDayWorld);

// Set default timeout for all steps
setDefaultTimeout(30000);

// Global test environment instance
let testEnvironment: TestEnvironment;

// Global setup
BeforeAll(async function() {
  try {
    console.log('Starting Cucumber test suite...');
    
    // Skip server startup for now - servers should be running externally
    if (process.env.START_SERVERS !== 'false') {
      console.log('Skipping test server startup - assuming servers are running externally');
    }
    
    console.log('Browser pool initialized');
  } catch (error) {
    console.error('Test suite initialization error:', error);
    throw error;
  }
});

// Global teardown
AfterAll(async function() {
  console.log('Cucumber test suite completed.');
  
  // Clean up browser pool
  if (browserPool) {
    console.log('Cleaning up browser pool...');
    await browserPool.cleanup();
    console.log('Browser pool cleaned up');
  }
  
  // Stop test servers if they were started
  if (testEnvironment && process.env.START_SERVERS !== 'false') {
    await testEnvironment.stopServers();
  }
});

// Before each scenario
Before(async function(this: FoundersDayWorld) {
  // Initialize browser and page for this scenario
  const browser = await browserPool.getBrowser();
  const context = await browserPool.getContext(browser);
  
  // Set up mock routes for all requests
  await setupMockRoutes(context);
  
  const page = await context.newPage();
  
  this.browser = browser;
  this.context = context;
  this.page = page;
  
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
  
  // Initialize API configuration
  this.apiUrl = process.env.ADMIN_API_URL || 'http://localhost:3001';
  this.publicApiUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000';
  
  // Initialize Supabase client if needed (with fallback)
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      // Use mock data if Supabase is not configured
      this.supabase = {
        from: () => ({
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => Promise.resolve({ data: null, error: null }),
          update: () => Promise.resolve({ data: null, error: null }),
          delete: () => Promise.resolve({ data: null, error: null })
        })
      } as any;
    }
  } catch (error) {
    console.warn('Failed to initialize Supabase, using mock:', error);
    // Continue with mock data
    this.supabase = {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null }),
        delete: () => Promise.resolve({ data: null, error: null })
      })
    } as any;
  }
});

// After each scenario
After(async function(this: FoundersDayWorld, { pickle, result }) {
  // Take screenshot on failure
  if (result?.status === Status.FAILED && this.page) {
    try {
      const screenshot = await this.page.screenshot({ fullPage: true });
      this.attach(screenshot, 'image/png');
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  }
  
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
  
  // Release browser resources back to pool
  if (this.context) {
    await browserPool.releaseContext(this.context);
  }
  if (this.browser) {
    await browserPool.releaseBrowser(this.browser);
  }
  this.browser = undefined;
  this.context = undefined;
  this.page = undefined;
  
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

// Performance monitoring hooks
After(async function(this: FoundersDayWorld, { pickle }) {
  // Record scenario performance
  const scenarioName = pickle.name;
  const duration = Date.now() - (this.scenarioStartTime || Date.now());
  
  this.attachJSON({
    scenario: scenarioName,
    duration: duration,
    timestamp: new Date().toISOString()
  });
});

Before(async function(this: FoundersDayWorld) {
  // Record scenario start time
  this.scenarioStartTime = Date.now();
});