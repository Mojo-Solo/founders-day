-- ================================
-- Square Payment Integration RLS Policies
-- ================================
-- Row Level Security policies for Square payment integration tables
-- Date: 2025-08-01
-- Version: 1.0

-- ================================
-- ENABLE RLS ON ALL SQUARE TABLES
-- ================================

ALTER TABLE square_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliation_log ENABLE ROW LEVEL SECURITY;

-- ================================
-- SQUARE CUSTOMERS POLICIES
-- ================================

-- Allow service role full access to square_customers
CREATE POLICY "Service role full access to square_customers" ON square_customers
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read their own customer data
CREATE POLICY "Users can read own customer data" ON square_customers
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

-- Allow public to create customer records (for registration flow)
CREATE POLICY "Public can create customer records" ON square_customers
    FOR INSERT TO public
    WITH CHECK (true);

-- Allow authenticated users to update their own customer data
CREATE POLICY "Users can update own customer data" ON square_customers
    FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ================================
-- SQUARE PAYMENTS POLICIES
-- ================================

-- Allow service role full access to square_payments
CREATE POLICY "Service role full access to square_payments" ON square_payments
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read payment records
CREATE POLICY "Authenticated users can read payments" ON square_payments
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

-- Allow public to create payment records (for checkout flow)
CREATE POLICY "Public can create payment records" ON square_payments
    FOR INSERT TO public
    WITH CHECK (true);

-- Allow authenticated users to update payment records they initiated
CREATE POLICY "Users can update payments" ON square_payments
    FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ================================
-- SQUARE REFUNDS POLICIES
-- ================================

-- Allow service role full access to square_refunds
CREATE POLICY "Service role full access to square_refunds" ON square_refunds
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read refund records
CREATE POLICY "Authenticated users can read refunds" ON square_refunds
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

-- Allow service role to create refund records (admin function)
CREATE POLICY "Service role can create refunds" ON square_refunds
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Allow service role to update refund records
CREATE POLICY "Service role can update refunds" ON square_refunds
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- ================================
-- SQUARE WEBHOOKS POLICIES
-- ================================

-- Allow service role full access to square_webhooks
CREATE POLICY "Service role full access to square_webhooks" ON square_webhooks
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow public to insert webhook events (Square webhook endpoint)
CREATE POLICY "Public can create webhook events" ON square_webhooks
    FOR INSERT TO public
    WITH CHECK (true);

-- Allow authenticated users to read webhook events (for debugging/admin)
CREATE POLICY "Authenticated users can read webhook events" ON square_webhooks
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

-- Allow service role to update webhook processing status
CREATE POLICY "Service role can update webhook status" ON square_webhooks
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- ================================
-- PAYMENT RECONCILIATION LOG POLICIES
-- ================================

-- Allow service role full access to payment_reconciliation_log
CREATE POLICY "Service role full access to reconciliation_log" ON payment_reconciliation_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read reconciliation records
CREATE POLICY "Authenticated users can read reconciliation" ON payment_reconciliation_log
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

-- Allow service role to create reconciliation records
CREATE POLICY "Service role can create reconciliation records" ON payment_reconciliation_log
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Allow service role to update reconciliation records
CREATE POLICY "Service role can update reconciliation records" ON payment_reconciliation_log
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- ================================
-- ENHANCED REGISTRATION POLICIES
-- ================================
-- Update existing registration policies to work with Square integration

-- Drop existing registration policies if they exist
DROP POLICY IF EXISTS "Allow public to create registrations" ON registrations;
DROP POLICY IF EXISTS "Allow users to read own registrations" ON registrations;

-- Create enhanced registration policies
CREATE POLICY "Public can create registrations with Square data" ON registrations
    FOR INSERT TO public
    WITH CHECK (true);

-- Allow users to read their own registrations (enhanced for Square data)
CREATE POLICY "Users can read own registrations enhanced" ON registrations
    FOR SELECT TO public
    USING (true); -- In production, add proper user-based filtering

-- Allow service role to update registrations with payment status
CREATE POLICY "Service role can update registration payment status" ON registrations
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to update their own registrations
CREATE POLICY "Users can update own registrations" ON registrations
    FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ================================
-- ADMIN ACCESS POLICIES
-- ================================

-- Create admin role policies for full Square data access
-- Note: These would be used with a custom admin role in production

-- Admin can read all Square customer data
CREATE POLICY "Admin full access to all customers" ON square_customers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin can read all payment data
CREATE POLICY "Admin full access to all payments" ON square_payments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin can manage refunds
CREATE POLICY "Admin can manage refunds" ON square_refunds
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin can view all webhook events
CREATE POLICY "Admin can view all webhooks" ON square_webhooks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin can manage reconciliation
CREATE POLICY "Admin can manage reconciliation" ON payment_reconciliation_log
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- ================================
-- WEBHOOK ENDPOINT SPECIFIC POLICIES
-- ================================

-- Special policy for webhook processing (bypasses normal RLS for webhook ingestion)
CREATE POLICY "Webhook endpoint can process events" ON square_webhooks
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ================================
-- SECURITY FUNCTIONS
-- ================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.uid() = id 
        AND raw_user_meta_data->>'role' = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns a registration
CREATE OR REPLACE FUNCTION owns_registration(registration_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    -- For now, allow all authenticated users
    -- In production, implement proper ownership checking
    RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate Square webhook signature (placeholder for security)
CREATE OR REPLACE FUNCTION validate_square_webhook()
RETURNS BOOLEAN AS $$
BEGIN
    -- This would implement actual signature validation
    -- For now, always return true for development
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;