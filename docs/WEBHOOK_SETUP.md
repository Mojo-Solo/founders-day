# Square Webhook Integration Setup Guide

This guide covers the complete setup and configuration of the Square webhook authentication middleware for the Founders Day Next.js application.

## Architecture Overview

The webhook system consists of several key components:

1. **Authentication Middleware** (`lib/middleware/webhook-auth.ts`)
   - HMAC-SHA256 signature verification
   - Rate limiting with in-memory store (Redis in production)
   - Request validation and sanitization
   - Idempotency handling

2. **Processing Queue** (`lib/middleware/webhook-queue.ts`)
   - Asynchronous event processing
   - Retry logic with exponential backoff
   - Priority-based processing
   - Dead letter queue for failed events

3. **Event Processors** (`lib/services/webhook-processor.ts`)
   - Event-specific processing logic
   - Database integration
   - Customer and payment synchronization

4. **Error Handling** (`lib/middleware/webhook-error-handler.ts`)
   - Error classification and recovery
   - Circuit breaker pattern
   - Fallback mechanisms
   - Alerting and monitoring

5. **API Routes** (`app/api/webhooks/square/`)
   - Main webhook endpoint
   - Status and health monitoring
   - Administrative controls

## Environment Configuration

### Required Environment Variables

```bash
# Square API Configuration
SQUARE_WEBHOOK_SIGNATURE_KEY_SANDBOX=your_sandbox_webhook_signature_key
SQUARE_WEBHOOK_SIGNATURE_KEY_PROD=your_production_webhook_signature_key

# Webhook Configuration
WEBHOOK_RATE_LIMIT_WINDOW_MS=60000          # Rate limit window (1 minute)
WEBHOOK_RATE_LIMIT_MAX_REQUESTS=100         # Max requests per window
WEBHOOK_ENABLE_IDEMPOTENCY=true             # Enable duplicate detection
WEBHOOK_ALLOWED_ORIGINS=https://connect.squareup.com,https://connect.squareupsandbox.com

# Administrative Access
WEBHOOK_ADMIN_TOKEN=your_secure_admin_token_here

# Database Configuration (for webhook storage)
DATABASE_URL=postgresql://user:password@host:port/database

# Logging and Monitoring
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn_for_error_tracking
```

### Development vs Production Configuration

**Development/Sandbox:**
```bash
NODE_ENV=development
SQUARE_ENVIRONMENT=sandbox
SQUARE_WEBHOOK_SIGNATURE_KEY_SANDBOX=sb_webhook_signature_key
```

**Production:**
```bash
NODE_ENV=production
SQUARE_ENVIRONMENT=production
SQUARE_WEBHOOK_SIGNATURE_KEY_PROD=prod_webhook_signature_key
```

## Square Configuration

### 1. Create Webhook Endpoints in Square Dashboard

1. Log into your Square Developer Dashboard
2. Navigate to your application
3. Go to "Webhooks" section
4. Create a new webhook endpoint:
   - **URL**: `https://yourdomain.com/api/webhooks/square`
   - **API Version**: `2023-10-18` (or latest)
   - **Events**: Select the events you want to receive:
     - `payment.created`
     - `payment.updated` 
     - `customer.created`
     - `customer.updated`
     - `refund.created`
     - `refund.updated`

### 2. Obtain Webhook Signature Key

1. After creating the webhook, Square will provide a signature key
2. Copy this key to your environment variables
3. Use different keys for sandbox and production environments

### 3. Configure Event Subscriptions

Enable the following events based on your needs:

**Payment Events:**
- `payment.created` - New payment processed
- `payment.updated` - Payment status changed
- `refund.created` - Refund issued
- `refund.updated` - Refund status changed

**Customer Events:**
- `customer.created` - New customer registered
- `customer.updated` - Customer information changed
- `customer.deleted` - Customer removed

**Order Events (Optional):**
- `order.created` - New order placed
- `order.updated` - Order modified
- `order.fulfilled` - Order completed

## Database Setup

### 1. Run Database Migrations

The webhook system uses the existing Square database schema. Ensure you have run the migration:

```sql
-- This migration should already exist in your project
-- /founders-day-admin/supabase/migrations/20250801_square_payment_integration.sql
```

Key tables used:
- `square_webhooks` - Webhook event log
- `square_payments` - Payment records
- `square_customers` - Customer profiles
- `payment_reconciliation_log` - Financial reconciliation

### 2. Database Permissions

Ensure your application database user has permissions to:
- INSERT, UPDATE, SELECT on all `square_*` tables
- UPDATE on `registrations` table for payment status updates

## Deployment

### 1. Next.js Deployment

The webhook system is fully integrated with Next.js App Router:

```bash
# Build the application
npm run build

# Start in production
npm run start
```

### 2. Health Check Endpoint

Monitor webhook system health:

```bash
curl https://yourdomain.com/api/webhooks/square/status
```

Expected response:
```json
{
  "status": "healthy",
  "queue": {
    "total": 0,
    "processing": 0,
    "byStatus": {...},
    "avgProcessingTime": 0
  },
  "timestamp": "2025-01-01T00:00:00.000Z",
  "environment": "production"
}
```

### 3. Load Balancer Configuration

If using a load balancer, ensure:
- Webhook requests are routed to healthy instances
- Sticky sessions are NOT required (stateless processing)
- Health check uses `/api/webhooks/square/status`

## Security Considerations

### 1. Signature Verification

All webhooks are verified using HMAC-SHA256:
- Signatures are compared using constant-time comparison
- Invalid signatures are immediately rejected
- All signature verification attempts are logged

### 2. Rate Limiting

Default limits (configurable):
- 100 requests per minute per IP
- Circuit breaker trips after 5 consecutive failures
- Rate limit headers included in responses

### 3. Input Validation

All webhook payloads are validated for:
- Required fields presence
- Timestamp freshness (max 10 minutes old)
- Event type format
- JSON structure integrity

### 4. Idempotency

Duplicate events are handled via:
- Event ID-based deduplication
- 24-hour idempotency window
- Graceful duplicate response (200 OK)

## Monitoring and Alerting

### 1. Logging

All webhook events are logged with structured data:
- Authentication attempts (success/failure)
- Processing results
- Error details and classifications
- Performance metrics

### 2. Error Alerting

Critical errors trigger alerts:
- Authentication failures (potential security issues)
- Database connection failures
- Processing timeout errors
- Circuit breaker trips

Configure alerts via:
- Email notifications
- Slack webhooks
- PagerDuty integration
- Custom monitoring services

### 3. Metrics to Monitor

Key metrics to track:
- Webhook processing latency
- Success/failure rates by event type
- Queue depth and processing time
- Error rates by error type
- Rate limiting triggers

## Testing

### 1. Unit Tests

Run the comprehensive test suite:

```bash
npm test test/webhooks/square-webhook-integration.test.ts
```

### 2. Integration Testing

Use the provided testing utilities:

```typescript
import { WebhookTestDataGenerator } from './lib/testing/webhook-test-utils'

const generator = new WebhookTestDataGenerator({
  webhookSignatureKey: 'your-test-key',
  merchantId: 'test-merchant',
  locationId: 'test-location'
})

// Generate test webhook
const testEvent = generator.generatePaymentCreatedEvent()
const testRequest = generator.createMockWebhookRequest(testEvent)
```

### 3. Load Testing

Test with multiple concurrent webhooks:

```typescript
import { WebhookPerformanceTester } from './lib/testing/webhook-test-utils'

const tester = new WebhookPerformanceTester()
const loadTest = tester.generateLoadTestEvents(100)
const results = await tester.measureProcessingTime(loadTest, processWebhook)
```

## Troubleshooting

### Common Issues

**1. Signature Verification Failures**
```
Error: Invalid webhook signature
```
- Verify signature key matches Square dashboard
- Check environment (sandbox vs production)
- Ensure raw body is used for signature calculation

**2. Rate Limiting Issues**
```
Error: Rate limit exceeded
```
- Check if legitimate traffic spike
- Review rate limit configuration
- Consider increasing limits for production

**3. Processing Timeouts**
```
Error: Processing timeout after 30000ms
```
- Check database connection performance
- Review processing logic efficiency
- Consider increasing timeout limits

**4. Queue Backup**
```
Warning: Queue size growing, processing may be slow
```
- Check processing performance
- Review error rates
- Consider scaling processing capacity

### Debug Tools

**1. Enable Debug Logging**
```bash
LOG_LEVEL=debug npm start
```

**2. Webhook Status Monitoring**
```bash
curl -H "Authorization: Bearer ${WEBHOOK_ADMIN_TOKEN}" \
  "https://yourdomain.com/api/webhooks/square/status?details=true"
```

**3. Manual Event Processing**
```bash
# Trigger test webhook (development only)
curl -X POST https://yourdomain.com/api/webhooks/square \
  -H "Content-Type: application/json" \
  -H "X-Square-Signature: $(generate_signature)" \
  -d '{"merchant_id":"test","type":"payment.created",...}'
```

## Maintenance

### Regular Tasks

**Daily:**
- Monitor error rates and processing times
- Check queue depth and processing lag
- Review authentication failure logs

**Weekly:**
- Analyze webhook processing performance
- Review dead letter queue for pattern analysis
- Update rate limiting based on traffic patterns

**Monthly:**
- Review and update error handling strategies
- Analyze webhook event patterns for optimization
- Update documentation and runbooks

### Capacity Planning

Monitor these metrics for scaling decisions:
- Average processing time per event type
- Peak concurrent processing load
- Memory usage growth over time
- Database connection pool utilization

Scale when:
- Processing time consistently > 5 seconds
- Queue depth regularly > 100 events
- Error rates > 1% for extended periods
- Memory usage trending upward

## Support and Escalation

For webhook-related issues:

1. **Check system status**: `/api/webhooks/square/status`
2. **Review recent logs**: Look for error patterns
3. **Check Square status**: [Square Status Page](https://status.squareup.com)
4. **Escalation path**: Development team → DevOps → Square Support

Emergency contacts and procedures should be documented in your incident response plan.