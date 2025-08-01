# Terraform Configuration for Founders Day Square Payment Infrastructure
terraform {
  required_version = ">= 1.6.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
  
  backend "s3" {
    # Configuration provided via backend-config during terraform init
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "founders-day"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "founders-day-team"
    }
  }
}

# Data Sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Random suffix for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Local Values
locals {
  project_name = "founders-day"
  common_tags = {
    Project     = local.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = "founders-day-team"
  }
  
  resource_prefix = "${local.project_name}-${var.environment}"
  
  # Square Payment Configuration
  square_config = {
    environment        = var.environment == "production" ? "production" : "sandbox"
    application_id     = var.square_application_id
    webhook_signature_key = var.square_webhook_signature_key
  }
}

# S3 Bucket for Static Assets
resource "aws_s3_bucket" "assets" {
  bucket = "${local.resource_prefix}-assets-${random_string.suffix.result}"
  
  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-assets"
    Type = "static-assets"
  })
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "assets" {
  bucket = aws_s3_bucket.assets.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Distribution
resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "${local.resource_prefix}-assets-oac"
  description                       = "OAC for ${local.resource_prefix} assets bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "assets" {
  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
    origin_id                = "S3-${aws_s3_bucket.assets.bucket}"
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.resource_prefix} CDN for payment assets"
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.assets.bucket}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Cache behavior for payment-related assets with stricter caching
  ordered_cache_behavior {
    path_pattern     = "/api/square/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${aws_s3_bucket.assets.bucket}"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "X-Square-*", "Content-Type"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  price_class = var.environment == "production" ? "PriceClass_All" : "PriceClass_100"

  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-cdn"
    Type = "content-delivery"
  })

  viewer_certificate {
    cloudfront_default_certificate = true
    # In production, you would configure custom SSL certificate here
    # acm_certificate_arn      = var.ssl_certificate_arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  web_acl_id = var.environment == "production" ? aws_wafv2_web_acl.payment_protection[0].arn : null
}

# S3 Bucket Policy for CloudFront
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.assets.arn
          }
        }
      }
    ]
  })
}

# WAF Web ACL for Production (PCI DSS Compliance)
resource "aws_wafv2_web_acl" "payment_protection" {
  count = var.environment == "production" ? 1 : 0
  
  name  = "${local.resource_prefix}-payment-protection"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    action {
      block {}
    }
  }

  # AWS Managed Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
  }

  # SQL Injection Protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 3

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
  }

  # Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 4

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-waf"
    Type = "security"
  })

  visibility_config {
    cloudfront_metrics_enabled = true
    metric_name                = "${local.resource_prefix}-payment-protection"
    sampled_requests_enabled   = true
  }
}

# CloudWatch Log Groups for Application Logging
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/lambda/${local.resource_prefix}-app"
  retention_in_days = var.environment == "production" ? 30 : 7
  
  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-app-logs"
    Type = "logging"
  })
}

resource "aws_cloudwatch_log_group" "payment_logs" {
  name              = "/aws/lambda/${local.resource_prefix}-payments"
  retention_in_days = var.environment == "production" ? 90 : 7
  
  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-payment-logs"
    Type = "logging"
  })
}

# CloudWatch Alarms for Monitoring
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${local.resource_prefix}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorRate"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"
  alarm_description   = "This metric monitors error rate"
  alarm_actions       = var.environment == "production" ? [aws_sns_topic.alerts[0].arn] : []

  dimensions = {
    FunctionName = "${local.resource_prefix}-payment-processor"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-high-error-rate-alarm"
    Type = "monitoring"
  })
}

resource "aws_cloudwatch_metric_alarm" "payment_processing_duration" {
  alarm_name          = "${local.resource_prefix}-payment-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "10000"  # 10 seconds
  alarm_description   = "This metric monitors payment processing duration"
  alarm_actions       = var.environment == "production" ? [aws_sns_topic.alerts[0].arn] : []

  dimensions = {
    FunctionName = "${local.resource_prefix}-payment-processor"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-payment-duration-alarm"
    Type = "monitoring"
  })
}

# SNS Topic for Alerts (Production)
resource "aws_sns_topic" "alerts" {
  count = var.environment == "production" ? 1 : 0
  
  name = "${local.resource_prefix}-alerts"
  
  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-alerts"
    Type = "notification"
  })
}

# KMS Key for Encryption
resource "aws_kms_key" "payment_data" {
  description             = "KMS key for encrypting payment data"
  deletion_window_in_days = var.environment == "production" ? 30 : 7
  
  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-payment-data-key"
    Type = "encryption"
  })
}

resource "aws_kms_alias" "payment_data" {
  name          = "alias/${local.resource_prefix}-payment-data"
  target_key_id = aws_kms_key.payment_data.key_id
}