-- ================================
-- Square Payment Integration Schema
-- ================================
-- Core schema for comprehensive Square payment integration
-- Date: 2025-08-01
-- Version: 1.0

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- 1. SQUARE CUSTOMERS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS square_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    square_customer_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    given_name VARCHAR(100),
    family_name VARCHAR(100),
    phone_number VARCHAR(50),
    company_name VARCHAR(255),
    nickname VARCHAR(100),
    
    -- Address information
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    locality VARCHAR(100), -- City
    administrative_district_level_1 VARCHAR(100), -- State/Province
    postal_code VARCHAR(20),
    country VARCHAR(3), -- ISO 3166-1 alpha-3
    
    -- Metadata and tracking
    created_at_square TIMESTAMPTZ,
    updated_at_square TIMESTAMPTZ,
    version BIGINT DEFAULT 0,
    
    -- Local tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error')),
    
    -- Indexes
    CONSTRAINT square_customers_email_idx UNIQUE (email)
);

-- ================================
-- 2. SQUARE PAYMENTS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS square_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    square_payment_id VARCHAR(255) UNIQUE NOT NULL,
    square_order_id VARCHAR(255),
    square_location_id VARCHAR(255) NOT NULL,
    
    -- Customer relationship
    square_customer_id VARCHAR(255),
    customer_id UUID REFERENCES square_customers(id) ON DELETE SET NULL,
    
    -- Registration relationship
    registration_id BIGINT REFERENCES registrations(id) ON DELETE SET NULL,
    
    -- Payment details
    amount_money_amount BIGINT NOT NULL, -- Amount in smallest currency unit (cents)
    amount_money_currency VARCHAR(3) DEFAULT 'USD',
    tip_money_amount BIGINT DEFAULT 0,
    tip_money_currency VARCHAR(3) DEFAULT 'USD',
    total_money_amount BIGINT NOT NULL,
    total_money_currency VARCHAR(3) DEFAULT 'USD',
    
    -- Payment method
    source_type VARCHAR(50), -- 'CARD', 'BANK_ACCOUNT', 'WALLET', etc.
    card_brand VARCHAR(50), -- 'VISA', 'MASTERCARD', etc.
    card_last_4 VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    card_fingerprint VARCHAR(255),
    card_prepaid_type VARCHAR(50), -- 'PREPAID', 'NOT_PREPAID', 'UNKNOWN'
    
    -- Transaction details
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'COMPLETED', 'CANCELED', 'FAILED', etc.
    delay_duration VARCHAR(50), -- For delayed capture
    delay_action VARCHAR(50), -- 'CANCEL', 'COMPLETE'
    
    -- Processing information
    processing_fee_amount BIGINT DEFAULT 0,
    processing_fee_currency VARCHAR(3) DEFAULT 'USD',
    receipt_number VARCHAR(255),
    receipt_url TEXT,
    
    -- Risk assessment
    risk_evaluation JSONB,
    verification_results JSONB,
    
    -- Square timestamps
    created_at_square TIMESTAMPTZ NOT NULL,
    updated_at_square TIMESTAMPTZ NOT NULL,
    
    -- Local tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error')),
    
    -- Additional metadata
    note TEXT,
    reference_id VARCHAR(255), -- External reference
    team_member_id VARCHAR(255), -- If processed by team member
    buyer_email_address VARCHAR(255),
    
    -- Application fee (if applicable)
    application_fee_money_amount BIGINT DEFAULT 0,
    application_fee_money_currency VARCHAR(3) DEFAULT 'USD'
);

-- ================================
-- 3. SQUARE REFUNDS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS square_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    square_refund_id VARCHAR(255) UNIQUE NOT NULL,
    square_payment_id VARCHAR(255) NOT NULL,
    payment_id UUID REFERENCES square_payments(id) ON DELETE CASCADE,
    
    -- Refund details
    amount_money_amount BIGINT NOT NULL,
    amount_money_currency VARCHAR(3) DEFAULT 'USD',
    reason TEXT,
    
    -- Status and processing
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'COMPLETED', 'FAILED', 'REJECTED'
    processing_fee_amount BIGINT DEFAULT 0,
    processing_fee_currency VARCHAR(3) DEFAULT 'USD',
    
    -- Square timestamps
    created_at_square TIMESTAMPTZ NOT NULL,
    updated_at_square TIMESTAMPTZ NOT NULL,
    
    -- Local tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error'))
);

-- ================================
-- 4. SQUARE WEBHOOKS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS square_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    
    -- Source information
    merchant_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255),
    
    -- Event data
    event_data JSONB NOT NULL,
    api_version VARCHAR(20),
    
    -- Processing status
    status VARCHAR(20) DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'skipped')),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Request details
    signature_verified BOOLEAN DEFAULT false,
    raw_body TEXT,
    headers JSONB,
    
    -- Timestamps
    created_at_square TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 5. PAYMENT RECONCILIATION LOG
-- ================================
CREATE TABLE IF NOT EXISTS payment_reconciliation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Payment references
    square_payment_id VARCHAR(255),
    payment_id UUID REFERENCES square_payments(id) ON DELETE SET NULL,
    registration_id BIGINT REFERENCES registrations(id) ON DELETE SET NULL,
    
    -- Reconciliation details
    reconciliation_type VARCHAR(50) NOT NULL, -- 'payment', 'refund', 'dispute', 'adjustment'
    status VARCHAR(50) NOT NULL, -- 'matched', 'unmatched', 'discrepancy', 'resolved'
    
    -- Amounts
    expected_amount BIGINT,
    actual_amount BIGINT,
    difference_amount BIGINT DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Resolution
    resolution_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'resolved', 'escalated'
    resolution_notes TEXT,
    resolved_by UUID, -- Reference to user who resolved
    resolved_at TIMESTAMPTZ,
    
    -- Metadata
    batch_id UUID, -- For batch reconciliation
    reconciled_by UUID, -- Reference to user who performed reconciliation
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 6. UPDATE EXISTING REGISTRATIONS TABLE
-- ================================
-- Add Square-specific columns to existing registrations table
DO $$ 
BEGIN 
    -- Add Square customer ID column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations' AND column_name = 'square_customer_id') THEN
        ALTER TABLE registrations ADD COLUMN square_customer_id VARCHAR(255);
    END IF;
    
    -- Add Square payment ID column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations' AND column_name = 'square_payment_id') THEN
        ALTER TABLE registrations ADD COLUMN square_payment_id VARCHAR(255);
    END IF;
    
    -- Add payment method column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations' AND column_name = 'payment_method') THEN
        ALTER TABLE registrations ADD COLUMN payment_method VARCHAR(50) DEFAULT 'square';
    END IF;
    
    -- Add payment processor data column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations' AND column_name = 'payment_processor_data') THEN
        ALTER TABLE registrations ADD COLUMN payment_processor_data JSONB;
    END IF;
    
    -- Add last sync timestamp if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations' AND column_name = 'square_synced_at') THEN
        ALTER TABLE registrations ADD COLUMN square_synced_at TIMESTAMPTZ;
    END IF;
END $$;

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Square Customers Indexes
CREATE INDEX IF NOT EXISTS idx_square_customers_square_id ON square_customers(square_customer_id);
CREATE INDEX IF NOT EXISTS idx_square_customers_email ON square_customers(email);
CREATE INDEX IF NOT EXISTS idx_square_customers_sync_status ON square_customers(sync_status);
CREATE INDEX IF NOT EXISTS idx_square_customers_created_at ON square_customers(created_at);

-- Square Payments Indexes
CREATE INDEX IF NOT EXISTS idx_square_payments_square_id ON square_payments(square_payment_id);
CREATE INDEX IF NOT EXISTS idx_square_payments_customer_id ON square_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_square_payments_registration_id ON square_payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_square_payments_status ON square_payments(status);
CREATE INDEX IF NOT EXISTS idx_square_payments_created_at ON square_payments(created_at_square);
CREATE INDEX IF NOT EXISTS idx_square_payments_sync_status ON square_payments(sync_status);
CREATE INDEX IF NOT EXISTS idx_square_payments_location_id ON square_payments(square_location_id);

-- Square Refunds Indexes
CREATE INDEX IF NOT EXISTS idx_square_refunds_square_id ON square_refunds(square_refund_id);
CREATE INDEX IF NOT EXISTS idx_square_refunds_payment_id ON square_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_square_refunds_status ON square_refunds(status);
CREATE INDEX IF NOT EXISTS idx_square_refunds_created_at ON square_refunds(created_at_square);

-- Square Webhooks Indexes
CREATE INDEX IF NOT EXISTS idx_square_webhooks_event_id ON square_webhooks(event_id);
CREATE INDEX IF NOT EXISTS idx_square_webhooks_event_type ON square_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_square_webhooks_merchant_id ON square_webhooks(merchant_id);
CREATE INDEX IF NOT EXISTS idx_square_webhooks_status ON square_webhooks(status);
CREATE INDEX IF NOT EXISTS idx_square_webhooks_created_at ON square_webhooks(created_at_square);
CREATE INDEX IF NOT EXISTS idx_square_webhooks_retry_count ON square_webhooks(retry_count);

-- Payment Reconciliation Indexes
CREATE INDEX IF NOT EXISTS idx_reconciliation_payment_id ON payment_reconciliation_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_registration_id ON payment_reconciliation_log(registration_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON payment_reconciliation_log(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_type ON payment_reconciliation_log(reconciliation_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_created_at ON payment_reconciliation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_reconciliation_batch_id ON payment_reconciliation_log(batch_id);

-- Registration Square-related indexes
CREATE INDEX IF NOT EXISTS idx_registrations_square_customer_id ON registrations(square_customer_id);
CREATE INDEX IF NOT EXISTS idx_registrations_square_payment_id ON registrations(square_payment_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_method ON registrations(payment_method);

-- ================================
-- UPDATED TIMESTAMP FUNCTIONS
-- ================================

-- Update the existing update_updated_at_column function to handle all new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating timestamps on new tables
CREATE TRIGGER update_square_customers_updated_at 
    BEFORE UPDATE ON square_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_square_payments_updated_at 
    BEFORE UPDATE ON square_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_square_refunds_updated_at 
    BEFORE UPDATE ON square_refunds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_square_webhooks_updated_at 
    BEFORE UPDATE ON square_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_reconciliation_log_updated_at 
    BEFORE UPDATE ON payment_reconciliation_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();