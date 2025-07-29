import { World, IWorldOptions } from '@cucumber/cucumber';
import { Page, Browser, BrowserContext } from '@playwright/test';

export interface TestUser {
  id?: string;
  email: string;
  password: string;
  role?: string;
}

export interface TestData {
  users: TestUser[];
  registrations: any[];
  payments: any[];
  // Additional test context
  currentDate?: string;
  eventYear?: number;
  registrationOpen?: boolean;
  pricing?: {
    regular: number;
    earlyBird: number;
    ticketType?: string;
  };
  ticketsRemaining?: number;
  selectedTickets?: any;
  registrationDetails?: any;
  lastRegistration?: any;
  testRun?: boolean;
  currentUser?: TestUser;
  authToken?: string | null;
  hasRegistration?: boolean;
  expectedEmail?: string;
  // Admin dashboard metrics
  currentMetrics?: Record<string, any>;
  eventCapacity?: number;
  ticketsSold?: number;
  attendeeCount?: number;
  registeredCount?: number;
  dietaryRestrictionsCount?: number;
  previousResultCount?: number;
  currentResultCount?: number;
  // Date and scheduling
  isEventDay?: boolean;
  registrationDeadline?: string;
  eventTimezone?: string;
  eventSchedule?: any[];
  // Search functionality
  mockEvents?: any[];
  apiMocks?: Record<string, any>;
  recentSearches?: string[];
  userRegistrations?: any[];
  // Event management
  existingEvent?: any;
  permissionScope?: string;
  completedEvents?: any[];
  anniversaryYear?: string;
  userBirthDate?: string;
  directLink?: string;
  // Performance tracking
  currentTestName?: string;
  // Test isolation
  isolationData?: any;
}

export class FoundersDayWorld extends World {
  // Test data management
  public testData: TestData;
  
  // API client for backend communication
  public apiUrl: string;
  public publicApiUrl?: string;
  
  // Playwright objects
  public browser?: Browser;
  public context?: BrowserContext;
  public page?: Page;
  
  // Supabase client
  public supabase?: any;
  
  // Current test context
  public currentUser?: TestUser;
  public lastResponse?: Response;
  public lastError?: Error;
  
  // Performance tracking
  public scenarioStartTime?: number;
  
  constructor(options: IWorldOptions) {
    super(options);
    
    // Initialize test data
    this.testData = {
      users: [],
      registrations: [],
      payments: []
    };
    
    // Set API URL based on environment
    this.apiUrl = process.env.API_URL || 'http://localhost:3001';
  }
  
  // Helper method to make API calls with robust error handling
  async apiCall(endpoint: string, options: RequestInit = {}): Promise<Response> {
    try {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      this.lastResponse = response;
      return response;
    } catch (error) {
      this.lastError = error as Error;
      throw error;
    }
  }

  // Safe JSON API call using JsonUtils
  async safeApiCall<T = any>(endpoint: string, options: RequestInit = {}) {
    const { JsonUtils } = await import('./json-utils');
    const fullUrl = `${this.apiUrl}${endpoint}`;
    return JsonUtils.apiCall<T>(fullUrl, options);
  }

  // Retry wrapper for flaky operations
  async retryOperation<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
    const { RetryUtils } = await import('./json-utils');
    return RetryUtils.retry(operation, maxAttempts);
  }

  // Wait for element with retry and enhanced error handling
  async waitForElement(selector: string, timeout = 10000) {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    return this.retryOperation(async () => {
      try {
        const element = await this.page!.waitForSelector(selector, { timeout });
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        return element;
      } catch (error) {
        // Enhanced error information
        const currentUrl = this.page!.url();
        const bodyText = await this.page!.textContent('body').catch(() => 'Could not get body text') || 'No body text';
        
        throw new Error(
          `Element "${selector}" not found.\n` +
          `Current URL: ${currentUrl}\n` +
          `Page content preview: ${bodyText.substring(0, 200)}...\n` +
          `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }
  
  // Enhanced element waiting with multiple strategies
  async waitForAnyElement(selectors: string[], timeout = 10000) {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    return this.retryOperation(async () => {
      for (const selector of selectors) {
        try {
          const element = await this.page!.waitForSelector(selector, { timeout: timeout / selectors.length });
          if (element) {
            return element;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      const currentUrl = this.page!.url();
      const bodyText = await this.page!.textContent('body').catch(() => 'Could not get body text') || 'No body text';
      
      throw new Error(
        `None of the elements found: ${selectors.join(', ')}\n` +
        `Current URL: ${currentUrl}\n` +
        `Page content preview: ${bodyText.substring(0, 200)}...`
      );
    });
  }

  // Safe navigation with comprehensive error handling
  async navigateTo(url: string, options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } = {}) {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    return this.retryOperation(async () => {
      try {
        const response = await this.page!.goto(url, { 
          waitUntil: options.waitUntil || 'domcontentloaded',
          timeout: 30000 
        });
        
        // Check if navigation was successful
        if (!response) {
          throw new Error(`Navigation to ${url} failed - no response`);
        }
        
        if (!response.ok()) {
          throw new Error(`Navigation to ${url} failed with status ${response.status()}: ${response.statusText()}`);
        }
        
        // Wait for page to be ready with multiple strategies
        await Promise.race([
          this.page!.waitForLoadState('networkidle', { timeout: 10000 }),
          this.page!.waitForSelector('body', { timeout: 15000 }),
          this.page!.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 })
        ]).catch((e) => {
          console.warn(`Page readiness check failed for ${url}:`, e.message);
        });
        
        // Check for error states on the page
        const errorSelectors = ['.error', '[data-testid="error"]', '.not-found', '[data-testid="404-page"]'];
        for (const errorSelector of errorSelectors) {
          if (await this.page!.isVisible(errorSelector).catch(() => false)) {
            const errorContent = await this.page!.textContent(errorSelector).catch(() => 'Unknown error');
            throw new Error(`Page at ${url} shows error: ${errorContent}`);
          }
        }
        
        return response;
      } catch (error) {
        const currentUrl = this.page!.url();
        throw new Error(
          `Failed to navigate to ${url}.\n` +
          `Current URL: ${currentUrl}\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }
  
  // Check if page has basic structure
  async verifyPageStructure() {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    const essentialSelectors = [
      'nav, [role="navigation"]',
      'main, [role="main"], body',
      'html'
    ];
    
    for (const selector of essentialSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        return true; // Found at least one essential element
      } catch (e) {
        // Continue to next selector
      }
    }
    
    return false;
  }
  
  // Helper to attach data to the report
  attachJSON(data: any, mediaType = 'application/json') {
    this.attach(JSON.stringify(data, null, 2), mediaType);
  }
  
  // Helper to get page with type assertion
  getPage(): Page {
    if (!this.page) {
      throw new Error('Page not initialized. Ensure hooks are running properly.');
    }
    return this.page;
  }
}