-- ================================
-- Square Payment Integration Seed Data
-- ================================
-- Initial configuration and test data for Square payment integration
-- Date: 2025-08-01
-- Version: 1.0

-- ================================
-- SQUARE CONFIGURATION IN CONTENT TABLE
-- ================================

-- Insert Square-specific configuration into content table
INSERT INTO content (key, title, content, type, category, metadata) VALUES
    -- Square API Configuration
    ('square-environment', 'Square Environment', 'sandbox', 'config', 'payment', 
     jsonb_build_object(
         'description', 'Square API environment (sandbox/production)',
         'type', 'select',
         'options', jsonb_build_array('sandbox', 'production')
     )),
    
    ('square-application-id-sandbox', 'Square Sandbox Application ID', 'sandbox-sq0idb-XO2uGjqzftFUDdulL4GEeg', 'config', 'payment',
     jsonb_build_object(
         'description', 'Square sandbox application ID for testing',
         'type', 'text',
         'sensitive', false
     )),
     
    ('square-location-id-sandbox', 'Square Sandbox Location ID', 'EAAAl4lxCMQ4J2t7YhqHMxojRZf2nbUR9ZjNjODWmcCQlvSTu-gDVRb6ruBrHtwD', 'config', 'payment',
     jsonb_build_object(
         'description', 'Square sandbox location ID for testing',
         'type', 'text',
         'sensitive', false
     )),
     
    ('square-application-id-production', 'Square Production Application ID', 'sq0idp-S6AV4FpfZqVsKMyBgXL9HA', 'config', 'payment',
     jsonb_build_object(
         'description', 'Square production application ID',
         'type', 'text',
         'sensitive', false
     )),
     
    ('square-location-id-production', 'Square Production Location ID', 'EAAAl9LRPz7SezBbWiDZKlOnvt0yzDoWlwKak9wrl0vGjvrucMzEzQSDrMUgwiKE', 'config', 'payment',
     jsonb_build_object(
         'description', 'Square production location ID',
         'type', 'text',
         'sensitive', false
     )),
     
    -- Payment Processing Configuration
    ('payment-processing-enabled', 'Payment Processing Enabled', 'true', 'config', 'payment',
     jsonb_build_object(
         'description', 'Enable/disable payment processing',
         'type', 'boolean'
     )),
     
    ('payment-demo-mode', 'Payment Demo Mode', 'true', 'config', 'payment',
     jsonb_build_object(
         'description', 'Enable demo mode for testing payments',
         'type', 'boolean'
     )),
     
    ('payment-currency', 'Payment Currency', 'USD', 'config', 'payment',
     jsonb_build_object(
         'description', 'Default currency for payments',
         'type', 'select',
         'options', jsonb_build_array('USD', 'CAD', 'EUR', 'GBP')
     )),
     
    -- Webhook Configuration
    ('square-webhook-enabled', 'Square Webhook Enabled', 'true', 'config', 'payment',
     jsonb_build_object(
         'description', 'Enable Square webhook processing',
         'type', 'boolean'
     )),
     
    ('square-webhook-rate-limit', 'Webhook Rate Limit', '100', 'config', 'payment',
     jsonb_build_object(
         'description', 'Maximum webhook requests per minute',
         'type', 'number'
     )),
     
    -- Reconciliation Settings
    ('payment-reconciliation-enabled', 'Payment Reconciliation Enabled', 'true', 'config', 'payment',
     jsonb_build_object(
         'description', 'Enable automatic payment reconciliation',
         'type', 'boolean'
     )),
     
    ('reconciliation-tolerance-cents', 'Reconciliation Tolerance', '100', 'config', 'payment',
     jsonb_build_object(
         'description', 'Tolerance for payment amount differences in cents',
         'type', 'number'
     )),
     
    -- Event Pricing Configuration
    ('event-ticket-price', 'Event Ticket Price', '3000', 'config', 'pricing',
     jsonb_build_object(
         'description', 'Price for event tickets in cents ($30.00)',
         'type', 'number'
     )),
     
    ('banquet-ticket-price', 'Banquet Ticket Price', '5000', 'config', 'pricing',
     jsonb_build_object(
         'description', 'Price for banquet tickets in cents ($50.00)',
         'type', 'number'
     )),
     
    ('hotel-room-price', 'Hotel Room Price', '12000', 'config', 'pricing',
     jsonb_build_object(
         'description', 'Price for hotel rooms in cents ($120.00)',
         'type', 'number'
     ))
ON CONFLICT (key) DO UPDATE SET
    content = EXCLUDED.content,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- ================================
-- TEST CUSTOMER DATA (SANDBOX ONLY)
-- ================================

-- Insert test customers for development/testing
INSERT INTO square_customers (
    square_customer_id, email, given_name, family_name, phone_number,
    address_line_1, locality, administrative_district_level_1, postal_code, country,
    created_at_square, updated_at_square, sync_status
) VALUES 
    ('test-customer-001', 'test@example.com', 'John', 'Doe', '+1-555-0123',
     '123 Test Street', 'Minneapolis', 'MN', '55401', 'USA',
     NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', 'synced'),
     
    ('test-customer-002', 'demo@foundersday.com', 'Jane', 'Smith', '+1-555-0456',
     '456 Demo Avenue', 'Saint Paul', 'MN', '55102', 'USA',
     NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 hours', 'synced'),
     
    ('test-customer-003', 'admin@foundersday.com', 'Admin', 'User', '+1-555-0789',
     '789 Admin Boulevard', 'Bloomington', 'MN', '55425', 'USA',
     NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 hour', 'synced')
ON CONFLICT (square_customer_id) DO NOTHING;

-- ================================
-- TEST REGISTRATION DATA
-- ================================

-- Create test registrations linked to test customers
INSERT INTO registrations (
    confirmationNumber, firstName, lastName, email, phone, aaAffiliation,
    eventTickets, banquetTickets, hotelRooms, totalAmount, status,
    square_customer_id, payment_method, payment_processor_data, square_synced_at
) VALUES 
    ('DEMO-001', 'John', 'Doe', 'test@example.com', '+1-555-0123', 'District 1',
     2, 1, 1, 17000, 'confirmed', 'test-customer-001', 'square',
     jsonb_build_object(
         'test_data', true,
         'created_in', 'seed_data',
         'amount', 17000,
         'currency', 'USD'
     ), NOW()),
     
    ('DEMO-002', 'Jane', 'Smith', 'demo@foundersday.com', '+1-555-0456', 'District 2',
     1, 1, 0, 8000, 'pending_payment', 'test-customer-002', 'square',
     jsonb_build_object(
         'test_data', true,
         'created_in', 'seed_data',
         'amount', 8000,
         'currency', 'USD'
     ), NOW()),
     
    ('DEMO-003', 'Admin', 'User', 'admin@foundersday.com', '+1-555-0789', 'GSO',
     0, 0, 0, 0, 'confirmed', 'test-customer-003', 'square',
     jsonb_build_object(
         'test_data', true,
         'created_in', 'seed_data',
         'amount', 0,
         'currency', 'USD',
         'admin_registration', true
     ), NOW())
ON CONFLICT (confirmationNumber) DO NOTHING;

-- ================================
-- SAMPLE WEBHOOK EVENTS (FOR TESTING)
-- ================================

-- Insert sample webhook events for testing webhook processing
INSERT INTO square_webhooks (
    event_id, event_type, merchant_id, location_id, event_data, api_version,
    signature_verified, status, created_at_square, received_at, processed_at
) VALUES
    ('test-event-001', 'payment.created', 'test-merchant-001', 'test-location-001',
     jsonb_build_object(
         'merchant_id', 'test-merchant-001',
         'type', 'payment.created',
         'object', jsonb_build_object(
             'payment', jsonb_build_object(
                 'id', 'test-payment-001',
                 'status', 'COMPLETED',
                 'total_money', jsonb_build_object('amount', 3000, 'currency', 'USD'),
                 'created_at', (NOW() - INTERVAL '1 hour')::TEXT,
                 'updated_at', (NOW() - INTERVAL '1 hour')::TEXT
             )
         )
     ), '2023-10-18', true, 'processed', NOW() - INTERVAL '1 hour', 
     NOW() - INTERVAL '1 hour', NOW() - INTERVAL '59 minutes'),
     
    ('test-event-002', 'customer.created', 'test-merchant-001', 'test-location-001',
     jsonb_build_object(
         'merchant_id', 'test-merchant-001',
         'type', 'customer.created',
         'object', jsonb_build_object(
             'customer', jsonb_build_object(
                 'id', 'test-customer-webhook-001',
                 'email_address', 'webhook@test.com',
                 'given_name', 'Webhook',
                 'family_name', 'Test',
                 'created_at', (NOW() - INTERVAL '30 minutes')::TEXT,
                 'updated_at', (NOW() - INTERVAL '30 minutes')::TEXT
             )
         )
     ), '2023-10-18', true, 'processed', NOW() - INTERVAL '30 minutes',
     NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '29 minutes'),
     
    ('test-event-003', 'payment.updated', 'test-merchant-001', 'test-location-001',
     jsonb_build_object(
         'merchant_id', 'test-merchant-001',
         'type', 'payment.updated',
         'object', jsonb_build_object(
             'payment', jsonb_build_object(
                 'id', 'test-payment-002',
                 'status', 'FAILED',
                 'total_money', jsonb_build_object('amount', 5000, 'currency', 'USD'),
                 'created_at', (NOW() - INTERVAL '15 minutes')::TEXT,
                 'updated_at', (NOW() - INTERVAL '5 minutes')::TEXT
             )
         )
     ), '2023-10-18', true, 'failed', NOW() - INTERVAL '5 minutes',
     NOW() - INTERVAL '5 minutes', NULL)
ON CONFLICT (event_id) DO NOTHING;

-- ================================
-- SAMPLE RECONCILIATION RECORDS
-- ================================

-- Insert sample reconciliation records for testing
INSERT INTO payment_reconciliation_log (
    reconciliation_type, status, expected_amount, actual_amount, 
    difference_amount, currency, notes, batch_id
) VALUES
    ('payment', 'matched', 3000, 3000, 0, 'USD', 
     'Test reconciliation - perfect match', uuid_generate_v4()),
     
    ('payment', 'discrepancy', 5000, 4950, -50, 'USD',
     'Test reconciliation - small processing fee difference', uuid_generate_v4()),
     
    ('refund', 'matched', 1500, 1500, 0, 'USD',
     'Test refund reconciliation', uuid_generate_v4())
ON CONFLICT DO NOTHING;

-- ================================
-- INITIAL ANALYTICS DATA
-- ================================

-- Create a view for easy payment analytics
CREATE OR REPLACE VIEW payment_analytics AS
SELECT 
    DATE(sp.created_at_square) as payment_date,
    COUNT(*) as total_payments,
    COUNT(*) FILTER (WHERE sp.status = 'COMPLETED') as successful_payments,
    COUNT(*) FILTER (WHERE sp.status = 'FAILED') as failed_payments,
    COUNT(*) FILTER (WHERE sp.status = 'PENDING') as pending_payments,
    SUM(sp.total_money_amount) FILTER (WHERE sp.status = 'COMPLETED') as total_revenue_cents,
    ROUND(AVG(sp.total_money_amount) FILTER (WHERE sp.status = 'COMPLETED')) as avg_payment_cents,
    COUNT(DISTINCT sp.customer_id) as unique_customers
FROM square_payments sp
WHERE sp.created_at_square >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(sp.created_at_square)
ORDER BY payment_date DESC;

-- Create a view for webhook health monitoring
CREATE OR REPLACE VIEW webhook_health AS
SELECT 
    DATE(sw.received_at) as webhook_date,
    COUNT(*) as total_webhooks,
    COUNT(*) FILTER (WHERE sw.status = 'processed') as processed_webhooks,
    COUNT(*) FILTER (WHERE sw.status = 'failed') as failed_webhooks,
    COUNT(*) FILTER (WHERE sw.status = 'skipped') as skipped_webhooks,
    AVG(EXTRACT(EPOCH FROM (sw.processed_at - sw.received_at))) FILTER (WHERE sw.processed_at IS NOT NULL) as avg_processing_seconds,
    MAX(sw.retry_count) as max_retries
FROM square_webhooks sw
WHERE sw.received_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(sw.received_at)
ORDER BY webhook_date DESC;

-- ================================
-- MAINTENANCE FUNCTIONS
-- ================================

-- Function to clean up old webhook events (retain 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhooks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM square_webhooks 
    WHERE received_at < NOW() - INTERVAL '30 days'
    AND status IN ('processed', 'skipped');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old reconciliation logs (retain 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_reconciliation_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM payment_reconciliation_log 
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND resolution_status = 'resolved';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- INITIAL GRANTS AND PERMISSIONS
-- ================================

-- Grant appropriate permissions to roles
GRANT SELECT, INSERT, UPDATE ON square_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON square_payments TO authenticated;
GRANT SELECT ON square_refunds TO authenticated;
GRANT SELECT ON square_webhooks TO authenticated;
GRANT SELECT ON payment_reconciliation_log TO authenticated;

-- Grant service role permissions for webhook processing
GRANT ALL ON square_webhooks TO service_role;
GRANT ALL ON square_payments TO service_role;
GRANT ALL ON square_customers TO service_role;
GRANT ALL ON square_refunds TO service_role;
GRANT ALL ON payment_reconciliation_log TO service_role;

-- Grant access to views
GRANT SELECT ON payment_analytics TO authenticated;
GRANT SELECT ON webhook_health TO authenticated;

-- ================================
-- COMPLETION MARKER
-- ================================

-- Insert a record to mark successful completion of seed data
INSERT INTO content (key, title, content, type, category, metadata) VALUES
    ('square-seed-data-version', 'Square Seed Data Version', '1.0', 'system', 'internal',
     jsonb_build_object(
         'description', 'Version of Square integration seed data',
         'installed_at', NOW()::TEXT,
         'tables_seeded', jsonb_build_array(
             'square_customers', 'square_payments', 'square_refunds', 
             'square_webhooks', 'payment_reconciliation_log', 'registrations'
         ),
         'views_created', jsonb_build_array('payment_analytics', 'webhook_health'),
         'functions_created', jsonb_build_array('cleanup_old_webhooks', 'cleanup_old_reconciliation_logs')
     ))
ON CONFLICT (key) DO UPDATE SET
    content = EXCLUDED.content,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();