import { World, IWorldOptions } from '@cucumber/cucumber';

export interface TestUser {
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
  pricing?: {
    regular: number;
    earlyBird: number;
  };
  ticketsRemaining?: number;
  selectedTickets?: any;
  registrationDetails?: any;
  lastRegistration?: any;
  testRun?: boolean;
}

export class FoundersDayWorld extends World {
  // Test data management
  public testData: TestData;
  
  // API client for backend communication
  public apiUrl: string;
  
  // Current test context
  public currentUser?: TestUser;
  public lastResponse?: Response;
  public lastError?: Error;
  
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
  
  // Helper method to make API calls
  async apiCall(endpoint: string, options: RequestInit = {}): Promise<Response> {
    try {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
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
  
  // Helper to attach data to the report
  attachJSON(data: any, mediaType = 'application/json') {
    this.attach(JSON.stringify(data, null, 2), mediaType);
  }
}