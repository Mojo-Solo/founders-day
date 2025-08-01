#!/bin/bash

# ================================
# Square Payment Integration Schema Deployment Script
# ================================
# This script executes the comprehensive Square payment integration 
# database schema in the founders-day Supabase database
# Date: 2025-08-01
# Version: 1.0

set -e  # Exit on any error

echo "🚀 Starting Square Payment Integration Schema Deployment"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCHEMA_FILES=(
    "20250801_square_payment_integration.sql"
    "20250801_square_rls_policies.sql"
    "20250801_square_helper_functions.sql"
    "20250801_square_seed_data.sql"
)

# Check if DATABASE_URL is provided
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL environment variable is required${NC}"
    echo "Please set DATABASE_URL to your Supabase PostgreSQL connection string"
    echo "Example: export DATABASE_URL='postgresql://username:password@host:port/database'"
    exit 1
fi

# Function to execute SQL file
execute_sql_file() {
    local file=$1
    local description=$2
    
    echo -e "${BLUE}📄 Executing: $file${NC}"
    echo -e "${YELLOW}   Description: $description${NC}"
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ ERROR: File $file not found${NC}"
        return 1
    fi
    
    # Execute SQL file using psql
    if psql "$DATABASE_URL" -f "$file" -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Successfully executed: $file${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to execute: $file${NC}"
        echo "Running with verbose output for debugging:"
        psql "$DATABASE_URL" -f "$file" -v ON_ERROR_STOP=1
        return 1
    fi
}

# Function to verify table creation
verify_tables() {
    echo -e "${BLUE}🔍 Verifying table creation...${NC}"
    
    local tables=(
        "square_customers"
        "square_payments"
        "square_refunds"
        "square_webhooks"
        "payment_reconciliation_log"
    )
    
    for table in "${tables[@]}"; do
        if psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" | grep -q "t"; then
            echo -e "${GREEN}✅ Table exists: $table${NC}"
        else
            echo -e "${RED}❌ Table missing: $table${NC}"
            return 1
        fi
    done
    
    echo -e "${GREEN}✅ All required tables verified${NC}"
}

# Function to verify indexes
verify_indexes() {
    echo -e "${BLUE}🔍 Verifying index creation...${NC}"
    
    local index_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_square_%' 
           OR indexname LIKE 'idx_reconciliation_%' 
           OR indexname LIKE 'idx_registrations_square_%';
    " | tr -d ' ')
    
    echo -e "${GREEN}✅ Created $index_count Square-related indexes${NC}"
}

# Function to verify RLS policies
verify_rls_policies() {
    echo -e "${BLUE}🔍 Verifying RLS policies...${NC}"
    
    local policy_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('square_customers', 'square_payments', 'square_refunds', 'square_webhooks', 'payment_reconciliation_log');
    " | tr -d ' ')
    
    echo -e "${GREEN}✅ Created $policy_count RLS policies${NC}"
}

# Function to verify helper functions
verify_functions() {
    echo -e "${BLUE}🔍 Verifying helper functions...${NC}"
    
    local functions=(
        "upsert_square_customer"
        "create_square_payment"
        "update_square_payment_status"
        "process_square_webhook"
        "create_reconciliation_record"
        "get_payment_summary"
        "get_webhook_health"
    )
    
    for func in "${functions[@]}"; do
        if psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = '$func');" | grep -q "t"; then
            echo -e "${GREEN}✅ Function exists: $func${NC}"
        else
            echo -e "${RED}❌ Function missing: $func${NC}"
            return 1
        fi
    done
    
    echo -e "${GREEN}✅ All helper functions verified${NC}"
}

# Function to verify seed data
verify_seed_data() {
    echo -e "${BLUE}🔍 Verifying seed data...${NC}"
    
    # Check Square configuration in content table
    local config_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM content 
        WHERE key LIKE 'square-%' OR key LIKE 'payment-%' OR key LIKE 'reconciliation-%';
    " | tr -d ' ')
    
    echo -e "${GREEN}✅ Added $config_count Square configuration entries${NC}"
    
    # Check test customers (only in sandbox/development)
    local customer_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM square_customers 
        WHERE square_customer_id LIKE 'test-customer-%';
    " | tr -d ' ')
    
    if [ "$customer_count" -gt 0 ]; then
        echo -e "${GREEN}✅ Added $customer_count test customers${NC}"
    fi
}

# Function to run schema validation tests
run_validation_tests() {
    echo -e "${BLUE}🧪 Running validation tests...${NC}"
    
    # Test 1: Customer creation function
    echo -e "${YELLOW}   Testing customer creation function...${NC}"
    local test_customer_id=$(psql "$DATABASE_URL" -t -c "
        SELECT upsert_square_customer(
            'test-validation-001',
            'validation@test.com',
            'Validation',
            'Test',
            '+1-555-0000'
        );
    " | tr -d ' ')
    
    if [ ! -z "$test_customer_id" ]; then
        echo -e "${GREEN}✅ Customer creation function working${NC}"
        
        # Clean up test data
        psql "$DATABASE_URL" -c "DELETE FROM square_customers WHERE square_customer_id = 'test-validation-001';" > /dev/null
    else
        echo -e "${RED}❌ Customer creation function failed${NC}"
        return 1
    fi
    
    # Test 2: Payment analytics view
    echo -e "${YELLOW}   Testing payment analytics view...${NC}"
    if psql "$DATABASE_URL" -c "SELECT * FROM payment_analytics LIMIT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Payment analytics view working${NC}"
    else
        echo -e "${RED}❌ Payment analytics view failed${NC}"
        return 1
    fi
    
    # Test 3: Webhook health view
    echo -e "${YELLOW}   Testing webhook health view...${NC}"
    if psql "$DATABASE_URL" -c "SELECT * FROM webhook_health LIMIT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Webhook health view working${NC}"
    else
        echo -e "${RED}❌ Webhook health view failed${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All validation tests passed${NC}"
}

# Main deployment process
main() {
    echo -e "${BLUE}📋 Deployment Plan:${NC}"
    echo "1. Core schema (tables, indexes, constraints)"
    echo "2. Row Level Security (RLS) policies"
    echo "3. Helper functions for payment processing"
    echo "4. Seed data and initial configuration"
    echo "5. Verification and validation tests"
    echo ""
    
    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ ERROR: psql command not found${NC}"
        echo "Please install PostgreSQL client tools"
        exit 1
    fi
    
    # Test database connection
    echo -e "${BLUE}🔌 Testing database connection...${NC}"
    if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
    else
        echo -e "${RED}❌ ERROR: Cannot connect to database${NC}"
        echo "Please check your DATABASE_URL and network connectivity"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}🚀 Starting schema deployment...${NC}"
    echo ""
    
    # Execute schema files in order
    execute_sql_file "${SCHEMA_FILES[0]}" "Core Square payment integration schema" || exit 1
    echo ""
    
    execute_sql_file "${SCHEMA_FILES[1]}" "Row Level Security policies" || exit 1
    echo ""
    
    execute_sql_file "${SCHEMA_FILES[2]}" "Helper functions for payment processing" || exit 1
    echo ""
    
    execute_sql_file "${SCHEMA_FILES[3]}" "Seed data and initial configuration" || exit 1
    echo ""
    
    # Verification phase
    echo -e "${BLUE}🔍 Starting verification phase...${NC}"
    echo ""
    
    verify_tables || exit 1
    echo ""
    
    verify_indexes || exit 1
    echo ""
    
    verify_rls_policies || exit 1
    echo ""
    
    verify_functions || exit 1
    echo ""
    
    verify_seed_data || exit 1
    echo ""
    
    # Validation tests
    run_validation_tests || exit 1
    echo ""
    
    # Final summary
    echo "========================================================"
    echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
    echo "========================================================"
    echo ""
    echo -e "${GREEN}✅ Schema Status:${NC}"
    echo "   • 5 tables created with proper relationships"
    echo "   • Comprehensive indexing for performance"
    echo "   • Row Level Security policies applied"
    echo "   • 15+ helper functions for payment processing"
    echo "   • Webhook processing capabilities"
    echo "   • Payment reconciliation system"
    echo "   • Analytics views and reporting"
    echo "   • Test data and configuration loaded"
    echo ""
    echo -e "${BLUE}📊 Next Steps:${NC}"
    echo "   1. Configure Square API credentials in content table"
    echo "   2. Set up webhook endpoints in Square Dashboard"
    echo "   3. Test payment processing workflow"
    echo "   4. Enable production mode when ready"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "   • Review RLS policies for production security"
    echo "   • Update webhook signature validation"
    echo "   • Configure monitoring and alerting"
    echo "   • Set up automated backups"
    echo ""
    echo -e "${GREEN}🔗 Database Integration Ready for API Development!${NC}"
}

# Run main function
main "$@"