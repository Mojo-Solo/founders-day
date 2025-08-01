-- ================================
-- Square Payment Integration Helper Functions
-- ================================
-- Utility functions for Square payment processing and management
-- Date: 2025-08-01
-- Version: 1.0

-- ================================
-- CUSTOMER MANAGEMENT FUNCTIONS
-- ================================

-- Function to create or update Square customer
CREATE OR REPLACE FUNCTION upsert_square_customer(
    p_square_customer_id VARCHAR(255),
    p_email VARCHAR(255),
    p_given_name VARCHAR(100) DEFAULT NULL,
    p_family_name VARCHAR(100) DEFAULT NULL,
    p_phone_number VARCHAR(50) DEFAULT NULL,
    p_company_name VARCHAR(255) DEFAULT NULL,
    p_address_line_1 VARCHAR(255) DEFAULT NULL,
    p_address_line_2 VARCHAR(255) DEFAULT NULL,
    p_locality VARCHAR(100) DEFAULT NULL,
    p_administrative_district_level_1 VARCHAR(100) DEFAULT NULL,
    p_postal_code VARCHAR(20) DEFAULT NULL,
    p_country VARCHAR(3) DEFAULT 'USA',
    p_created_at_square TIMESTAMPTZ DEFAULT NOW(),
    p_updated_at_square TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    customer_id UUID;
BEGIN
    INSERT INTO square_customers (
        square_customer_id, email, given_name, family_name, phone_number,
        company_name, address_line_1, address_line_2, locality,
        administrative_district_level_1, postal_code, country,
        created_at_square, updated_at_square, synced_at, sync_status
    ) VALUES (
        p_square_customer_id, p_email, p_given_name, p_family_name, p_phone_number,
        p_company_name, p_address_line_1, p_address_line_2, p_locality,
        p_administrative_district_level_1, p_postal_code, p_country,
        p_created_at_square, p_updated_at_square, NOW(), 'synced'
    )
    ON CONFLICT (square_customer_id) DO UPDATE SET
        email = EXCLUDED.email,
        given_name = EXCLUDED.given_name,
        family_name = EXCLUDED.family_name,
        phone_number = EXCLUDED.phone_number,
        company_name = EXCLUDED.company_name,
        address_line_1 = EXCLUDED.address_line_1,
        address_line_2 = EXCLUDED.address_line_2,
        locality = EXCLUDED.locality,
        administrative_district_level_1 = EXCLUDED.administrative_district_level_1,
        postal_code = EXCLUDED.postal_code,
        country = EXCLUDED.country,
        updated_at_square = p_updated_at_square,
        synced_at = NOW(),
        sync_status = 'synced',
        updated_at = NOW()
    RETURNING id INTO customer_id;
    
    RETURN customer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer by Square ID
CREATE OR REPLACE FUNCTION get_square_customer_by_square_id(p_square_customer_id VARCHAR(255))
RETURNS TABLE (
    id UUID,
    square_customer_id VARCHAR(255),
    email VARCHAR(255),
    given_name VARCHAR(100),
    family_name VARCHAR(100),
    phone_number VARCHAR(50),
    sync_status VARCHAR(20),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id, sc.square_customer_id, sc.email, sc.given_name, 
        sc.family_name, sc.phone_number, sc.sync_status,
        sc.created_at, sc.updated_at
    FROM square_customers sc
    WHERE sc.square_customer_id = p_square_customer_id;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- PAYMENT PROCESSING FUNCTIONS
-- ================================

-- Function to create Square payment record
CREATE OR REPLACE FUNCTION create_square_payment(
    p_square_payment_id VARCHAR(255),
    p_square_location_id VARCHAR(255),
    p_registration_id BIGINT,
    p_square_customer_id VARCHAR(255) DEFAULT NULL,
    p_amount_money_amount BIGINT,
    p_amount_money_currency VARCHAR(3) DEFAULT 'USD',
    p_total_money_amount BIGINT,
    p_source_type VARCHAR(50) DEFAULT NULL,
    p_card_brand VARCHAR(50) DEFAULT NULL,
    p_card_last_4 VARCHAR(4) DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT 'PENDING',
    p_buyer_email_address VARCHAR(255) DEFAULT NULL,
    p_reference_id VARCHAR(255) DEFAULT NULL,
    p_created_at_square TIMESTAMPTZ DEFAULT NOW(),
    p_updated_at_square TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    payment_id UUID;
    customer_uuid UUID;
BEGIN
    -- Get customer UUID if square_customer_id provided
    IF p_square_customer_id IS NOT NULL THEN
        SELECT id INTO customer_uuid 
        FROM square_customers 
        WHERE square_customer_id = p_square_customer_id;
    END IF;
    
    INSERT INTO square_payments (
        square_payment_id, square_location_id, registration_id, 
        square_customer_id, customer_id, amount_money_amount, 
        amount_money_currency, total_money_amount, source_type,
        card_brand, card_last_4, status, buyer_email_address,
        reference_id, created_at_square, updated_at_square,
        synced_at, sync_status
    ) VALUES (
        p_square_payment_id, p_square_location_id, p_registration_id,
        p_square_customer_id, customer_uuid, p_amount_money_amount,
        p_amount_money_currency, p_total_money_amount, p_source_type,
        p_card_brand, p_card_last_4, p_status, p_buyer_email_address,
        p_reference_id, p_created_at_square, p_updated_at_square,
        NOW(), 'synced'
    )
    RETURNING id INTO payment_id;
    
    -- Update registration with payment information
    IF p_registration_id IS NOT NULL THEN
        UPDATE registrations SET
            square_payment_id = p_square_payment_id,
            square_customer_id = p_square_customer_id,
            payment_method = 'square',
            status = CASE 
                WHEN p_status = 'COMPLETED' THEN 'confirmed'
                WHEN p_status = 'FAILED' THEN 'failed'
                ELSE 'pending_payment'
            END,
            square_synced_at = NOW(),
            payment_processor_data = jsonb_build_object(
                'square_payment_id', p_square_payment_id,
                'amount', p_total_money_amount,
                'currency', p_amount_money_currency,
                'status', p_status,
                'processed_at', p_created_at_square
            )
        WHERE id = p_registration_id;
    END IF;
    
    RETURN payment_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update payment status
CREATE OR REPLACE FUNCTION update_square_payment_status(
    p_square_payment_id VARCHAR(255),
    p_status VARCHAR(50),
    p_updated_at_square TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    payment_found BOOLEAN := FALSE;
    reg_id BIGINT;
BEGIN
    -- Update payment status
    UPDATE square_payments SET
        status = p_status,
        updated_at_square = p_updated_at_square,
        synced_at = NOW(),
        sync_status = 'synced',
        updated_at = NOW()
    WHERE square_payment_id = p_square_payment_id
    RETURNING registration_id INTO reg_id;
    
    GET DIAGNOSTICS payment_found = ROW_COUNT;
    
    -- Update corresponding registration if exists
    IF payment_found AND reg_id IS NOT NULL THEN
        UPDATE registrations SET
            status = CASE 
                WHEN p_status = 'COMPLETED' THEN 'confirmed'
                WHEN p_status = 'FAILED' THEN 'failed'
                WHEN p_status = 'CANCELED' THEN 'cancelled'
                ELSE 'pending_payment'
            END,
            paidAt = CASE WHEN p_status = 'COMPLETED' THEN p_updated_at_square ELSE paidAt END,
            square_synced_at = NOW(),
            payment_processor_data = payment_processor_data || jsonb_build_object(
                'status', p_status,
                'updated_at', p_updated_at_square
            )
        WHERE id = reg_id;
    END IF;
    
    RETURN payment_found;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- WEBHOOK PROCESSING FUNCTIONS
-- ================================

-- Function to process webhook event
CREATE OR REPLACE FUNCTION process_square_webhook(
    p_event_id VARCHAR(255),
    p_event_type VARCHAR(100),
    p_merchant_id VARCHAR(255),
    p_location_id VARCHAR(255) DEFAULT NULL,
    p_event_data JSONB,
    p_api_version VARCHAR(20) DEFAULT NULL,
    p_created_at_square TIMESTAMPTZ DEFAULT NOW(),
    p_signature_verified BOOLEAN DEFAULT FALSE,
    p_raw_body TEXT DEFAULT NULL,
    p_headers JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    webhook_id UUID;
    payment_data JSONB;
    customer_data JSONB;
    refund_data JSONB;
BEGIN
    -- Insert webhook event
    INSERT INTO square_webhooks (
        event_id, event_type, merchant_id, location_id, event_data,
        api_version, signature_verified, raw_body, headers,
        created_at_square, received_at, status
    ) VALUES (
        p_event_id, p_event_type, p_merchant_id, p_location_id, p_event_data,
        p_api_version, p_signature_verified, p_raw_body, p_headers,
        p_created_at_square, NOW(), 'received'
    )
    ON CONFLICT (event_id) DO UPDATE SET
        status = 'duplicate',
        received_at = NOW()
    RETURNING id INTO webhook_id;
    
    -- Process based on event type
    CASE p_event_type
        WHEN 'payment.created', 'payment.updated' THEN
            payment_data := p_event_data->'object'->'payment';
            PERFORM sync_payment_from_webhook(payment_data);
            
        WHEN 'customer.created', 'customer.updated' THEN
            customer_data := p_event_data->'object'->'customer';
            PERFORM sync_customer_from_webhook(customer_data);
            
        WHEN 'refund.created', 'refund.updated' THEN
            refund_data := p_event_data->'object'->'refund';
            PERFORM sync_refund_from_webhook(refund_data);
            
        ELSE
            -- Unknown event type, mark as skipped
            UPDATE square_webhooks SET status = 'skipped', processed_at = NOW()
            WHERE id = webhook_id;
    END CASE;
    
    -- Mark as processed
    UPDATE square_webhooks SET 
        status = 'processed', 
        processed_at = NOW() 
    WHERE id = webhook_id;
    
    RETURN webhook_id;
END;
$$ LANGUAGE plpgsql;

-- Function to sync payment from webhook data
CREATE OR REPLACE FUNCTION sync_payment_from_webhook(payment_data JSONB)
RETURNS VOID AS $$
DECLARE
    square_payment_id VARCHAR(255);
    payment_status VARCHAR(50);
    amount BIGINT;
    currency VARCHAR(3);
    created_at TIMESTAMPTZ;
    updated_at TIMESTAMPTZ;
BEGIN
    square_payment_id := payment_data->>'id';
    payment_status := payment_data->>'status';
    amount := (payment_data->'total_money'->>'amount')::BIGINT;
    currency := payment_data->'total_money'->>'currency';
    created_at := (payment_data->>'created_at')::TIMESTAMPTZ;
    updated_at := (payment_data->>'updated_at')::TIMESTAMPTZ;
    
    -- Update existing payment or ignore if not found
    PERFORM update_square_payment_status(square_payment_id, payment_status, updated_at);
END;
$$ LANGUAGE plpgsql;

-- Function to sync customer from webhook data
CREATE OR REPLACE FUNCTION sync_customer_from_webhook(customer_data JSONB)
RETURNS VOID AS $$
DECLARE
    square_customer_id VARCHAR(255);
    email VARCHAR(255);
    given_name VARCHAR(100);
    family_name VARCHAR(100);
    created_at TIMESTAMPTZ;
    updated_at TIMESTAMPTZ;
BEGIN
    square_customer_id := customer_data->>'id';
    email := customer_data->>'email_address';
    given_name := customer_data->>'given_name';
    family_name := customer_data->>'family_name';
    created_at := (customer_data->>'created_at')::TIMESTAMPTZ;
    updated_at := (customer_data->>'updated_at')::TIMESTAMPTZ;
    
    -- Upsert customer
    PERFORM upsert_square_customer(
        square_customer_id, email, given_name, family_name,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'USA',
        created_at, updated_at
    );
END;
$$ LANGUAGE plpgsql;

-- Function to sync refund from webhook data
CREATE OR REPLACE FUNCTION sync_refund_from_webhook(refund_data JSONB)
RETURNS VOID AS $$
DECLARE
    square_refund_id VARCHAR(255);
    square_payment_id VARCHAR(255);
    amount BIGINT;
    currency VARCHAR(3);
    status VARCHAR(50);
    reason TEXT;
    created_at TIMESTAMPTZ;
    updated_at TIMESTAMPTZ;
    payment_uuid UUID;
BEGIN
    square_refund_id := refund_data->>'id';
    square_payment_id := refund_data->>'payment_id';
    amount := (refund_data->'amount_money'->>'amount')::BIGINT;
    currency := refund_data->'amount_money'->>'currency';
    status := refund_data->>'status';
    reason := refund_data->>'reason';
    created_at := (refund_data->>'created_at')::TIMESTAMPTZ;
    updated_at := (refund_data->>'updated_at')::TIMESTAMPTZ;
    
    -- Get payment UUID
    SELECT id INTO payment_uuid FROM square_payments WHERE square_payment_id = square_payment_id;
    
    -- Insert or update refund
    INSERT INTO square_refunds (
        square_refund_id, square_payment_id, payment_id,
        amount_money_amount, amount_money_currency, reason, status,
        created_at_square, updated_at_square, synced_at, sync_status
    ) VALUES (
        square_refund_id, square_payment_id, payment_uuid,
        amount, currency, reason, status,
        created_at, updated_at, NOW(), 'synced'
    )
    ON CONFLICT (square_refund_id) DO UPDATE SET
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        updated_at_square = EXCLUDED.updated_at_square,
        synced_at = NOW(),
        sync_status = 'synced',
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ================================
-- RECONCILIATION FUNCTIONS
-- ================================

-- Function to create reconciliation record
CREATE OR REPLACE FUNCTION create_reconciliation_record(
    p_square_payment_id VARCHAR(255),
    p_registration_id BIGINT,
    p_reconciliation_type VARCHAR(50),
    p_expected_amount BIGINT,
    p_actual_amount BIGINT,
    p_currency VARCHAR(3) DEFAULT 'USD',
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    reconciliation_id UUID;
    payment_uuid UUID;
    difference BIGINT;
    rec_status VARCHAR(50);
BEGIN
    -- Calculate difference
    difference := p_actual_amount - p_expected_amount;
    
    -- Determine status
    rec_status := CASE 
        WHEN difference = 0 THEN 'matched'
        WHEN ABS(difference) <= 100 THEN 'matched' -- Allow $1 difference for processing fees
        ELSE 'discrepancy'
    END;
    
    -- Get payment UUID
    SELECT id INTO payment_uuid FROM square_payments WHERE square_payment_id = p_square_payment_id;
    
    INSERT INTO payment_reconciliation_log (
        square_payment_id, payment_id, registration_id, reconciliation_type,
        status, expected_amount, actual_amount, difference_amount, currency, notes
    ) VALUES (
        p_square_payment_id, payment_uuid, p_registration_id, p_reconciliation_type,
        rec_status, p_expected_amount, p_actual_amount, difference, p_currency, p_notes
    )
    RETURNING id INTO reconciliation_id;
    
    RETURN reconciliation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get payment reconciliation status
CREATE OR REPLACE FUNCTION get_payment_reconciliation_status(p_square_payment_id VARCHAR(255))
RETURNS TABLE (
    reconciliation_id UUID,
    status VARCHAR(50),
    expected_amount BIGINT,
    actual_amount BIGINT,
    difference_amount BIGINT,
    created_at TIMESTAMPTZ,
    resolution_status VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        prl.id, prl.status, prl.expected_amount, prl.actual_amount,
        prl.difference_amount, prl.created_at, prl.resolution_status
    FROM payment_reconciliation_log prl
    WHERE prl.square_payment_id = p_square_payment_id
    ORDER BY prl.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- ANALYTICS AND REPORTING FUNCTIONS
-- ================================

-- Function to get payment summary by date range
CREATE OR REPLACE FUNCTION get_payment_summary(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_payments BIGINT,
    total_amount BIGINT,
    successful_payments BIGINT,
    successful_amount BIGINT,
    failed_payments BIGINT,
    pending_payments BIGINT,
    refund_count BIGINT,
    refund_amount BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(sp.total_money_amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE sp.status = 'COMPLETED') as successful_payments,
        COALESCE(SUM(sp.total_money_amount) FILTER (WHERE sp.status = 'COMPLETED'), 0) as successful_amount,
        COUNT(*) FILTER (WHERE sp.status = 'FAILED') as failed_payments,
        COUNT(*) FILTER (WHERE sp.status = 'PENDING') as pending_payments,
        COALESCE(SUM(CASE WHEN sr.id IS NOT NULL THEN 1 ELSE 0 END), 0) as refund_count,
        COALESCE(SUM(sr.amount_money_amount), 0) as refund_amount
    FROM square_payments sp
    LEFT JOIN square_refunds sr ON sp.id = sr.payment_id
    WHERE DATE(sp.created_at_square) BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get webhook processing health
CREATE OR REPLACE FUNCTION get_webhook_health()
RETURNS TABLE (
    total_webhooks BIGINT,
    processed_webhooks BIGINT,
    failed_webhooks BIGINT,
    pending_webhooks BIGINT,
    average_processing_time INTERVAL,
    last_webhook_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_webhooks,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_webhooks,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_webhooks,
        COUNT(*) FILTER (WHERE status IN ('received', 'processing')) as pending_webhooks,
        AVG(processed_at - received_at) FILTER (WHERE processed_at IS NOT NULL) as average_processing_time,
        MAX(received_at) as last_webhook_time
    FROM square_webhooks
    WHERE received_at >= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;