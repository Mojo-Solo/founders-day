import { randomBytes } from 'crypto';

interface IsolatedTestData {
  workerId: string;
  testName: string;
  uniqueId: string;
  prefix: string;
  cleanup: Array<() => Promise<void>>;
}

export class TestDataIsolation {
  private static instance: TestDataIsolation;
  private testDataMap: Map<string, IsolatedTestData> = new Map();
  private workerIdCounter = 0;

  static getInstance(): TestDataIsolation {
    if (!TestDataIsolation.instance) {
      TestDataIsolation.instance = new TestDataIsolation();
    }
    return TestDataIsolation.instance;
  }

  createIsolatedTestData(testName: string): IsolatedTestData {
    const workerId = this.getWorkerId();
    const uniqueId = this.generateUniqueId();
    const prefix = `test_${workerId}_${uniqueId}`;
    
    const testData: IsolatedTestData = {
      workerId,
      testName,
      uniqueId,
      prefix,
      cleanup: []
    };

    this.testDataMap.set(testName, testData);
    return testData;
  }

  getTestData(testName: string): IsolatedTestData | undefined {
    return this.testDataMap.get(testName);
  }

  generateUniqueEmail(testName: string, role = 'user'): string {
    const testData = this.getTestData(testName);
    if (!testData) {
      throw new Error(`Test data not found for test: ${testName}`);
    }
    return `${testData.prefix}_${role}@test.example.com`;
  }

  generateUniqueUsername(testName: string, role = 'user'): string {
    const testData = this.getTestData(testName);
    if (!testData) {
      throw new Error(`Test data not found for test: ${testName}`);
    }
    return `${testData.prefix}_${role}`;
  }

  generateUniqueEventName(testName: string): string {
    const testData = this.getTestData(testName);
    if (!testData) {
      throw new Error(`Test data not found for test: ${testName}`);
    }
    return `Event_${testData.prefix}`;
  }

  generateUniquePaymentReference(testName: string): string {
    const testData = this.getTestData(testName);
    if (!testData) {
      throw new Error(`Test data not found for test: ${testName}`);
    }
    return `PAY_${testData.prefix}_${Date.now()}`;
  }

  addCleanupTask(testName: string, cleanupFn: () => Promise<void>): void {
    const testData = this.getTestData(testName);
    if (testData) {
      testData.cleanup.push(cleanupFn);
    }
  }

  async cleanupTestData(testName: string): Promise<void> {
    const testData = this.getTestData(testName);
    if (!testData) {
      return;
    }

    // Execute all cleanup tasks
    for (const cleanupFn of testData.cleanup) {
      try {
        await cleanupFn();
      } catch (error) {
        console.warn(`Cleanup task failed for ${testName}:`, error);
      }
    }

    // Remove from map
    this.testDataMap.delete(testName);
  }

  async cleanupAllTestData(): Promise<void> {
    const cleanupPromises = Array.from(this.testDataMap.keys()).map(testName =>
      this.cleanupTestData(testName)
    );
    
    await Promise.allSettled(cleanupPromises);
    this.testDataMap.clear();
  }

  private getWorkerId(): string {
    // Try to get worker ID from environment or generate one
    if (process.env.CUCUMBER_WORKER_ID) {
      return process.env.CUCUMBER_WORKER_ID;
    }
    
    if (process.env.JEST_WORKER_ID) {
      return process.env.JEST_WORKER_ID;
    }

    // Generate a unique worker ID for this process
    return `w${++this.workerIdCounter}`;
  }

  private generateUniqueId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `${timestamp}_${random}`;
  }

  // Database-safe data generation
  generateIsolatedDatabaseRecord(testName: string, tableName: string, baseData: any): any {
    const testData = this.getTestData(testName);
    if (!testData) {
      throw new Error(`Test data not found for test: ${testName}`);
    }

    const isolatedData = { ...baseData };
    
    // Add isolation prefix to common fields
    if ('name' in isolatedData) {
      isolatedData.name = `${testData.prefix}_${isolatedData.name}`;
    }
    if ('title' in isolatedData) {
      isolatedData.title = `${testData.prefix}_${isolatedData.title}`;
    }
    if ('slug' in isolatedData) {
      isolatedData.slug = `${testData.prefix}_${isolatedData.slug}`;
    }
    if ('email' in isolatedData) {
      isolatedData.email = `${testData.prefix}_${isolatedData.email}`;
    }

    // Add metadata for cleanup
    isolatedData._test_isolation_id = testData.uniqueId;
    isolatedData._test_worker_id = testData.workerId;
    isolatedData._created_at = new Date().toISOString();

    return isolatedData;
  }

  // API-safe request data
  generateIsolatedApiPayload(testName: string, basePayload: any): any {
    const testData = this.getTestData(testName);
    if (!testData) {
      throw new Error(`Test data not found for test: ${testName}`);
    }

    const isolatedPayload = JSON.parse(JSON.stringify(basePayload));
    
    // Recursively add isolation prefixes to string fields that might need isolation
    this.addIsolationToPayload(isolatedPayload, testData.prefix);
    
    return isolatedPayload;
  }

  private addIsolationToPayload(obj: any, prefix: string): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    const fieldsToIsolate = ['name', 'title', 'email', 'username', 'slug', 'eventName'];
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && fieldsToIsolate.includes(key)) {
        obj[key] = `${prefix}_${value}`;
      } else if (typeof value === 'object') {
        this.addIsolationToPayload(value, prefix);
      }
    }
  }

  // Generate isolated port numbers for server testing
  generateIsolatedPort(testName: string, basePort: number): number {
    const testData = this.getTestData(testName);
    if (!testData) {
      throw new Error(`Test data not found for test: ${testName}`);
    }

    // Simple hash of worker ID to get consistent port offset
    const workerHash = testData.workerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offset = (workerHash % 100) + 1; // 1-100 offset
    
    return basePort + offset;
  }

  getIsolationStats(): any {
    return {
      activeTests: this.testDataMap.size,
      workers: Array.from(new Set(Array.from(this.testDataMap.values()).map(t => t.workerId))).length,
      totalCleanupTasks: Array.from(this.testDataMap.values()).reduce((sum, t) => sum + t.cleanup.length, 0)
    };
  }
}

export const testDataIsolation = TestDataIsolation.getInstance();