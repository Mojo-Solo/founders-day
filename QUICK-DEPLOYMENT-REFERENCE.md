# Quick Deployment Reference
## Founders Day Square Payment Infrastructure

### =€ Quick Start Commands

#### Infrastructure Setup
```bash
# Initialize Terraform
cd infrastructure
terraform init
terraform workspace new staging
terraform plan -var="environment=staging"
terraform apply -var="environment=staging"

# Production setup
terraform workspace new production
terraform plan -var="environment=production"
terraform apply -var="environment=production"
```

#### Backup Operations
```bash
# Create backup
./scripts/deployment/backup-recovery.sh backup --environment production --type full

# Verify backup
./scripts/deployment/backup-recovery.sh verify --environment production

# Check backup status
./scripts/deployment/backup-recovery.sh status --environment production

# Emergency recovery
./scripts/deployment/backup-recovery.sh disaster-recovery --environment production --force
```

#### Monitoring Commands
```bash
# Manual monitoring check
gh workflow run monitoring-alerting.yml -f check_type=all -f environment=production

# Check health endpoints
curl https://foundersday.mn/api/health
curl https://foundersday.mn/api/square/health
curl https://foundersday.mn/api/webhooks/square/status
```

### =Ê Key Files and Locations

#### GitHub Actions Workflows
- `/Users/david/Documents/root/founders-day/founders-day-frontend/.github/workflows/production-pipeline.yml`
- `/Users/david/Documents/root/founders-day/founders-day-frontend/.github/workflows/infrastructure-automation.yml`
- `/Users/david/Documents/root/founders-day/founders-day-frontend/.github/workflows/monitoring-alerting.yml`

#### Infrastructure Code
- `/Users/david/Documents/root/founders-day/founders-day-frontend/infrastructure/main.tf`
- `/Users/david/Documents/root/founders-day/founders-day-frontend/infrastructure/variables.tf`
- `/Users/david/Documents/root/founders-day/founders-day-frontend/infrastructure/outputs.tf`

#### Deployment Scripts
- `/Users/david/Documents/root/founders-day/founders-day-frontend/scripts/deployment/backup-recovery.sh`

#### Documentation
- `/Users/david/Documents/root/founders-day/founders-day-frontend/DEPLOYMENT-AUTOMATION-MONITORING-SUMMARY.md`
- `/Users/david/Documents/root/founders-day/founders-day-frontend/QUICK-DEPLOYMENT-REFERENCE.md`

### =' Common Operations

#### Deploy to Staging
```bash
git push origin main  # Automatic pipeline trigger
```

#### Deploy to Production
```bash
# Automatic after staging validation
# Or manual trigger:
gh workflow run production-pipeline.yml -f environment=production
```

#### Infrastructure Changes
```bash
cd infrastructure
terraform plan -var="environment=production"
terraform apply -var="environment=production"
```

#### Emergency Rollback
```bash
gh workflow run rollback.yml -f environment=production -f version=previous
```

### =È Monitoring Dashboards

#### Key URLs
- CloudWatch: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1`
- WAF Dashboard: `https://console.aws.amazon.com/wafv2/homev2/`
- Application Health: `https://foundersday.mn/api/health`

#### Health Check Endpoints
- Application: `https://foundersday.mn/api/health`
- Payments: `https://foundersday.mn/api/square/health`
- Webhooks: `https://foundersday.mn/api/webhooks/square/status`

### =¨ Emergency Procedures

#### Critical Issue Response
1. Check Slack alerts (`#founders-day-ops`)
2. Review monitoring dashboards
3. Execute rollback if needed
4. Run emergency recovery if required

#### Contact Escalation
1. Slack: `#founders-day-dev`
2. PagerDuty: Automatic escalation
3. Emergency: Direct phone calls for critical issues

### = Required Secrets

#### GitHub Secrets (Repository Settings)
```bash
# AWS
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
TERRAFORM_STATE_BUCKET

# Square
SQUARE_APPLICATION_ID
SQUARE_ACCESS_TOKEN_PRODUCTION
SQUARE_ACCESS_TOKEN_SANDBOX
SQUARE_WEBHOOK_SIGNATURE_KEY

# Database
DATABASE_URL_PRODUCTION
DATABASE_URL_STAGING
SUPABASE_URL
SUPABASE_ANON_KEY

# Monitoring
DATADOG_API_KEY
SLACK_WEBHOOK_URL
PAGERDUTY_INTEGRATION_KEY
SENTRY_DSN

# Domains
DOMAIN_PRODUCTION
DOMAIN_STAGING
```

### =Ë Success Criteria

#### Deployment Success
-  Pipeline completes in < 15 minutes
-  All tests pass (unit, integration, E2E)
-  Security scans pass
-  Health checks pass post-deployment

#### System Health
-  Response time < 2 seconds
-  Error rate < 0.1%
-  Payment success rate > 99%
-  Uptime > 99.9%

### =à Troubleshooting Quick Fixes

#### Deployment Fails
```bash
# Check logs
gh run list --workflow=production-pipeline.yml
gh run view <run-id>

# Manual build test
npm run build
npm run test
```

#### Health Check Fails
```bash
# Check application
curl -v https://foundersday.mn/api/health

# Check database
./scripts/deployment/backup-recovery.sh status --environment production

# Check infrastructure
cd infrastructure && terraform plan
```

#### Monitoring Alert
```bash
# Check system status
./scripts/deployment/backup-recovery.sh status --environment production

# Manual monitoring run
gh workflow run monitoring-alerting.yml -f check_type=all
```

---

**Remember:** Always test changes in staging before production deployment!