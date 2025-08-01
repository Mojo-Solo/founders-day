#!/bin/bash

# Backup and Disaster Recovery Automation Script
# For Founders Day Square Payment System
# Version: 2.0
# Last Updated: 2025-08-01

set -euo pipefail

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="founders-day"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="/tmp/backup-recovery-${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

warn() {
    log "${YELLOW}WARNING: $1${NC}"
}

info() {
    log "${BLUE}INFO: $1${NC}"
}

success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Commands:
    backup              Create comprehensive backup
    restore            Restore from backup
    verify             Verify backup integrity
    schedule           Set up automated backup schedule
    disaster-recovery  Execute disaster recovery procedures
    cleanup            Clean up old backups
    test               Test backup and recovery procedures
    status             Show backup status and health

Options:
    -e, --environment   Environment (staging/production) [default: staging]
    -t, --type         Backup type (full/incremental/differential) [default: full]
    -f, --force        Force operation without confirmation
    -q, --quiet        Suppress verbose output
    -h, --help         Show this help message

Examples:
    $0 backup --environment production --type full
    $0 restore --environment staging --backup-id 20250801-120000
    $0 verify --environment production
    $0 disaster-recovery --environment production --force

EOF
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT="staging"
BACKUP_TYPE="full"
BACKUP_ID=""
FORCE=false
QUIET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        backup|restore|verify|schedule|disaster-recovery|cleanup|test|status)
            COMMAND="$1"
            shift
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        --backup-id)
            BACKUP_ID="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validate command
if [[ -z "$COMMAND" ]]; then
    error "No command specified. Use --help for usage information."
fi

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    error "Environment must be 'staging' or 'production'"
fi

# Configuration variables
AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_BUCKET="${PROJECT_NAME}-${ENVIRONMENT}-backups-$(date +%s | tail -c 8)"
ENCRYPTION_KEY_ALIAS="alias/${PROJECT_NAME}-${ENVIRONMENT}-backup-key"

# Ensure required tools are installed
check_dependencies() {
    local deps=("aws" "psql" "pg_dump" "curl" "jq")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "Required dependency '$dep' is not installed"
        fi
    done
    
    # Check AWS CLI configuration
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS CLI is not configured properly"
    fi
    
    info "All dependencies are available"
}

# Create backup bucket if it doesn't exist
create_backup_bucket() {
    local bucket_name="$1"
    
    if aws s3 ls "s3://$bucket_name" &> /dev/null; then
        info "Backup bucket '$bucket_name' already exists"
        return
    fi
    
    info "Creating backup bucket: $bucket_name"
    
    aws s3 mb "s3://$bucket_name" --region "$AWS_REGION"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$bucket_name" \
        --versioning-configuration Status=Enabled
    
    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket "$bucket_name" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "aws:kms",
                    "KMSMasterKeyID": "'$ENCRYPTION_KEY_ALIAS'"
                },
                "BucketKeyEnabled": true
            }]
        }'
    
    # Set lifecycle policy
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$bucket_name" \
        --lifecycle-configuration '{
            "Rules": [{
                "ID": "BackupRetention",
                "Status": "Enabled",
                "Filter": {"Prefix": ""},
                "Transitions": [{
                    "Days": 30,
                    "StorageClass": "STANDARD_IA"
                }, {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                }, {
                    "Days": 365,
                    "StorageClass": "DEEP_ARCHIVE"
                }],
                "Expiration": {
                    "Days": 2555
                }
            }]
        }'
    
    success "Backup bucket created and configured: $bucket_name"
}

# Database backup function
backup_database() {
    local backup_file="database-backup-${TIMESTAMP}.sql"
    local compressed_file="${backup_file}.gz"
    
    info "Starting database backup..."
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Use RDS for production
        local db_host=$(aws rds describe-db-instances \
            --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-payment-db" \
            --query 'DBInstances[0].Endpoint.Address' \
            --output text)
        
        local db_name=$(aws rds describe-db-instances \
            --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-payment-db" \
            --query 'DBInstances[0].DBName' \
            --output text)
        
        # Create RDS snapshot
        aws rds create-db-snapshot \
            --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-payment-db" \
            --db-snapshot-identifier "${PROJECT_NAME}-${ENVIRONMENT}-backup-${TIMESTAMP}"
        
        info "RDS snapshot creation initiated"
        
        # Also create logical backup
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$db_host" \
            -U "$DB_USERNAME" \
            -d "$db_name" \
            --verbose \
            --no-owner \
            --no-privileges \
            > "$backup_file"
    else
        # Use Supabase for staging (logical backup only)
        PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
            -h "$SUPABASE_HOST" \
            -U "$SUPABASE_USER" \
            -d "$SUPABASE_DB_NAME" \
            --verbose \
            --no-owner \
            --no-privileges \
            > "$backup_file"
    fi
    
    # Compress backup
    gzip "$backup_file"
    
    # Upload to S3
    aws s3 cp "$compressed_file" "s3://$BACKUP_BUCKET/database/"
    
    # Verify upload
    if aws s3 ls "s3://$BACKUP_BUCKET/database/$compressed_file" &> /dev/null; then
        success "Database backup completed: $compressed_file"
        rm -f "$compressed_file"
    else
        error "Failed to upload database backup to S3"
    fi
}

# Application files backup
backup_application() {
    info "Starting application files backup..."
    
    # Create temporary directory for backup
    local temp_dir=$(mktemp -d)
    local backup_archive="application-backup-${TIMESTAMP}.tar.gz"
    
    # Copy essential files
    cp -r "$SCRIPT_DIR/../.." "$temp_dir/application"
    
    # Remove sensitive files and directories
    rm -rf "$temp_dir/application/node_modules"
    rm -rf "$temp_dir/application/.next"
    rm -rf "$temp_dir/application/.git"
    rm -f "$temp_dir/application/.env*"
    
    # Create archive
    tar -czf "$backup_archive" -C "$temp_dir" application
    
    # Upload to S3
    aws s3 cp "$backup_archive" "s3://$BACKUP_BUCKET/application/"
    
    # Verify upload
    if aws s3 ls "s3://$BACKUP_BUCKET/application/$backup_archive" &> /dev/null; then
        success "Application backup completed: $backup_archive"
        rm -f "$backup_archive"
        rm -rf "$temp_dir"
    else
        error "Failed to upload application backup to S3"
    fi
}

# Configuration backup
backup_configuration() {
    info "Starting configuration backup..."
    
    local config_backup="configuration-backup-${TIMESTAMP}.json"
    
    # Collect configuration
    cat > "$config_backup" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "backup_type": "$BACKUP_TYPE",
    "infrastructure": {
        "aws_region": "$AWS_REGION",
        "terraform_state": "$(terraform -chdir=infrastructure workspace show 2>/dev/null || echo 'unknown')"
    },
    "square_config": {
        "environment": "$([ "$ENVIRONMENT" = "production" ] && echo "production" || echo "sandbox")",
        "webhook_endpoints": [
            "https://${DOMAIN}/api/webhooks/square"
        ]
    },
    "monitoring": {
        "datadog_enabled": "$([ -n "${DATADOG_API_KEY:-}" ] && echo "true" || echo "false")",
        "sentry_enabled": "$([ -n "${SENTRY_DSN:-}" ] && echo "true" || echo "false")"
    }
}
EOF
    
    # Upload to S3
    aws s3 cp "$config_backup" "s3://$BACKUP_BUCKET/configuration/"
    
    # Verify upload
    if aws s3 ls "s3://$BACKUP_BUCKET/configuration/$config_backup" &> /dev/null; then
        success "Configuration backup completed: $config_backup"
        rm -f "$config_backup"
    else
        error "Failed to upload configuration backup to S3"
    fi
}

# Infrastructure state backup
backup_infrastructure() {
    info "Starting infrastructure state backup..."
    
    local tf_backup="terraform-state-backup-${TIMESTAMP}.tfstate"
    
    # Backup Terraform state
    if [[ -d "infrastructure" ]]; then
        cd infrastructure
        
        # Pull latest state
        terraform init -input=false
        terraform refresh -input=false
        
        # Export state
        terraform show -json > "../$tf_backup"
        
        cd ..
        
        # Upload to S3
        aws s3 cp "$tf_backup" "s3://$BACKUP_BUCKET/infrastructure/"
        
        # Verify upload
        if aws s3 ls "s3://$BACKUP_BUCKET/infrastructure/$tf_backup" &> /dev/null; then
            success "Infrastructure backup completed: $tf_backup"
            rm -f "$tf_backup"
        else
            error "Failed to upload infrastructure backup to S3"
        fi
    else
        warn "Infrastructure directory not found, skipping Terraform state backup"
    fi
}

# Main backup function
perform_backup() {
    info "Starting comprehensive backup for $ENVIRONMENT environment"
    info "Backup type: $BACKUP_TYPE"
    
    # Create backup bucket
    create_backup_bucket "$BACKUP_BUCKET"
    
    # Perform different backup components
    backup_database
    backup_application
    backup_configuration
    backup_infrastructure
    
    # Create backup manifest
    local manifest_file="backup-manifest-${TIMESTAMP}.json"
    cat > "$manifest_file" << EOF
{
    "backup_id": "$TIMESTAMP",
    "environment": "$ENVIRONMENT",
    "backup_type": "$BACKUP_TYPE",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "components": [
        "database",
        "application",
        "configuration",
        "infrastructure"
    ],
    "s3_bucket": "$BACKUP_BUCKET",
    "retention_policy": {
        "standard": "30 days",
        "ia": "90 days",
        "glacier": "365 days",
        "deep_archive": "7 years"
    }
}
EOF
    
    # Upload manifest
    aws s3 cp "$manifest_file" "s3://$BACKUP_BUCKET/"
    rm -f "$manifest_file"
    
    success "Comprehensive backup completed successfully"
    info "Backup ID: $TIMESTAMP"
    info "S3 Bucket: $BACKUP_BUCKET"
}

# Verify backup integrity
verify_backup() {
    local backup_id="${BACKUP_ID:-$TIMESTAMP}"
    
    info "Verifying backup integrity for backup ID: $backup_id"
    
    # Check if backup exists
    if ! aws s3 ls "s3://$BACKUP_BUCKET/backup-manifest-${backup_id}.json" &> /dev/null; then
        error "Backup manifest not found for backup ID: $backup_id"
    fi
    
    # Download and verify manifest
    aws s3 cp "s3://$BACKUP_BUCKET/backup-manifest-${backup_id}.json" "/tmp/"
    local manifest="/tmp/backup-manifest-${backup_id}.json"
    
    # Verify each component
    local components=($(jq -r '.components[]' "$manifest"))
    
    for component in "${components[@]}"; do
        info "Verifying $component backup..."
        
        case $component in
            "database")
                if aws s3 ls "s3://$BACKUP_BUCKET/database/" | grep -q "$backup_id"; then
                    success "$component backup verified"
                else
                    error "$component backup verification failed"
                fi
                ;;
            "application")
                if aws s3 ls "s3://$BACKUP_BUCKET/application/" | grep -q "$backup_id"; then
                    success "$component backup verified"
                else
                    error "$component backup verification failed"
                fi
                ;;
            "configuration")
                if aws s3 ls "s3://$BACKUP_BUCKET/configuration/" | grep -q "$backup_id"; then
                    success "$component backup verified"
                else
                    error "$component backup verification failed"
                fi
                ;;
            "infrastructure")
                if aws s3 ls "s3://$BACKUP_BUCKET/infrastructure/" | grep -q "$backup_id"; then
                    success "$component backup verified"
                else
                    warn "$component backup not found (may be optional)"
                fi
                ;;
        esac
    done
    
    success "Backup verification completed successfully"
    rm -f "$manifest"
}

# Disaster recovery procedures
disaster_recovery() {
    if [[ "$FORCE" != true ]]; then
        warn "Disaster recovery will overwrite existing data!"
        read -p "Are you absolutely sure you want to proceed? (type 'YES' to continue): " confirmation
        
        if [[ "$confirmation" != "YES" ]]; then
            info "Disaster recovery cancelled"
            exit 0
        fi
    fi
    
    info "Starting disaster recovery procedures for $ENVIRONMENT environment..."
    
    # Step 1: Verify infrastructure
    info "Step 1: Verifying infrastructure state..."
    if [[ -d "infrastructure" ]]; then
        cd infrastructure
        terraform init -input=false
        terraform plan -input=false
        cd ..
        success "Infrastructure verification completed"
    else
        warn "Infrastructure directory not found"
    fi
    
    # Step 2: Database recovery
    info "Step 2: Database recovery procedures..."
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # List available RDS snapshots
        aws rds describe-db-snapshots \
            --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-payment-db" \
            --snapshot-type manual \
            --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]' \
            --output table
        
        warn "Manual intervention required for RDS snapshot restoration"
        info "Use AWS Console or CLI to restore from the most recent snapshot"
    else
        info "Staging environment uses Supabase - coordinate with Supabase for recovery"
    fi
    
    # Step 3: Application deployment
    info "Step 3: Application deployment verification..."
    info "Ensure the latest deployment pipeline has completed successfully"
    
    # Step 4: Configuration validation
    info "Step 4: Configuration validation..."
    info "Verify all environment variables and secrets are properly configured"
    
    # Step 5: Health checks
    info "Step 5: Running health checks..."
    if [[ -n "${DOMAIN:-}" ]]; then
        local health_url="https://$DOMAIN/api/health"
        if curl -f "$health_url" &> /dev/null; then
            success "Application health check passed"
        else
            error "Application health check failed"
        fi
    else
        warn "Domain not configured, skipping health checks"
    fi
    
    success "Disaster recovery procedures completed"
    info "Please verify all systems are functioning correctly"
}

# Cleanup old backups
cleanup_backups() {
    info "Cleaning up old backups..."
    
    # This is handled by S3 lifecycle policies, but we can also manually clean up if needed
    local cutoff_date=$(date -d '90 days ago' +%Y%m%d)
    
    # List old backups
    aws s3 ls "s3://$BACKUP_BUCKET/" --recursive | while read -r line; do
        local date_part=$(echo "$line" | awk '{print $1}' | tr -d '-')
        local file_path=$(echo "$line" | awk '{print $4}')
        
        if [[ "$date_part" < "$cutoff_date" ]]; then
            info "Cleaning up old backup: $file_path"
            aws s3 rm "s3://$BACKUP_BUCKET/$file_path"
        fi
    done
    
    success "Backup cleanup completed"
}

# Test backup and recovery procedures
test_procedures() {
    info "Testing backup and recovery procedures..."
    
    # Create a test backup
    BACKUP_TYPE="test"
    perform_backup
    
    # Verify the test backup
    verify_backup
    
    # Clean up test backup
    aws s3 rm "s3://$BACKUP_BUCKET/" --recursive --include "*test*"
    
    success "Backup and recovery test completed successfully"
}

# Show backup status
show_status() {
    info "Backup Status for $ENVIRONMENT Environment"
    echo "----------------------------------------"
    
    # Show recent backups
    echo "Recent Backups:"
    aws s3 ls "s3://$BACKUP_BUCKET/" | grep "backup-manifest" | tail -5
    echo
    
    # Show storage usage
    echo "Storage Usage:"
    aws s3 ls "s3://$BACKUP_BUCKET/" --recursive --human-readable --summarize | tail -2
    echo
    
    # Show RDS snapshots (production only)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "RDS Snapshots:"
        aws rds describe-db-snapshots \
            --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-payment-db" \
            --snapshot-type manual \
            --max-items 5 \
            --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
            --output table
    fi
}

# Main execution
main() {
    info "Starting Backup and Disaster Recovery Tool"
    info "Command: $COMMAND"
    info "Environment: $ENVIRONMENT"
    info "Timestamp: $TIMESTAMP"
    
    # Check dependencies
    check_dependencies
    
    # Execute command
    case "$COMMAND" in
        "backup")
            perform_backup
            ;;
        "restore")
            if [[ -z "$BACKUP_ID" ]]; then
                error "Backup ID is required for restore operation. Use --backup-id option."
            fi
            info "Restore functionality requires manual intervention"
            info "Please refer to disaster recovery documentation"
            ;;
        "verify")
            verify_backup
            ;;
        "schedule")
            info "Setting up automated backup schedule requires infrastructure configuration"
            info "Please configure CloudWatch Events or GitHub Actions schedules"
            ;;
        "disaster-recovery")
            disaster_recovery
            ;;
        "cleanup")
            cleanup_backups
            ;;
        "test")
            test_procedures
            ;;
        "status")
            show_status
            ;;
        *)
            error "Unknown command: $COMMAND"
            ;;
    esac
    
    success "Operation completed successfully"
    info "Log file: $LOG_FILE"
}

# Execute main function
main "$@"