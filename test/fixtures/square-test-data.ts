/**
 * Square Test Data Fixtures
 * 
 * Comprehensive test data generators and fixtures for Square payment integration testing.
 * Provides realistic mock data for payments, customers, webhooks, and API responses.
 */

import { faker } from '@faker-js/faker'

// Types for test data
export interface TestPayment {
  id: string
  squarePaymentId: string
  amount: number
  currency: string
  status: string
  sourceType: string
  cardBrand?: string
  cardLast4?: string
  customerEmail?: string
  customerName?: string
  registrationId: string
  receiptNumber?: string
  receiptUrl?: string
  referenceId?: string
  note?: string
  createdAt: string
  updatedAt: string
  idempotencyKey: string
  locationId: string
}

export interface TestCustomer {
  id: string
  squareCustomerId: string
  email: string
  givenName: string
  familyName: string
  phoneNumber?: string
  companyName?: string
  address?: {
    addressLine1?: string
    addressLine2?: string
    locality?: string
    administrativeDistrictLevel1?: string
    postalCode?: string
    country?: string
  }
  createdAt: string
  updatedAt: string
  version?: number
}

export interface TestWebhook {
  id: string
  eventId: string
  eventType: string
  merchantId: string
  locationId?: string
  eventData: any
  apiVersion: string
  status: string
  processedAt?: string
  errorMessage?: string
  retryCount: number
  maxRetries: number
  signatureVerified: boolean
  rawBody: string
  headers: Record<string, string>
  createdAtSquare: string
  receivedAt: string
  createdAt: string
  updatedAt: string
}

export interface TestRefund {
  id: string
  squareRefundId: string
  squarePaymentId: string
  amount: number
  currency: string
  reason: string
  status: string
  createdAt: string
  updatedAt: string
}

// Square sandbox test cards
export const SQUARE_TEST_CARDS = {
  visa: {
    number: '4111 1111 1111 1111',
    expiry: '12/25',
    cvv: '123',
    postalCode: '12345',
    brand: 'VISA',
    last4: '1111',
  },
  mastercard: {
    number: '5555 5555 5555 4444',
    expiry: '12/25',
    cvv: '123',
    postalCode: '12345',
    brand: 'MASTERCARD',
    last4: '4444',
  },
  amex: {
    number: '3714 496353 98431',
    expiry: '12/25',
    cvv: '1234',
    postalCode: '12345',
    brand: 'AMERICAN_EXPRESS',
    last4: '8431',
  },
  declined: {
    number: '4000 0000 0000 0002',
    expiry: '12/25',
    cvv: '123',
    postalCode: '12345',
    brand: 'VISA',
    last4: '0002',
  },
  insufficientFunds: {
    number: '4000 0000 0000 9995',
    expiry: '12/25',
    cvv: '123',
    postalCode: '12345',
    brand: 'VISA',
    last4: '9995',
  },
} as const

// Payment status options
export const PAYMENT_STATUSES = [
  'PENDING',
  'COMPLETED',
  'CANCELED',
  'FAILED',
] as const

// Square error types
export const SQUARE_ERROR_TYPES = {
  CARD_DECLINED: {
    category: 'PAYMENT_METHOD_ERROR',
    code: 'CARD_DECLINED',
    detail: 'Your card was declined.',
  },
  INSUFFICIENT_FUNDS: {
    category: 'PAYMENT_METHOD_ERROR',
    code: 'INSUFFICIENT_FUNDS',
    detail: 'Your card has insufficient funds.',
  },
  CARD_EXPIRED: {
    category: 'PAYMENT_METHOD_ERROR',
    code: 'CARD_EXPIRED',
    detail: 'Your card has expired.',
  },
  INVALID_CARD: {
    category: 'PAYMENT_METHOD_ERROR',
    code: 'INVALID_CARD',
    detail: 'The provided card is invalid.',
  },
  CVV_FAILURE: {
    category: 'PAYMENT_METHOD_ERROR',
    code: 'CVV_FAILURE',
    detail: 'The provided CVV does not match the card on file.',
  },
  ADDRESS_VERIFICATION_FAILURE: {
    category: 'PAYMENT_METHOD_ERROR',
    code: 'ADDRESS_VERIFICATION_FAILURE',
    detail: 'The provided address does not match the card on file.',
  },
  INVALID_AMOUNT: {
    category: 'INVALID_REQUEST_ERROR',
    code: 'INVALID_VALUE',
    detail: 'Invalid payment amount.',
  },
  RATE_LIMITED: {
    category: 'RATE_LIMIT_ERROR',
    code: 'RATE_LIMITED',
    detail: 'Too many requests. Please try again later.',
  },
} as const

// Test data generators
export class SquareTestDataFactory {
  /**
   * Generate a test payment with realistic data
   */
  static createPayment(overrides: Partial<TestPayment> = {}): TestPayment {
    const squarePaymentId = `test_payment_${faker.string.alphanumeric(8)}`
    const amount = faker.number.int({ min: 100, max: 100000 }) // $1.00 to $1000.00
    const cardBrand = faker.helpers.arrayElement(['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS'])
    const status = faker.helpers.arrayElement(PAYMENT_STATUSES)
    
    return {
      id: faker.string.uuid(),
      squarePaymentId,
      amount,
      currency: 'USD',
      status,
      sourceType: 'CARD',
      cardBrand,
      cardLast4: faker.finance.creditCardNumber().slice(-4),
      customerEmail: faker.internet.email(),
      customerName: faker.person.fullName(),
      registrationId: faker.string.uuid(),
      receiptNumber: `RCP_${faker.string.alphanumeric(8)}`,
      receiptUrl: faker.internet.url(),
      referenceId: `ref_${faker.string.alphanumeric(10)}`,
      note: `Founders Day registration payment - ${faker.lorem.words(3)}`,
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      idempotencyKey: `payment_${squarePaymentId}_${Date.now()}`,
      locationId: `test_location_${faker.string.alphanumeric(8)}`,
      ...overrides,
    }
  }

  /**
   * Generate multiple test payments
   */
  static createPayments(count: number, overrides: Partial<TestPayment> = {}): TestPayment[] {
    return Array.from({ length: count }, () => this.createPayment(overrides))
  }

  /**
   * Generate a test customer with realistic data
   */
  static createCustomer(overrides: Partial<TestCustomer> = {}): TestCustomer {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    
    return {
      id: faker.string.uuid(),
      squareCustomerId: `test_customer_${faker.string.alphanumeric(8)}`,
      email: faker.internet.email({ firstName, lastName }),
      givenName: firstName,
      familyName: lastName,
      phoneNumber: faker.phone.number(),
      companyName: faker.helpers.maybe(() => faker.company.name(), { probability: 0.3 }),
      address: faker.helpers.maybe(() => ({
        addressLine1: faker.location.streetAddress(),
        addressLine2: faker.helpers.maybe(() => faker.location.secondaryAddress(), { probability: 0.3 }),
        locality: faker.location.city(),
        administrativeDistrictLevel1: faker.location.state(),
        postalCode: faker.location.zipCode(),
        country: 'US',
      }), { probability: 0.7 }),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      version: faker.number.int({ min: 0, max: 10 }),
      ...overrides,
    }
  }

  /**
   * Generate multiple test customers
   */
  static createCustomers(count: number, overrides: Partial<TestCustomer> = {}): TestCustomer[] {
    return Array.from({ length: count }, () => this.createCustomer(overrides))
  }

  /**
   * Generate a test webhook event
   */
  static createWebhook(eventType: string, overrides: Partial<TestWebhook> = {}): TestWebhook {
    const eventId = `test_event_${faker.string.alphanumeric(10)}`
    const merchantId = `test_merchant_${faker.string.alphanumeric(8)}`
    
    const eventData = this.generateWebhookEventData(eventType)
    
    return {
      id: faker.string.uuid(),
      eventId,
      eventType,
      merchantId,
      locationId: `test_location_${faker.string.alphanumeric(8)}`,
      eventData,
      apiVersion: '2023-10-18',
      status: faker.helpers.arrayElement(['received', 'processing', 'processed', 'failed']),
      processedAt: faker.helpers.maybe(() => faker.date.recent().toISOString(), { probability: 0.7 }),
      errorMessage: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
      retryCount: faker.number.int({ min: 0, max: 3 }),
      maxRetries: 3,
      signatureVerified: faker.datatype.boolean({ probability: 0.9 }),
      rawBody: JSON.stringify(eventData),
      headers: {
        'content-type': 'application/json',
        'x-square-signature': `test-signature-${faker.string.alphanumeric(32)}`,
        'x-square-hmacsha256-signature': `test-hmac-${faker.string.alphanumeric(64)}`,
      },
      createdAtSquare: faker.date.recent().toISOString(),
      receivedAt: faker.date.recent().toISOString(),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      ...overrides,
    }
  }

  /**
   * Generate webhook event data based on event type
   */
  private static generateWebhookEventData(eventType: string): any {
    switch (eventType) {
      case 'payment.created':
      case 'payment.updated':
        return {
          type: 'payment',
          id: `test_payment_${faker.string.alphanumeric(8)}`,
          object: {
            payment: {
              id: `test_payment_${faker.string.alphanumeric(8)}`,
              status: faker.helpers.arrayElement(PAYMENT_STATUSES),
              amount_money: {
                amount: faker.number.int({ min: 100, max: 10000 }),
                currency: 'USD',
              },
              source_type: 'CARD',
              card_details: {
                card: {
                  card_brand: faker.helpers.arrayElement(['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS']),
                  last_4: faker.finance.creditCardNumber().slice(-4),
                },
              },
              reference_id: `reg_${faker.string.alphanumeric(8)}`,
              receipt_number: `RCP_${faker.string.alphanumeric(6)}`,
              receipt_url: faker.internet.url(),
              buyer_email_address: faker.internet.email(),
              created_at: faker.date.recent().toISOString(),
              updated_at: faker.date.recent().toISOString(),
            },
          },
        }

      case 'refund.created':
      case 'refund.updated':
        return {
          type: 'refund',
          id: `test_refund_${faker.string.alphanumeric(8)}`,
          object: {
            refund: {
              id: `test_refund_${faker.string.alphanumeric(8)}`,
              payment_id: `test_payment_${faker.string.alphanumeric(8)}`,
              status: faker.helpers.arrayElement(['PENDING', 'COMPLETED', 'FAILED']),
              amount_money: {
                amount: faker.number.int({ min: 100, max: 5000 }),
                currency: 'USD',
              },
              reason: faker.lorem.sentence(),
              created_at: faker.date.recent().toISOString(),
              updated_at: faker.date.recent().toISOString(),
            },
          },
        }

      case 'customer.created':
      case 'customer.updated':
        return {
          type: 'customer',
          id: `test_customer_${faker.string.alphanumeric(8)}`,
          object: {
            customer: {
              id: `test_customer_${faker.string.alphanumeric(8)}`,
              given_name: faker.person.firstName(),
              family_name: faker.person.lastName(),
              email_address: faker.internet.email(),
              phone_number: faker.phone.number(),
              created_at: faker.date.recent().toISOString(),
              updated_at: faker.date.recent().toISOString(),
            },
          },
        }

      case 'customer.deleted':
        return {
          type: 'customer',
          id: `test_customer_${faker.string.alphanumeric(8)}`,
          object: {
            customer: {
              id: `test_customer_${faker.string.alphanumeric(8)}`,
              deleted: true,
            },
          },
        }

      default:
        return {
          type: 'unknown',
          id: `test_unknown_${faker.string.alphanumeric(8)}`,
          object: {
            unknown_field: 'unknown_value',
          },
        }
    }
  }

  /**
   * Generate a test refund
   */
  static createRefund(overrides: Partial<TestRefund> = {}): TestRefund {
    return {
      id: faker.string.uuid(),
      squareRefundId: `test_refund_${faker.string.alphanumeric(8)}`,
      squarePaymentId: `test_payment_${faker.string.alphanumeric(8)}`,
      amount: faker.number.int({ min: 100, max: 5000 }),
      currency: 'USD',
      reason: faker.helpers.arrayElement([
        'Customer request',
        'Event cancelled',
        'Duplicate payment',
        'Item not available',
        'Customer dispute',
      ]),
      status: faker.helpers.arrayElement(['PENDING', 'COMPLETED', 'FAILED', 'REJECTED']),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      ...overrides,
    }
  }

  /**
   * Generate API response for Square payment creation
   */
  static createPaymentResponse(success = true, payment?: Partial<TestPayment>): any {
    if (!success) {
      return {
        success: false,
        error: 'Payment processing failed',
        details: {
          errors: [
            faker.helpers.arrayElement(Object.values(SQUARE_ERROR_TYPES)),
          ],
        },
      }
    }

    const testPayment = payment ? this.createPayment(payment) : this.createPayment()
    
    return {
      success: true,
      payment: {
        id: testPayment.squarePaymentId,
        status: testPayment.status,
        amount: testPayment.amount / 100, // Convert from cents
        currency: testPayment.currency,
        receiptUrl: testPayment.receiptUrl,
        receiptNumber: testPayment.receiptNumber,
        referenceId: testPayment.referenceId,
        createdAt: testPayment.createdAt,
      },
      idempotencyKey: testPayment.idempotencyKey,
    }
  }

  /**
   * Generate API response for Square customer creation
   */
  static createCustomerResponse(success = true, customer?: Partial<TestCustomer>): any {
    if (!success) {
      return {
        success: false,
        error: 'Customer creation failed',
        details: {
          errors: [
            {
              category: 'INVALID_REQUEST_ERROR',
              code: 'INVALID_VALUE',
              detail: 'Invalid customer data provided.',
            },
          ],
        },
      }
    }

    const testCustomer = customer ? this.createCustomer(customer) : this.createCustomer()
    
    return {
      success: true,
      customer: {
        id: testCustomer.squareCustomerId,
        givenName: testCustomer.givenName,
        familyName: testCustomer.familyName,
        emailAddress: testCustomer.email,
        phoneNumber: testCustomer.phoneNumber,
        companyName: testCustomer.companyName,
        address: testCustomer.address,
        createdAt: testCustomer.createdAt,
        updatedAt: testCustomer.updatedAt,
      },
      existing: false,
    }
  }

  /**
   * Generate reconciliation data
   */
  static createReconciliationData(): any {
    const totalPayments = faker.number.int({ min: 100, max: 1000 })
    const completedPayments = faker.number.int({ min: Math.floor(totalPayments * 0.8), max: totalPayments })
    const failedPayments = faker.number.int({ min: 0, max: Math.floor(totalPayments * 0.1) })
    const pendingPayments = totalPayments - completedPayments - failedPayments
    
    return {
      totalPayments,
      totalAmount: faker.number.int({ min: 10000, max: 1000000 }),
      completedPayments,
      failedPayments,
      pendingPayments,
      refundedPayments: faker.number.int({ min: 0, max: Math.floor(completedPayments * 0.05) }),
      discrepancies: faker.number.int({ min: 0, max: 5 }),
      lastSyncTime: faker.date.recent().toISOString(),
      syncStatus: faker.helpers.arrayElement(['up_to_date', 'syncing', 'needs_sync', 'error']),
    }
  }

  /**
   * Generate analytics data
   */
  static createAnalyticsData(days = 30): any {
    const dailyData = Array.from({ length: days }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      return {
        date: date.toISOString().split('T')[0],
        revenue: faker.number.int({ min: 1000, max: 50000 }),
        payments: faker.number.int({ min: 10, max: 200 }),
        customers: faker.number.int({ min: 5, max: 150 }),
        averagePayment: faker.number.float({ min: 25, max: 500, fractionDigits: 2 }),
        successRate: faker.number.float({ min: 90, max: 99.9, fractionDigits: 1 }),
      }
    })

    const totalRevenue = dailyData.reduce((sum, day) => sum + day.revenue, 0)
    const totalPayments = dailyData.reduce((sum, day) => sum + day.payments, 0)
    
    return {
      summary: {
        totalRevenue,
        totalPayments,
        averagePayment: totalRevenue / totalPayments,
        successRate: faker.number.float({ min: 95, max: 99, fractionDigits: 1 }),
        period: {
          start: dailyData[dailyData.length - 1].date,
          end: dailyData[0].date,
        },
      },
      dailyData,
      topCustomers: Array.from({ length: 10 }, () => ({
        customerId: faker.string.uuid(),
        email: faker.internet.email(),
        name: faker.person.fullName(),
        totalSpent: faker.number.int({ min: 500, max: 5000 }),
        paymentCount: faker.number.int({ min: 1, max: 20 }),
      })),
    }
  }

  /**
   * Generate system health data
   */
  static createSystemHealthData(): any {
    return {
      status: faker.helpers.arrayElement(['healthy', 'warning', 'critical']),
      uptime: faker.number.float({ min: 99, max: 99.99, fractionDigits: 2 }),
      services: {
        database: {
          status: faker.helpers.arrayElement(['healthy', 'warning', 'down']),
          responseTime: faker.number.int({ min: 10, max: 500 }),
          connections: faker.number.int({ min: 5, max: 100 }),
        },
        square: {
          status: faker.helpers.arrayElement(['healthy', 'warning', 'down']),
          responseTime: faker.number.int({ min: 50, max: 2000 }),
          lastSync: faker.date.recent().toISOString(),
        },
        webhooks: {
          status: faker.helpers.arrayElement(['healthy', 'warning', 'down']),
          queueLength: faker.number.int({ min: 0, max: 100 }),
          processingRate: faker.number.float({ min: 50, max: 1000, fractionDigits: 1 }),
        },
        cache: {
          status: faker.helpers.arrayElement(['healthy', 'warning', 'down']),
          hitRate: faker.number.float({ min: 80, max: 99, fractionDigits: 1 }),
          memoryUsage: faker.number.float({ min: 30, max: 90, fractionDigits: 1 }),
        },
      },
      metrics: {
        requestsPerMinute: faker.number.int({ min: 50, max: 1000 }),
        errorRate: faker.number.float({ min: 0.1, max: 5, fractionDigits: 2 }),
        averageResponseTime: faker.number.int({ min: 100, max: 1000 }),
      },
      lastCheck: faker.date.recent().toISOString(),
    }
  }
}

// Pre-built test scenarios
export const TEST_SCENARIOS = {
  // Successful payment scenarios
  SUCCESSFUL_PAYMENT: {
    payment: SquareTestDataFactory.createPayment({
      status: 'COMPLETED',
      amount: 2500, // $25.00
    }),
    response: SquareTestDataFactory.createPaymentResponse(true),
  },

  // Failed payment scenarios
  DECLINED_CARD: {
    response: SquareTestDataFactory.createPaymentResponse(false),
    error: SQUARE_ERROR_TYPES.CARD_DECLINED,
  },

  INSUFFICIENT_FUNDS: {
    response: SquareTestDataFactory.createPaymentResponse(false),
    error: SQUARE_ERROR_TYPES.INSUFFICIENT_FUNDS,
  },

  EXPIRED_CARD: {
    response: SquareTestDataFactory.createPaymentResponse(false),
    error: SQUARE_ERROR_TYPES.CARD_EXPIRED,
  },

  // Customer scenarios
  NEW_CUSTOMER: {
    customer: SquareTestDataFactory.createCustomer(),
    response: SquareTestDataFactory.createCustomerResponse(true),
  },

  EXISTING_CUSTOMER: {
    customer: SquareTestDataFactory.createCustomer(),
    response: {
      ...SquareTestDataFactory.createCustomerResponse(true),
      existing: true,
    },
  },

  // Webhook scenarios
  PAYMENT_COMPLETED_WEBHOOK: SquareTestDataFactory.createWebhook('payment.updated', {
    eventData: {
      type: 'payment',
      object: {
        payment: {
          status: 'COMPLETED',
        },
      },
    },
  }),

  PAYMENT_FAILED_WEBHOOK: SquareTestDataFactory.createWebhook('payment.updated', {
    eventData: {
      type: 'payment',
      object: {
        payment: {
          status: 'FAILED',
        },
      },
    },
  }),

  CUSTOMER_CREATED_WEBHOOK: SquareTestDataFactory.createWebhook('customer.created'),

  REFUND_CREATED_WEBHOOK: SquareTestDataFactory.createWebhook('refund.created'),

  // Large dataset scenarios
  LARGE_PAYMENT_DATASET: SquareTestDataFactory.createPayments(1000),
  LARGE_CUSTOMER_DATASET: SquareTestDataFactory.createCustomers(500),

  // Analytics scenarios
  MONTHLY_ANALYTICS: SquareTestDataFactory.createAnalyticsData(30),
  WEEKLY_ANALYTICS: SquareTestDataFactory.createAnalyticsData(7),

  // System health scenarios
  HEALTHY_SYSTEM: SquareTestDataFactory.createSystemHealthData(),
  DEGRADED_SYSTEM: {
    ...SquareTestDataFactory.createSystemHealthData(),
    status: 'warning',
    services: {
      ...SquareTestDataFactory.createSystemHealthData().services,
      square: {
        status: 'warning',
        responseTime: 1500,
        lastSync: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      },
    },
  },
} as const

// Export utility functions for test data manipulation
export const TestDataUtils = {
  /**
   * Create a batch of payments for testing pagination
   */
  createPaginatedPayments(page = 1, limit = 10, total = 100): {
    payments: TestPayment[]
    pagination: any
  } {
    const startIndex = (page - 1) * limit
    const endIndex = Math.min(startIndex + limit, total)
    const payments = SquareTestDataFactory.createPayments(endIndex - startIndex)

    return {
      payments,
      pagination: {
        page,
        limit,
        offset: startIndex,
        count: payments.length,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: endIndex < total,
        hasPrev: page > 1,
      },
    }
  },

  /**
   * Create realistic date-based payment data
   */
  createPaymentsForDateRange(startDate: Date, endDate: Date, averagePerDay = 10): TestPayment[] {
    const payments: TestPayment[] = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const paymentsForDay = faker.number.int({ min: Math.floor(averagePerDay * 0.5), max: Math.floor(averagePerDay * 1.5) })
      
      for (let i = 0; i < paymentsForDay; i++) {
        const paymentDate = new Date(currentDate)
        paymentDate.setHours(faker.number.int({ min: 8, max: 22 }))
        paymentDate.setMinutes(faker.number.int({ min: 0, max: 59 }))

        payments.push(SquareTestDataFactory.createPayment({
          createdAt: paymentDate.toISOString(),
          updatedAt: paymentDate.toISOString(),
        }))
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  /**
   * Create test data with specific error patterns for testing error handling
   */
  createErrorScenarios(): Record<string, any> {
    return {
      networkError: new Error('Network request failed'),
      timeoutError: new Error('Request timeout'),
      serverError: {
        success: false,
        error: 'Internal server error',
        status: 500,
      },
      validationError: {
        success: false,
        error: 'Validation failed',
        details: [
          { field: 'amount', message: 'Amount must be positive' },
          { field: 'email', message: 'Invalid email format' },
        ],
      },
      rateLimitError: {
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: 60,
      },
    }
  },

  /**
   * Generate deterministic test data using a seed for consistent tests
   */
  createSeededData(seed: string, type: 'payment' | 'customer' | 'webhook', count = 1): any[] {
    faker.seed(seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0))
    
    let data: any[]
    switch (type) {
      case 'payment':
        data = SquareTestDataFactory.createPayments(count)
        break
      case 'customer':
        data = SquareTestDataFactory.createCustomers(count)
        break
      case 'webhook':
        data = Array.from({ length: count }, () => 
          SquareTestDataFactory.createWebhook('payment.created')
        )
        break
      default:
        throw new Error(`Unknown data type: ${type}`)
    }

    faker.seed() // Reset seed
    return data
  },
}

export default SquareTestDataFactory