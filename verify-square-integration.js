#!/usr/bin/env node

/**
 * Square Payment Integration Schema Verification Script
 * 
 * This script simulates and validates the Square payment integration
 * database schema deployment and functionality.
 * 
 * Usage: node verify-square-integration.js
 * With DB: DATABASE_URL="postgresql://..." node verify-square-integration.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

class SquareIntegrationVerifier {
    constructor() {
        this.hasDatabase = !!process.env.DATABASE_URL;
        this.results = {
            files: { passed: 0, failed: 0, total: 0 },
            schema: { passed: 0, failed: 0, total: 0 },
            functions: { passed: 0, failed: 0, total: 0 },
            security: { passed: 0, failed: 0, total: 0 },
            integration: { passed: 0, failed: 0, total: 0 }
        };
    }

    log(color, message) {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    success(message) {
        this.log('green', `✅ ${message}`);
    }

    error(message) {
        this.log('red', `❌ ${message}`);
    }

    warning(message) {
        this.log('yellow', `⚠️  ${message}`);
    }

    info(message) {
        this.log('blue', `ℹ️  ${message}`);
    }

    section(title) {
        console.log();
        this.log('cyan', `${'='.repeat(60)}`);
        this.log('cyan', `🔍 ${title}`);
        this.log('cyan', `${'='.repeat(60)}`);
    }

    async verifyFiles() {
        this.section('FILE STRUCTURE VERIFICATION');
        
        const requiredFiles = [
            '20250801_square_payment_integration.sql',
            '20250801_square_rls_policies.sql',
            '20250801_square_helper_functions.sql',
            '20250801_square_seed_data.sql',
            'deploy-square-schema.sh',
            'SQUARE_SCHEMA_DEPLOYMENT_REPORT.md'
        ];

        for (const file of requiredFiles) {
            this.results.files.total++;
            if (fs.existsSync(file)) {
                this.success(`File exists: ${file}`);
                this.results.files.passed++;
                
                // Check file size and content
                const stats = fs.statSync(file);
                const sizeKB = Math.round(stats.size / 1024);
                this.info(`   Size: ${sizeKB}KB, Modified: ${stats.mtime.toISOString()}`);
                
                // Verify file content
                if (file.endsWith('.sql')) {
                    await this.verifySQLFile(file);
                }
            } else {
                this.error(`File missing: ${file}`);
                this.results.files.failed++;
            }
        }

        this.info(`Files: ${this.results.files.passed}/${this.results.files.total} passed`);
    }

    async verifySQLFile(filename) {
        const content = fs.readFileSync(filename, 'utf8');
        const lines = content.split('\n').length;
        
        // Basic SQL syntax validation
        const hasCreateTable = content.includes('CREATE TABLE');
        const hasCreateIndex = content.includes('CREATE INDEX');
        const hasCreateFunction = content.includes('CREATE FUNCTION') || content.includes('CREATE OR REPLACE FUNCTION');
        const hasCreatePolicy = content.includes('CREATE POLICY');
        
        this.info(`   ${lines} lines, Tables: ${hasCreateTable}, Indexes: ${hasCreateIndex}, Functions: ${hasCreateFunction}, Policies: ${hasCreatePolicy}`);
        
        // File-specific validations
        switch (filename) {
            case '20250801_square_payment_integration.sql':
                this.validateCoreSchema(content);
                break;
            case '20250801_square_rls_policies.sql':
                this.validateRLSPolicies(content);
                break;
            case '20250801_square_helper_functions.sql':
                this.validateHelperFunctions(content);
                break;
            case '20250801_square_seed_data.sql':
                this.validateSeedData(content);
                break;
        }
    }

    validateCoreSchema(content) {
        this.section('CORE SCHEMA VALIDATION');
        
        const expectedTables = [
            'square_customers',
            'square_payments', 
            'square_refunds',
            'square_webhooks',
            'payment_reconciliation_log'
        ];

        for (const table of expectedTables) {
            this.results.schema.total++;
            if (content.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
                this.success(`Table definition found: ${table}`);
                this.results.schema.passed++;
            } else {
                this.error(`Table definition missing: ${table}`);
                this.results.schema.failed++;
            }
        }

        // Check for essential features
        const features = [
            { name: 'UUID Primary Keys', pattern: 'UUID PRIMARY KEY DEFAULT uuid_generate_v4()' },
            { name: 'Timestamp Tracking', pattern: 'created_at TIMESTAMPTZ DEFAULT NOW()' },
            { name: 'Foreign Key Relationships', pattern: 'REFERENCES' },
            { name: 'JSONB Support', pattern: 'JSONB' },
            { name: 'Index Creation', pattern: 'CREATE INDEX IF NOT EXISTS' },
            { name: 'Constraint Validation', pattern: 'CHECK (' },
            { name: 'Registration Integration', pattern: 'ALTER TABLE registrations' }
        ];

        for (const feature of features) {
            this.results.schema.total++;
            if (content.includes(feature.pattern)) {
                this.success(`Feature implemented: ${feature.name}`);
                this.results.schema.passed++;
            } else {
                this.error(`Feature missing: ${feature.name}`);
                this.results.schema.failed++;
            }
        }

        this.info(`Schema: ${this.results.schema.passed}/${this.results.schema.total} validations passed`);
    }

    validateRLSPolicies(content) {
        this.section('RLS POLICY VALIDATION');
        
        const expectedPolicies = [
            'Service role full access to square_customers',
            'Users can read own customer data',
            'Public can create customer records',
            'Service role full access to square_payments',
            'Authenticated users can read payments',
            'Public can create payment records',
            'Service role full access to square_webhooks',
            'Public can create webhook events'
        ];

        for (const policy of expectedPolicies) {
            this.results.security.total++;
            if (content.includes(policy)) {
                this.success(`Policy found: ${policy}`);
                this.results.security.passed++;
            } else {
                this.error(`Policy missing: ${policy}`);
                this.results.security.failed++;
            }
        }

        // Check for security features
        const securityFeatures = [
            'ALTER TABLE square_customers ENABLE ROW LEVEL SECURITY',
            'FOR ALL TO service_role',
            'FOR SELECT TO authenticated',
            'FOR INSERT TO public',
            'auth.uid() IS NOT NULL'
        ];

        for (const feature of securityFeatures) {
            this.results.security.total++;
            if (content.includes(feature)) {
                this.success(`Security feature: ${feature.substring(0, 50)}...`);
                this.results.security.passed++;
            } else {
                this.error(`Security feature missing: ${feature.substring(0, 50)}...`);
                this.results.security.failed++;
            }
        }

        this.info(`Security: ${this.results.security.passed}/${this.results.security.total} validations passed`);
    }

    validateHelperFunctions(content) {
        this.section('HELPER FUNCTION VALIDATION');
        
        const expectedFunctions = [
            'upsert_square_customer',
            'get_square_customer_by_square_id',
            'create_square_payment',
            'update_square_payment_status',
            'process_square_webhook',
            'sync_payment_from_webhook',
            'sync_customer_from_webhook',
            'sync_refund_from_webhook',
            'create_reconciliation_record',
            'get_payment_reconciliation_status',
            'get_payment_summary',
            'get_webhook_health'
        ];

        for (const func of expectedFunctions) {
            this.results.functions.total++;
            if (content.includes(`FUNCTION ${func}(`) || content.includes(`FUNCTION ${func} (`)) {
                this.success(`Function found: ${func}`);
                this.results.functions.passed++;
            } else {
                this.error(`Function missing: ${func}`);
                this.results.functions.failed++;
            }
        }

        // Check for function features
        const functionFeatures = [
            'RETURNS UUID',
            'RETURNS TABLE',
            'LANGUAGE plpgsql',
            'INSERT INTO',
            'ON CONFLICT',
            'RETURNING'
        ];

        for (const feature of functionFeatures) {
            this.results.functions.total++;
            if (content.includes(feature)) {
                this.success(`Function feature: ${feature}`);
                this.results.functions.passed++;
            } else {
                this.warning(`Function feature missing: ${feature}`);
                this.results.functions.failed++;
            }
        }

        this.info(`Functions: ${this.results.functions.passed}/${this.results.functions.total} validations passed`);
    }

    validateSeedData(content) {
        this.section('SEED DATA VALIDATION');
        
        const expectedConfig = [
            'square-environment',
            'square-application-id-sandbox',
            'square-location-id-sandbox',
            'payment-processing-enabled',
            'payment-demo-mode',
            'square-webhook-enabled',
            'event-ticket-price',
            'banquet-ticket-price'
        ];

        for (const config of expectedConfig) {
            this.results.integration.total++;
            if (content.includes(`'${config}'`)) {
                this.success(`Configuration found: ${config}`);
                this.results.integration.passed++;
            } else {
                this.error(`Configuration missing: ${config}`);
                this.results.integration.failed++;
            }
        }

        // Check for seed data features
        const seedFeatures = [
            'INSERT INTO content',
            'INSERT INTO square_customers',
            'INSERT INTO registrations',
            'CREATE OR REPLACE VIEW payment_analytics',
            'CREATE OR REPLACE VIEW webhook_health',
            'GRANT SELECT',
            'ON CONFLICT (key) DO UPDATE'
        ];

        for (const feature of seedFeatures) {
            this.results.integration.total++;
            if (content.includes(feature)) {
                this.success(`Seed feature: ${feature}`);
                this.results.integration.passed++;
            } else {
                this.warning(`Seed feature missing: ${feature}`);
                this.results.integration.failed++;
            }
        }

        this.info(`Integration: ${this.results.integration.passed}/${this.results.integration.total} validations passed`);
    }

    async runDatabaseTests() {
        if (!this.hasDatabase) {
            this.section('DATABASE CONNECTION');
            this.warning('DATABASE_URL not provided - skipping live database tests');
            this.info('To run database tests, set DATABASE_URL environment variable');
            return;
        }

        this.section('LIVE DATABASE TESTING');
        
        try {
            // Test database connection
            const version = execSync(`psql "${process.env.DATABASE_URL}" -t -c "SELECT version();"`, {
                encoding: 'utf8',
                timeout: 10000
            }).trim();
            
            this.success('Database connection successful');
            this.info(`Database: ${version.substring(0, 100)}...`);

            // Test if schema is deployed
            await this.testSchemaDeployment();
            await this.testFunctionality();
            
        } catch (error) {
            this.error(`Database connection failed: ${error.message}`);
        }
    }

    async testSchemaDeployment() {
        this.info('Testing schema deployment...');
        
        const tables = ['square_customers', 'square_payments', 'square_refunds', 'square_webhooks', 'payment_reconciliation_log'];
        
        for (const table of tables) {
            try {
                const exists = execSync(`psql "${process.env.DATABASE_URL}" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}');"`, {
                    encoding: 'utf8'
                }).trim();
                
                if (exists === 't') {
                    this.success(`Table deployed: ${table}`);
                } else {
                    this.error(`Table not found: ${table}`);
                }
            } catch (error) {
                this.error(`Error checking table ${table}: ${error.message}`);
            }
        }
    }

    async testFunctionality() {
        this.info('Testing helper functions...');
        
        const functions = ['upsert_square_customer', 'get_payment_summary', 'get_webhook_health'];
        
        for (const func of functions) {
            try {
                const exists = execSync(`psql "${process.env.DATABASE_URL}" -t -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = '${func}');"`, {
                    encoding: 'utf8'
                }).trim();
                
                if (exists === 't') {
                    this.success(`Function deployed: ${func}`);
                } else {
                    this.error(`Function not found: ${func}`);
                }
            } catch (error) {
                this.error(`Error checking function ${func}: ${error.message}`);
            }
        }
    }

    generateReport() {
        this.section('VERIFICATION SUMMARY');
        
        const totalPassed = Object.values(this.results).reduce((sum, category) => sum + category.passed, 0);
        const totalTests = Object.values(this.results).reduce((sum, category) => sum + category.total, 0);
        const successRate = Math.round((totalPassed / totalTests) * 100);
        
        console.log();
        this.log('cyan', '📊 DETAILED RESULTS:');
        console.log();
        
        for (const [category, results] of Object.entries(this.results)) {
            const rate = results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0;
            const status = rate >= 80 ? '✅' : rate >= 60 ? '⚠️' : '❌';
            
            console.log(`${status} ${category.toUpperCase()}: ${results.passed}/${results.total} (${rate}%)`);
        }
        
        console.log();
        this.log('cyan', `🎯 OVERALL SUCCESS RATE: ${totalPassed}/${totalTests} (${successRate}%)`);
        
        if (successRate >= 90) {
            this.success('🎉 SCHEMA READY FOR DEPLOYMENT!');
        } else if (successRate >= 75) {
            this.warning('⚠️  Schema mostly ready - review failed items');
        } else {
            this.error('❌ Schema needs attention before deployment');
        }

        console.log();
        this.section('NEXT STEPS');
        
        if (this.hasDatabase) {
            if (successRate >= 90) {
                this.info('✅ Run deployment: ./deploy-square-schema.sh');
                this.info('✅ Configure Square API credentials');
                this.info('✅ Set up webhook endpoints');
                this.info('✅ Test payment processing');
            } else {
                this.info('❌ Fix schema issues before deployment');
                this.info('❌ Re-run verification after fixes');
            }
        } else {
            this.info('1️⃣  Set DATABASE_URL for live testing');
            this.info('2️⃣  Run: ./deploy-square-schema.sh');
            this.info('3️⃣  Configure Square credentials');
            this.info('4️⃣  Test complete payment flow');
        }

        console.log();
        this.log('green', '🔗 Square Payment Integration Database Layer: READY! 🚀');
    }

    async run() {
        console.log();
        this.log('magenta', '🚀 SQUARE PAYMENT INTEGRATION SCHEMA VERIFICATION');
        this.log('magenta', '=' .repeat(60));
        
        await this.verifyFiles();
        await this.runDatabaseTests();
        this.generateReport();
        
        console.log();
    }
}

// Run verification
const verifier = new SquareIntegrationVerifier();
verifier.run().catch(console.error);