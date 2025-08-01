# Infrastructure Outputs for Founders Day Square Payment System

# S3 and CDN Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for static assets"
  value       = aws_s3_bucket.assets.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for static assets"
  value       = aws_s3_bucket.assets.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.assets.id
}

output "cloudfront_distribution_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.assets.domain_name
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.assets.arn
}

# Database Outputs (Production only)
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = var.environment == "production" ? aws_db_instance.payment_db[0].endpoint : "n/a - staging uses Supabase"
  sensitive   = true
}

output "rds_port" {
  description = "RDS instance port"
  value       = var.environment == "production" ? aws_db_instance.payment_db[0].port : null
}

output "rds_db_name" {
  description = "RDS database name"
  value       = var.environment == "production" ? aws_db_instance.payment_db[0].db_name : null
}

# Security Outputs
output "kms_key_id" {
  description = "ID of the KMS key for payment data encryption"
  value       = aws_kms_key.payment_data.key_id
}

output "kms_key_arn" {
  description = "ARN of the KMS key for payment data encryption"
  value       = aws_kms_key.payment_data.arn
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL (production only)"
  value       = var.environment == "production" ? aws_wafv2_web_acl.payment_protection[0].arn : null
}

# Monitoring Outputs
output "sns_alerts_topic_arn" {
  description = "ARN of the SNS topic for alerts (production only)"
  value       = var.environment == "production" ? aws_sns_topic.alerts[0].arn : null
}

output "cloudwatch_log_group_app" {
  description = "Name of the CloudWatch log group for application logs"
  value       = aws_cloudwatch_log_group.app_logs.name
}

output "cloudwatch_log_group_payments" {
  description = "Name of the CloudWatch log group for payment logs"
  value       = aws_cloudwatch_log_group.payment_logs.name
}

# Network Outputs (Production only)
output "vpc_id" {
  description = "ID of the VPC (production only)"
  value       = var.environment == "production" ? aws_vpc.main[0].id : null
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (production only)"
  value       = var.environment == "production" ? aws_subnet.private[*].id : []
}

output "security_group_rds_id" {
  description = "ID of the RDS security group (production only)"
  value       = var.environment == "production" ? aws_security_group.rds[0].id : null
}

# Configuration Outputs
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "square_environment" {
  description = "Square environment (sandbox/production)"
  value       = local.square_config.environment
}

# Resource Tags
output "common_tags" {
  description = "Common tags applied to all resources"
  value       = local.common_tags
}

# URLs and Endpoints
output "application_url" {
  description = "Application URL (CloudFront distribution)"
  value       = "https://${aws_cloudfront_distribution.assets.domain_name}"
}

output "payment_webhook_url" {
  description = "Square webhook endpoint URL"
  value       = "https://${aws_cloudfront_distribution.assets.domain_name}/api/webhooks/square"
}

# Monitoring Dashboard URLs
output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${local.resource_prefix}-payments"
}

output "waf_dashboard_url" {
  description = "WAF dashboard URL (production only)"
  value       = var.environment == "production" ? "https://console.aws.amazon.com/wafv2/homev2/web-acl/${aws_wafv2_web_acl.payment_protection[0].name}/${aws_wafv2_web_acl.payment_protection[0].id}/overview?region=${var.aws_region}" : null
}

# Deployment Information
output "deployment_timestamp" {
  description = "Timestamp of the deployment"
  value       = timestamp()
}

output "terraform_workspace" {
  description = "Terraform workspace"
  value       = terraform.workspace
}

# Security and Compliance
output "encryption_enabled" {
  description = "Whether encryption at rest is enabled"
  value       = var.enable_encryption_at_rest
}

output "compliance_logging_enabled" {
  description = "Whether compliance logging is enabled"
  value       = var.enable_compliance_logging
}

output "pci_dss_controls_enabled" {
  description = "PCI DSS compliance controls enabled"
  value = {
    waf_protection        = var.enable_waf
    encryption_at_rest    = var.enable_encryption_at_rest
    audit_logging         = var.enable_compliance_logging
    network_segmentation  = var.environment == "production"
    access_controls       = length(var.ip_whitelist) > 0
  }
}

# Cost Optimization Information
output "cost_optimization_settings" {
  description = "Cost optimization settings applied"
  value = {
    cdn_price_class           = var.cdn_price_class
    log_retention_days        = var.log_retention_days
    backup_retention_days     = var.backup_retention_days
    detailed_monitoring       = var.enable_detailed_monitoring
    cross_region_backup       = var.enable_cross_region_backup
  }
}

# Operational Information
output "backup_configuration" {
  description = "Backup configuration details"
  value = {
    retention_days        = var.backup_retention_days
    cross_region_enabled  = var.enable_cross_region_backup
    backup_region         = var.backup_region
    automated_backups     = var.environment == "production"
  }
}

output "monitoring_configuration" {
  description = "Monitoring configuration details"
  value = {
    detailed_monitoring   = var.enable_detailed_monitoring
    debug_logging         = var.enable_debug_logging
    compliance_logging    = var.enable_compliance_logging
    alert_email          = var.monitoring_email != "" ? "configured" : "not_configured"
  }
}

# Performance Settings
output "performance_configuration" {
  description = "Performance configuration settings"
  value = {
    cache_ttl_seconds             = var.cache_ttl_seconds
    payment_processing_timeout    = var.payment_processing_timeout
    webhook_retry_attempts        = var.webhook_retry_attempts
    cdn_enabled                   = true
    compression_enabled           = true
  }
}

# Feature Flags
output "feature_flags" {
  description = "Feature flags configuration"
  value = {
    advanced_analytics        = var.enable_advanced_analytics
    payment_reconciliation    = var.enable_payment_reconciliation
    fraud_detection           = var.enable_fraud_detection
    test_payments_allowed     = var.allow_test_payments
  }
}

# Quick Access Information
output "quick_access_info" {
  description = "Quick access information for operations team"
  value = {
    environment                   = var.environment
    s3_bucket                    = aws_s3_bucket.assets.bucket
    cloudfront_distribution      = aws_cloudfront_distribution.assets.id
    application_url              = "https://${aws_cloudfront_distribution.assets.domain_name}"
    database_endpoint            = var.environment == "production" ? aws_db_instance.payment_db[0].endpoint : "Supabase (external)"
    kms_key_alias               = aws_kms_alias.payment_data.name
    square_environment          = local.square_config.environment
    deployment_region           = var.aws_region
  }
  sensitive = true
}

# Health Check Endpoints
output "health_check_endpoints" {
  description = "Health check endpoints for monitoring"
  value = {
    application_health    = "https://${aws_cloudfront_distribution.assets.domain_name}/api/health"
    payment_health       = "https://${aws_cloudfront_distribution.assets.domain_name}/api/square/health"
    webhook_status       = "https://${aws_cloudfront_distribution.assets.domain_name}/api/webhooks/square/status"
  }
}

# Resource Identifiers for External Tools
output "resource_identifiers" {
  description = "Resource identifiers for external monitoring and automation tools"
  value = {
    aws_account_id           = data.aws_caller_identity.current.account_id
    aws_region              = data.aws_region.current.name
    project_name            = local.project_name
    resource_prefix         = local.resource_prefix
    random_suffix           = random_string.suffix.result
  }
}

# Security Contact Information
output "security_contact_info" {
  description = "Security contact information and escalation procedures"
  value = {
    monitoring_email        = var.monitoring_email != "" ? var.monitoring_email : "not_configured"
    sns_alerts_topic       = var.environment == "production" ? aws_sns_topic.alerts[0].arn : "staging_no_alerts"
    security_scan_enabled  = true
    waf_protection         = var.environment == "production" ? "enabled" : "disabled"
    encryption_key_id      = aws_kms_key.payment_data.key_id
  }
  sensitive = true
}