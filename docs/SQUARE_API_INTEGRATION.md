# Square API Integration Documentation

This document provides comprehensive documentation for the Square API integration in the founders-day Next.js application.

## Overview

The Square API integration provides a complete payment processing solution with the following features:

- **Payment Processing**: Create, update, refund, and query payments
- **Customer Management**: Create, update, and manage customer profiles
- **Webhook Processing**: Real-time payment and customer event handling
- **Reconciliation**: Payment verification and discrepancy resolution
- **Unified API**: Backward-compatible payment endpoint with enhanced features

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Next.js Frontend  │    │     API Routes      │    │   Square Database   │
│                     │    │                     │    │                     │
│ • Payment Forms     │───▶│ • /api/square/*     │───▶│ • square_payments   │
│ • Customer Profile  │    │ • /api/payments     │    │ • square_customers  │
│ • Admin Dashboard   │    │ • /api/webhooks/*   │    │ • square_refunds    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │     Square API      │
                           │                     │
                           │ • Payments API      │
                           │ • Customers API     │
                           │ • Webhooks          │
                           └─────────────────────┘
```

## API Endpoints

### Payment Endpoints

#### `POST /api/square/payments`
Create a new payment.

**Request Body:**
```json
{
  "sourceId": "cnon:card-nonce-ok",
  "amount": 10.00,
  "currency": "USD",
  "registrationId": "123e4567-e89b-12d3-a456-426614174000",
  "customerEmail": "customer@example.com",
  "customerInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "metadata": {
    "eventType": "founders-day",
    "ticketCount": "2"
  },
  "idempotencyKey": "payment-unique-key-123"
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "sq0idp-abc123",
    "status": "COMPLETED",
    "amount": 10.00,
    "currency": "USD",
    "receiptUrl": "https://squareup.com/receipt/...",
    "receiptNumber": "0001",
    "referenceId": "123e4567-e89b-12d3-a456-426614174000",
    "createdAt": "2025-08-01T12:00:00Z"
  },
  "idempotencyKey": "payment-unique-key-123"
}
```

#### `PUT /api/square/payments`
Update payment status (requires authentication).

#### `DELETE /api/square/payments`
Refund a payment (requires authentication).

#### `GET /api/square/payments`
Query payments (requires authentication).

### Customer Endpoints

#### `POST /api/square/customers`
Create a new customer.

**Request Body:**
```json
{
  "givenName": "John",
  "familyName": "Doe",
  "emailAddress": "john@example.com",
  "phoneNumber": "+1234567890",
  "address": {
    "addressLine1": "123 Main St",
    "locality": "Anytown",
    "administrativeDistrictLevel1": "CA",
    "postalCode": "12345",
    "country": "US"
  },
  "registrationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### `PUT /api/square/customers`
Update customer profile (requires authentication).

#### `GET /api/square/customers`
Query customers (requires authentication).

#### `DELETE /api/square/customers`
Delete customer (requires authentication).

### Reconciliation Endpoints

#### `GET /api/square/reconciliation`
Generate reconciliation reports.

**Query Parameters:**
- `type`: Report type (`summary`, `discrepancies`, `payments`, `refunds`)
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)
- `locationId`: Square location ID (optional)

#### `POST /api/square/reconciliation/sync`
Sync payments with Square.

#### `POST /api/square/reconciliation/verify`
Verify payment status.

#### `POST /api/square/reconciliation/resolve`
Resolve payment discrepancies.

### Webhook Endpoints

#### `POST /api/webhooks/square/payments`
Handle Square payment webhooks.

#### `POST /api/webhooks/square/customers`
Handle Square customer webhooks.

### Unified Payment Endpoint

#### `POST /api/payments`
Process payment and registration in a single request.

**Request Body:**
```json
{
  "sourceId": "cnon:card-nonce-ok",
  "amount": 25.00,
  "registrationId": "123e4567-e89b-12d3-a456-426614174000",
  "registrationData": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "tickets": {
      "eventTickets": 1,
      "banquetTickets": 1
    }
  },
  "createCustomer": true,
  "paymentType": "registration"
}
```

## Client SDK Usage

### Importing the Client

```typescript
import { 
  squareAPIClient, 
  createPayment, 
  createCustomer, 
  processRegistrationPayment 
} from '@/lib/services/square-api-client'
```

### Creating a Payment

```typescript
const paymentResult = await createPayment({
  sourceId: 'cnon:card-nonce-ok',
  amount: 10.00,
  registrationId: 'reg-123',
  customerEmail: 'customer@example.com'
})

if (paymentResult.success) {
  console.log('Payment created:', paymentResult.payment.id)
} else {
  console.error('Payment failed:', paymentResult.error)
}
```

### Creating a Customer

```typescript
const customerResult = await createCustomer({
  givenName: 'John',
  familyName: 'Doe',
  emailAddress: 'john@example.com',
  registrationId: 'reg-123'
})

if (customerResult.success) {
  console.log('Customer created:', customerResult.customer.id)
}
```

### Processing Registration Payment

```typescript
const result = await processRegistrationPayment(
  'reg-123',
  {
    sourceId: 'cnon:card-nonce-ok',
    amount: 25.00,
    registrationId: 'reg-123',
    customerEmail: 'john@example.com'
  },
  {
    givenName: 'John',
    familyName: 'Doe',
    emailAddress: 'john@example.com'
  }
)

if (result.success) {
  console.log('Payment:', result.payment.id)
  console.log('Customer:', result.customer.id)
}
```

### Querying Payments

```typescript
const paymentsResult = await squareAPIClient.queryPayments({
  registrationId: 'reg-123',
  status: 'COMPLETED',
  limit: 10
})

console.log('Found payments:', paymentsResult.payments?.length)
```

### Health Check

```typescript
const health = await squareAPIClient.healthCheck()
console.log('API Health:', health.success)
console.log('Endpoints:', health.endpoints)
```

## Database Integration

The Square API integration uses the following database functions:

### Payment Functions
- `upsert_square_payment()` - Create or update payment record
- `update_square_payment_status()` - Update payment status
- `complete_square_payment()` - Mark payment as completed
- `fail_square_payment()` - Mark payment as failed
- `get_square_payments()` - Query payments

### Customer Functions
- `upsert_square_customer()` - Create or update customer
- `get_square_customers()` - Query customers
- `delete_square_customer()` - Soft delete customer
- `link_customer_to_registration()` - Link customer to registration

### Refund Functions
- `create_square_refund()` - Create refund record
- `update_square_refund_status()` - Update refund status
- `complete_square_refund()` - Mark refund as completed

### Reconciliation Functions
- `get_reconciliation_summary()` - Generate summary report
- `get_payment_discrepancies()` - Find payment discrepancies
- `sync_square_payment()` - Sync payment from Square API

## Webhook Processing

### Event Types

**Payment Events:**
- `payment.created` - New payment created
- `payment.updated` - Payment status changed
- `payment.completed` - Payment completed successfully
- `payment.failed` - Payment failed
- `refund.created` - Refund initiated
- `refund.completed` - Refund completed
- `dispute.created` - Payment disputed

**Customer Events:**
- `customer.created` - New customer created
- `customer.updated` - Customer profile updated
- `customer.deleted` - Customer deleted

### Webhook Authentication

Webhooks are authenticated using HMAC-SHA256 signatures:

```typescript
import { authenticateWebhook } from '@/lib/middleware/webhook-auth'

const authResult = await authenticateWebhook(request)
if (!authResult.success) {
  return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
}
```

### Webhook Queue Processing

Webhooks are processed asynchronously using a priority queue:

```typescript
import webhookQueue from '@/lib/middleware/webhook-queue'

await webhookQueue.enqueue({
  id: eventData.event_id,
  type: eventData.event_type,
  data: eventData,
  priority: WebhookPriority.HIGH
})
```

## Error Handling

### Payment Errors

Common Square payment errors and their handling:

```typescript
try {
  const payment = await createPayment(request)
} catch (error) {
  if (error.result?.errors) {
    // Handle Square-specific errors
    const squareErrors = error.result.errors
    for (const err of squareErrors) {
      switch (err.code) {
        case 'CARD_DECLINED':
          return 'Your card was declined. Please try a different payment method.'
        case 'INSUFFICIENT_FUNDS':
          return 'Insufficient funds. Please check your account balance.'
        case 'INVALID_CARD':
          return 'Invalid card information. Please check your details.'
        default:
          return `Payment error: ${err.detail}`
      }
    }
  }
}
```

### Validation Errors

Request validation uses Zod schemas:

```typescript
if (error instanceof z.ZodError) {
  return NextResponse.json({
    error: 'Invalid request data',
    details: error.errors
  }, { status: 400 })
}
```

### Rate Limiting

Rate limiting is applied to prevent abuse:

```typescript
const canProceed = await rateLimitMiddleware(
  request, 
  `square-payment:${clientIp}`, 
  10, // 10 requests
  5 * 60 * 1000 // per 5 minutes
)

if (!canProceed) {
  return NextResponse.json({
    error: 'Rate limit exceeded. Please try again later.'
  }, { status: 429 })
}
```

## Testing

### Running Tests

```bash
# Run all Square API tests
npm test test/api/square-integration.test.ts

# Run with coverage
npm test -- --coverage test/api/square-integration.test.ts

# Run specific test suite
npm test -- --testNamePattern="Square Payments API"
```

### Test Environment Setup

```bash
# Set test environment variables
export SQUARE_ACCESS_TOKEN=sandbox-token
export SQUARE_ENVIRONMENT=sandbox
export SQUARE_LOCATION_ID=test-location
export DATABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_ROLE_KEY=test-key
```

### Mock Data

Tests use mocked Square API responses:

```typescript
mockSquareClient.paymentsApi.createPayment.mockResolvedValue({
  result: {
    payment: {
      id: 'test-payment-id',
      status: 'COMPLETED',
      amountMoney: { amount: BigInt(1000), currency: 'USD' }
    }
  }
})
```

## Security Considerations

### Environment Variables

Required environment variables:

```env
# Square Configuration
SQUARE_ACCESS_TOKEN=your-access-token
SQUARE_ENVIRONMENT=sandbox|production
SQUARE_LOCATION_ID=your-location-id

# Webhook Authentication
SQUARE_WEBHOOK_SIGNATURE_KEY=your-webhook-key

# Database Configuration
DATABASE_URL=your-database-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### Authentication

- Payment queries require valid JWT tokens
- Admin operations require elevated permissions
- Webhooks use HMAC-SHA256 signature verification
- Rate limiting prevents abuse

### Data Protection

- Customer data is encrypted in transit and at rest
- PCI DSS compliance through Square's infrastructure
- Sensitive payment data is not stored locally
- Audit logs track all payment operations

## Monitoring and Logging

### Structured Logging

All operations use structured logging:

```typescript
logger.info('Payment processing initiated', {
  registrationId: 'reg-123',
  amount: 10.00,
  clientIp: '192.168.1.1'
})
```

### Metrics and Alerts

Key metrics to monitor:

- Payment success/failure rates
- Webhook processing latency
- API response times
- Error rates by endpoint
- Reconciliation discrepancies

### Dashboard Integration

The Square API provides endpoints for admin dashboards:

- Payment status overview
- Customer management
- Reconciliation reports
- System health checks

## Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] Database helper functions deployed
- [ ] Webhook endpoints registered with Square
- [ ] SSL certificates installed
- [ ] Rate limiting configured
- [ ] Monitoring and alerting setup
- [ ] Backup and recovery procedures tested

### Environment-Specific Configuration

**Sandbox:**
```env
SQUARE_ENVIRONMENT=sandbox
SQUARE_ACCESS_TOKEN=sandbox-token
SQUARE_APPLICATION_ID=sandbox-app-id
```

**Production:**
```env
SQUARE_ENVIRONMENT=production
SQUARE_ACCESS_TOKEN=production-token
SQUARE_APPLICATION_ID=production-app-id
```

## Troubleshooting

### Common Issues

**Payment Creation Fails:**
1. Check Square credentials
2. Verify payment source validity
3. Check rate limits
4. Review error logs

**Webhook Processing Delays:**
1. Check webhook queue status
2. Verify database connectivity
3. Review processing logs
4. Check authentication

**Customer Creation Errors:**
1. Verify email address uniqueness
2. Check required fields
3. Review validation errors
4. Check Square API limits

### Support Resources

- Square Developer Documentation: https://developer.squareup.com/
- Square API Reference: https://developer.squareup.com/reference/
- Test Payment Methods: Use Square's test card numbers
- Webhook Testing: Use Square's webhook testing tools

## Contributing

When contributing to the Square API integration:

1. Follow existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Consider backward compatibility
5. Test in sandbox environment first

## License

This Square API integration is part of the founders-day application and follows the same licensing terms.