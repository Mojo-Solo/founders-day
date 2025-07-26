# Founders Day Minnesota - Test-Driven Development Strategy

## Overview

This document defines the comprehensive testing strategy for transforming the Founders Day Minnesota application into a production-ready MVP. Every feature must be built using Test-Driven Development (TDD) principles with a minimum of 80% code coverage.

## TDD Workflow

### The Red-Green-Refactor Cycle

```mermaid
graph LR
    A[Write Failing Test] -->|Red| B[Write Minimal Code]
    B -->|Green| C[Test Passes]
    C -->|Refactor| D[Improve Code]
    D --> A
```

### TDD Implementation Rules

1. **No production code without a failing test**
2. **Write the minimum code to make tests pass**
3. **Refactor only when tests are green**
4. **Each commit must maintain or increase coverage**
5. **Tests are first-class code - maintain them well**

## Test Categories and Coverage Targets

### Unit Tests (Target: 80% coverage)

#### Frontend Unit Tests

```typescript
// Component Testing Example
describe('TicketPurchase Component', () => {
  it('should display ticket options', () => {
    const { getByText } = render(<TicketPurchase event={mockEvent} />);
    expect(getByText('General Admission')).toBeInTheDocument();
    expect(getByText('VIP Pass')).toBeInTheDocument();
  });

  it('should validate ticket quantity', () => {
    const { getByRole, getByText } = render(<TicketPurchase event={mockEvent} />);
    const input = getByRole('spinbutton', { name: /quantity/i });
    
    fireEvent.change(input, { target: { value: '0' } });
    expect(getByText('Minimum 1 ticket required')).toBeInTheDocument();
    
    fireEvent.change(input, { target: { value: '11' } });
    expect(getByText('Maximum 10 tickets allowed')).toBeInTheDocument();
  });

  it('should calculate total price correctly', () => {
    const { getByRole, getByTestId } = render(<TicketPurchase event={mockEvent} />);
    const quantityInput = getByRole('spinbutton', { name: /quantity/i });
    
    fireEvent.change(quantityInput, { target: { value: '3' } });
    expect(getByTestId('total-price')).toHaveTextContent('$150.00');
  });
});

// Hook Testing Example
describe('usePayment Hook', () => {
  it('should handle successful payment', async () => {
    const { result } = renderHook(() => usePayment());
    
    await act(async () => {
      await result.current.processPayment({
        amount: 100,
        token: 'test-token'
      });
    });
    
    expect(result.current.status).toBe('success');
    expect(result.current.error).toBeNull();
  });

  it('should handle payment failure', async () => {
    mockSquarePayment.mockRejectedValueOnce(new Error('Card declined'));
    
    const { result } = renderHook(() => usePayment());
    
    await act(async () => {
      await result.current.processPayment({
        amount: 100,
        token: 'test-token'
      });
    });
    
    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('Card declined');
  });
});
```

#### Backend Unit Tests

```typescript
// Service Layer Testing
describe('TicketService', () => {
  let ticketService: TicketService;
  let mockRepository: jest.Mocked<TicketRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    ticketService = new TicketService(mockRepository);
  });

  describe('reserveTickets', () => {
    it('should reserve available tickets', async () => {
      mockRepository.getAvailableCount.mockResolvedValue(100);
      mockRepository.createReservation.mockResolvedValue({
        id: 'res-123',
        tickets: 3,
        expiresAt: new Date()
      });

      const result = await ticketService.reserveTickets('event-1', 3);
      
      expect(result.success).toBe(true);
      expect(result.reservationId).toBe('res-123');
      expect(mockRepository.createReservation).toHaveBeenCalledWith({
        eventId: 'event-1',
        quantity: 3
      });
    });

    it('should reject when insufficient tickets', async () => {
      mockRepository.getAvailableCount.mockResolvedValue(2);

      await expect(
        ticketService.reserveTickets('event-1', 3)
      ).rejects.toThrow('Insufficient tickets available');
    });

    it('should handle concurrent reservations', async () => {
      // Test with optimistic locking
      mockRepository.createReservation.mockRejectedValueOnce(
        new OptimisticLockError()
      );
      mockRepository.createReservation.mockResolvedValueOnce({
        id: 'res-124',
        tickets: 3,
        expiresAt: new Date()
      });

      const result = await ticketService.reserveTickets('event-1', 3);
      
      expect(result.success).toBe(true);
      expect(mockRepository.createReservation).toHaveBeenCalledTimes(2);
    });
  });
});

// Validation Testing
describe('RegistrationValidator', () => {
  const validator = new RegistrationValidator();

  it('should validate correct registration data', () => {
    const data = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1-555-123-4567',
      ticketType: 'general'
    };

    const result = validator.validate(data);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid email', () => {
    const data = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'invalid-email',
      phone: '+1-555-123-4567',
      ticketType: 'general'
    };

    const result = validator.validate(data);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid email format');
  });
});
```

### Integration Tests (Target: 15% coverage)

#### API Integration Tests

```typescript
// API Endpoint Testing
describe('POST /api/tickets/purchase', () => {
  let app: Express;
  let db: TestDatabase;

  beforeAll(async () => {
    db = await TestDatabase.create();
    app = createApp(db);
  });

  afterAll(async () => {
    await db.cleanup();
  });

  beforeEach(async () => {
    await db.reset();
    await db.seed();
  });

  it('should complete ticket purchase flow', async () => {
    const response = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', 'Bearer test-token')
      .send({
        eventId: 'event-1',
        tickets: [
          { type: 'general', quantity: 2 },
          { type: 'vip', quantity: 1 }
        ],
        paymentToken: 'square-token-123'
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      order: {
        id: expect.any(String),
        total: 250.00,
        tickets: expect.arrayContaining([
          { type: 'general', quantity: 2, price: 50 },
          { type: 'vip', quantity: 1, price: 150 }
        ])
      },
      confirmation: {
        number: expect.stringMatching(/^FD-\d{6}$/),
        qrCode: expect.any(String)
      }
    });

    // Verify database state
    const order = await db.orders.findById(response.body.order.id);
    expect(order.status).toBe('completed');
    expect(order.paymentId).toBe('square-payment-123');
  });

  it('should handle payment failure', async () => {
    // Mock Square payment failure
    mockSquare.payments.create.mockRejectedValueOnce({
      errors: [{ code: 'CARD_DECLINED' }]
    });

    const response = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', 'Bearer test-token')
      .send({
        eventId: 'event-1',
        tickets: [{ type: 'general', quantity: 1 }],
        paymentToken: 'square-token-declined'
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Payment declined',
      code: 'PAYMENT_FAILED'
    });

    // Verify no order created
    const orders = await db.orders.find({ eventId: 'event-1' });
    expect(orders).toHaveLength(0);
  });

  it('should enforce ticket limits', async () => {
    // Seed database with limited tickets
    await db.events.update('event-1', { 
      ticketsAvailable: 2,
      maxPerOrder: 5 
    });

    const response = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', 'Bearer test-token')
      .send({
        eventId: 'event-1',
        tickets: [{ type: 'general', quantity: 3 }],
        paymentToken: 'square-token-123'
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Only 2 tickets remaining',
      code: 'INSUFFICIENT_TICKETS'
    });
  });
});

// Database Integration Tests
describe('Database Transactions', () => {
  it('should rollback on payment failure', async () => {
    const orderId = await db.transaction(async (trx) => {
      // Create order
      const order = await trx.orders.create({
        eventId: 'event-1',
        userId: 'user-1',
        total: 100
      });

      // Reserve tickets
      await trx.tickets.reserve(order.id, 2);

      // Simulate payment failure
      throw new Error('Payment failed');
    }).catch(err => null);

    // Verify rollback
    expect(orderId).toBeNull();
    const tickets = await db.tickets.getAvailable('event-1');
    expect(tickets).toBe(100); // Original count
  });
});
```

### End-to-End Tests (Target: 5% coverage)

#### Critical User Journey Tests

```typescript
// E2E Test Suite
describe('Complete Registration Flow', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await seedTestData();
  });

  it('should complete full registration and payment', async () => {
    // Navigate to event page
    await page.goto('https://localhost:3000/events/founders-day-2024');
    
    // Select tickets
    await page.click('[data-testid="ticket-general"]');
    await page.fill('[data-testid="ticket-quantity"]', '2');
    await page.click('[data-testid="add-to-cart"]');
    
    // Fill registration form
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="email"]', 'john.doe@example.com');
    await page.fill('[name="phone"]', '555-123-4567');
    
    // Enter payment details
    await page.click('[data-testid="proceed-to-payment"]');
    await enterSquarePaymentDetails(page, {
      cardNumber: '4111 1111 1111 1111',
      expiry: '12/25',
      cvv: '123',
      zip: '55401'
    });
    
    // Complete purchase
    await page.click('[data-testid="complete-purchase"]');
    
    // Verify confirmation
    await page.waitForSelector('[data-testid="confirmation-page"]');
    const confirmationNumber = await page.textContent('[data-testid="confirmation-number"]');
    expect(confirmationNumber).toMatch(/^FD-\d{6}$/);
    
    // Verify QR code
    const qrCode = await page.locator('[data-testid="qr-code"]');
    await expect(qrCode).toBeVisible();
    
    // Verify email sent
    const email = await getLastEmail();
    expect(email.to).toBe('john.doe@example.com');
    expect(email.subject).toContain('Founders Day Registration Confirmation');
  });

  it('should handle network interruption gracefully', async () => {
    await page.goto('https://localhost:3000/events/founders-day-2024');
    
    // Start registration
    await page.click('[data-testid="ticket-general"]');
    await page.fill('[data-testid="ticket-quantity"]', '1');
    
    // Simulate network offline
    await page.context().setOffline(true);
    
    // Try to proceed
    await page.click('[data-testid="add-to-cart"]');
    
    // Should show offline message
    await expect(page.locator('[data-testid="offline-notice"]')).toBeVisible();
    
    // Restore network
    await page.context().setOffline(false);
    
    // Should auto-retry
    await page.waitForSelector('[data-testid="cart-summary"]');
    const cartItems = await page.textContent('[data-testid="cart-count"]');
    expect(cartItems).toBe('1');
  });
});

// Admin Flow E2E
describe('Admin Event Management', () => {
  it('should create and manage event', async () => {
    // Login as admin
    await loginAsAdmin(page);
    
    // Navigate to create event
    await page.goto('https://localhost:3000/admin/events/new');
    
    // Fill event details
    await page.fill('[name="eventName"]', 'Founders Day 2025');
    await page.fill('[name="eventDate"]', '2025-07-04');
    await page.fill('[name="venue"]', 'Minneapolis Convention Center');
    
    // Add ticket types
    await page.click('[data-testid="add-ticket-type"]');
    await page.fill('[name="ticketTypes[0].name"]', 'Early Bird');
    await page.fill('[name="ticketTypes[0].price"]', '40');
    await page.fill('[name="ticketTypes[0].quantity"]', '500');
    
    // Save event
    await page.click('[data-testid="save-event"]');
    
    // Verify event created
    await page.waitForURL('**/admin/events/*');
    const eventId = page.url().split('/').pop();
    
    // Check event appears in listing
    await page.goto('https://localhost:3000/admin/events');
    await expect(page.locator(`[data-testid="event-${eventId}"]`)).toBeVisible();
    
    // View analytics
    await page.click(`[data-testid="event-${eventId}-analytics"]`);
    await expect(page.locator('[data-testid="tickets-sold"]')).toHaveText('0');
    await expect(page.locator('[data-testid="revenue"]')).toHaveText('$0.00');
  });
});
```

## Test Data Management

### Test Data Factory

```typescript
// factories/test-data.factory.ts
export class TestDataFactory {
  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: faker.datatype.uuid(),
      email: faker.internet.email(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: faker.phone.number('+1-###-###-####'),
      createdAt: new Date(),
      ...overrides
    };
  }

  static createEvent(overrides: Partial<Event> = {}): Event {
    return {
      id: faker.datatype.uuid(),
      name: faker.company.name() + ' Event',
      date: faker.date.future(),
      venue: faker.address.streetAddress(),
      description: faker.lorem.paragraph(),
      ticketsAvailable: faker.datatype.number({ min: 50, max: 500 }),
      ticketTypes: [
        {
          id: 'general',
          name: 'General Admission',
          price: 50,
          available: 300
        },
        {
          id: 'vip',
          name: 'VIP Pass',
          price: 150,
          available: 50
        }
      ],
      ...overrides
    };
  }

  static createOrder(overrides: Partial<Order> = {}): Order {
    const ticketCount = overrides.tickets?.length || 1;
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      eventId: faker.datatype.uuid(),
      tickets: Array(ticketCount).fill(null).map(() => ({
        type: faker.random.arrayElement(['general', 'vip']),
        price: faker.datatype.number({ min: 30, max: 200 }),
        qrCode: faker.datatype.uuid()
      })),
      total: faker.datatype.number({ min: 50, max: 500 }),
      status: 'completed',
      createdAt: new Date(),
      ...overrides
    };
  }

  static createPayment(overrides: Partial<Payment> = {}): Payment {
    return {
      id: faker.datatype.uuid(),
      orderId: faker.datatype.uuid(),
      amount: faker.datatype.number({ min: 50, max: 500 }),
      currency: 'USD',
      status: 'succeeded',
      provider: 'square',
      providerId: `sq_${faker.datatype.uuid()}`,
      createdAt: new Date(),
      ...overrides
    };
  }
}

// Database Seeder
export class TestDatabaseSeeder {
  constructor(private db: Database) {}

  async seedMinimal(): Promise<void> {
    // Create one event with basic data
    const event = await this.db.events.create(
      TestDataFactory.createEvent({
        id: 'test-event-1',
        name: 'Test Founders Day 2024'
      })
    );

    // Create admin user
    await this.db.users.create(
      TestDataFactory.createUser({
        id: 'admin-1',
        email: 'admin@foundersday.com',
        role: 'admin'
      })
    );
  }

  async seedFullScenario(): Promise<void> {
    // Create multiple events
    const events = await Promise.all([
      this.db.events.create(TestDataFactory.createEvent({
        name: 'Founders Day 2024',
        date: new Date('2024-07-04')
      })),
      this.db.events.create(TestDataFactory.createEvent({
        name: 'Founders Day 2025',
        date: new Date('2025-07-04')
      }))
    ]);

    // Create users with various states
    const users = await Promise.all([
      this.db.users.create(TestDataFactory.createUser({ role: 'admin' })),
      ...Array(10).fill(null).map(() => 
        this.db.users.create(TestDataFactory.createUser())
      )
    ]);

    // Create orders with different statuses
    for (const event of events) {
      for (let i = 0; i < 20; i++) {
        const user = faker.random.arrayElement(users);
        const order = await this.db.orders.create(
          TestDataFactory.createOrder({
            userId: user.id,
            eventId: event.id,
            status: faker.random.arrayElement(['pending', 'completed', 'cancelled'])
          })
        );

        if (order.status === 'completed') {
          await this.db.payments.create(
            TestDataFactory.createPayment({
              orderId: order.id,
              amount: order.total
            })
          );
        }
      }
    }
  }

  async cleanup(): Promise<void> {
    await this.db.truncate(['payments', 'orders', 'tickets', 'events', 'users']);
  }
}
```

## Test Environment Configuration

### Test Database Setup

```typescript
// test/setup/database.ts
export class TestDatabase {
  private static instance: TestDatabase;
  private connection: Knex;

  static async create(): Promise<TestDatabase> {
    if (!this.instance) {
      this.instance = new TestDatabase();
      await this.instance.initialize();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    this.connection = knex({
      client: 'postgresql',
      connection: {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5432'),
        database: `founders_day_test_${process.pid}`,
        user: process.env.TEST_DB_USER || 'postgres',
        password: process.env.TEST_DB_PASSWORD || 'postgres'
      }
    });

    // Create test database
    await this.createDatabase();
    
    // Run migrations
    await this.connection.migrate.latest();
  }

  async reset(): Promise<void> {
    // Truncate all tables in reverse dependency order
    const tables = [
      'audit_logs',
      'email_queue',
      'payments',
      'tickets',
      'orders',
      'event_staff',
      'events',
      'users'
    ];

    for (const table of tables) {
      await this.connection(table).truncate();
    }
  }

  async seed(): Promise<void> {
    const seeder = new TestDatabaseSeeder(this);
    await seeder.seedMinimal();
  }

  async cleanup(): Promise<void> {
    await this.connection.destroy();
    // Drop test database
    await this.dropDatabase();
  }
}
```

### Mock Services

```typescript
// test/mocks/square.mock.ts
export const createMockSquareClient = () => {
  return {
    payments: {
      create: jest.fn().mockResolvedValue({
        payment: {
          id: 'sq_payment_123',
          status: 'COMPLETED',
          amount: { amount: 10000, currency: 'USD' },
          createdAt: new Date().toISOString()
        }
      }),
      
      retrieve: jest.fn().mockResolvedValue({
        payment: {
          id: 'sq_payment_123',
          status: 'COMPLETED'
        }
      })
    },
    
    refunds: {
      create: jest.fn().mockResolvedValue({
        refund: {
          id: 'sq_refund_123',
          status: 'COMPLETED',
          amount: { amount: 10000, currency: 'USD' }
        }
      })
    },
    
    webhooks: {
      verifySignature: jest.fn().mockReturnValue(true)
    }
  };
};

// test/mocks/email.mock.ts
export const createMockEmailService = () => {
  const sentEmails: any[] = [];
  
  return {
    send: jest.fn().mockImplementation(async (email) => {
      sentEmails.push(email);
      return { messageId: `mock-${Date.now()}` };
    }),
    
    getSentEmails: () => sentEmails,
    
    getLastEmail: () => sentEmails[sentEmails.length - 1],
    
    clear: () => sentEmails.length = 0
  };
};
```

## CI/CD Test Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          
      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            **/node_modules
            ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests
        run: npm run test:unit -- --coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unit
          
      - name: Check coverage threshold
        run: npm run test:coverage-check

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20.x
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        run: |
          npm run db:test:create
          npm run db:test:migrate
          
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/founders_day_test
          REDIS_URL: redis://localhost:6379
          
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: integration-test-results
          path: test-results/

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20.x
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright
        run: npx playwright install --with-deps
        
      - name: Build application
        run: npm run build
        
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          TEST_URL: http://localhost:3000
          
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Pre-commit Hooks

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=.*\\.test\\.(ts|tsx)$",
    "test:integration": "jest --testPathPattern=.*\\.integration\\.(ts|tsx)$",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage",
    "test:coverage-check": "jest --coverage --coverageThreshold='{\"global\":{\"branches\":80,\"functions\":80,\"lines\":80,\"statements\":80}}'",
    "test:watch": "jest --watch",
    "test:debug": "node --inspect-brk ./node_modules/.bin/jest --runInBand"
  },
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged && npm run test:coverage-check"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --bail --findRelatedTests"
    ]
  }
}
```

## Test Reporting and Monitoring

### Coverage Reports

```typescript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/dist/',
    '.d.ts$'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.tsx',
    '!src/types/**/*'
  ]
};
```

### Test Result Dashboard

```typescript
// test-reporter.ts
export class TestReporter {
  static async generateReport(results: TestResults): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.numTotalTests,
        passed: results.numPassedTests,
        failed: results.numFailedTests,
        skipped: results.numPendingTests,
        duration: results.testResults.reduce((acc, r) => acc + r.perfStats.runtime, 0)
      },
      coverage: {
        lines: results.coverageMap.getCoverageSummary().lines.pct,
        statements: results.coverageMap.getCoverageSummary().statements.pct,
        functions: results.coverageMap.getCoverageSummary().functions.pct,
        branches: results.coverageMap.getCoverageSummary().branches.pct
      },
      failedTests: results.testResults
        .filter(r => r.numFailingTests > 0)
        .map(r => ({
          file: r.testFilePath,
          failures: r.testResults
            .filter(t => t.status === 'failed')
            .map(t => ({
              name: t.title,
              error: t.failureMessages.join('\n')
            }))
        }))
    };

    // Save to file
    await fs.writeFile('test-report.json', JSON.stringify(report, null, 2));
    
    // Send to monitoring service
    await this.sendToMonitoring(report);
  }
}
```

## Conclusion

This comprehensive test strategy ensures that every line of code in the Founders Day Minnesota MVP is thoroughly tested and production-ready. By following strict TDD practices and maintaining 80%+ coverage, we guarantee a robust, reliable application that can handle real-world usage from day one.