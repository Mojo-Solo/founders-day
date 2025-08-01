# Infrastructure Variables for Founders Day Square Payment System

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
  default     = "us-east-1"
}

variable "square_application_id" {
  description = "Square Application ID"
  type        = string
  sensitive   = true
}

variable "square_webhook_signature_key" {
  description = "Square Webhook Signature Key"
  type        = string
  sensitive   = true
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  sensitive   = true
}

variable "db_username" {
  description = "Database username (for production RDS)"
  type        = string
  default     = "foundersday_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Database password (for production RDS)"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.db_password) >= 12
    error_message = "Database password must be at least 12 characters long."
  }
}

variable "ssl_certificate_arn" {
  description = "ARN of the SSL certificate in AWS Certificate Manager"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "enable_waf" {
  description = "Enable WAF protection (recommended for production)"
  type        = bool
  default     = true
}

variable "enable_cloudtrail" {
  description = "Enable CloudTrail for audit logging"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
  
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "Backup retention days must be between 1 and 35."
  }
}

variable "monitoring_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Payment Processing Configuration
variable "payment_processing_timeout" {
  description = "Timeout for payment processing in seconds"
  type        = number
  default     = 30
  
  validation {
    condition     = var.payment_processing_timeout >= 10 && var.payment_processing_timeout <= 60
    error_message = "Payment processing timeout must be between 10 and 60 seconds."
  }
}

variable "webhook_retry_attempts" {
  description = "Number of retry attempts for webhook processing"
  type        = number
  default     = 3
  
  validation {
    condition     = var.webhook_retry_attempts >= 1 && var.webhook_retry_attempts <= 5
    error_message = "Webhook retry attempts must be between 1 and 5."
  }
}

# Monitoring Configuration
variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
  
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}

# Security Configuration
variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest for all storage"
  type        = bool
  default     = true
}

variable "allow_public_access" {
  description = "Allow public access to certain resources (false for production)"
  type        = bool
  default     = false
}

variable "ip_whitelist" {
  description = "List of IP addresses/CIDR blocks allowed to access admin endpoints"
  type        = list(string)
  default     = []
}

# Performance Configuration
variable "cdn_price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
  
  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cdn_price_class)
    error_message = "CDN price class must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  }
}

variable "cache_ttl_seconds" {
  description = "Default cache TTL for static assets in seconds"
  type        = number
  default     = 3600
  
  validation {
    condition     = var.cache_ttl_seconds >= 300 && var.cache_ttl_seconds <= 86400
    error_message = "Cache TTL must be between 300 seconds (5 minutes) and 86400 seconds (24 hours)."
  }
}

# Disaster Recovery Configuration
variable "enable_cross_region_backup" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = false
}

variable "backup_region" {
  description = "Secondary region for backup replication"
  type        = string
  default     = "us-west-2"
}

# Compliance Configuration
variable "enable_compliance_logging" {
  description = "Enable additional logging for compliance requirements"
  type        = bool
  default     = true
}

variable "data_residency_region" {
  description = "Region where data must reside for compliance"
  type        = string
  default     = "us-east-1"
}

# Development/Testing Configuration
variable "enable_debug_logging" {
  description = "Enable debug-level logging (not recommended for production)"
  type        = bool
  default     = false
}

variable "allow_test_payments" {
  description = "Allow test payment processing (sandbox mode)"
  type        = bool
  default     = true
}

# Resource Sizing Configuration
variable "database_instance_class" {
  description = "RDS instance class for production database"
  type        = string
  default     = "db.t3.micro"
  
  validation {
    condition     = can(regex("^db\\.", var.database_instance_class))
    error_message = "Database instance class must be a valid RDS instance type (e.g., db.t3.micro)."
  }
}

variable "database_allocated_storage" {
  description = "Initial allocated storage for RDS instance (GB)"
  type        = number
  default     = 20
  
  validation {
    condition     = var.database_allocated_storage >= 20 && var.database_allocated_storage <= 1000
    error_message = "Database allocated storage must be between 20GB and 1000GB."
  }
}

# Feature Flags
variable "enable_advanced_analytics" {
  description = "Enable advanced analytics and reporting features"
  type        = bool
  default     = false
}

variable "enable_payment_reconciliation" {
  description = "Enable automated payment reconciliation"
  type        = bool
  default     = true
}

variable "enable_fraud_detection" {
  description = "Enable fraud detection and prevention features"
  type        = bool
  default     = true
}