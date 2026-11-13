variable "aws_region" { type = string }
variable "google_oauth_secret_arn" {
  type    = string
  default = null
}
variable "microsoft_oidc_providers" {
  type    = map(object({ tenant_id = string, client_id = string, client_secret_arn = string, label = string }))
  default = {}
}
variable "invitation_ses_identity_arn" {
  type    = string
  default = null
  validation {
    condition     = var.invitation_ses_identity_arn == null ? true : can(regex("^arn:aws:ses:[a-z0-9-]+:[0-9]{12}:identity/.+$", var.invitation_ses_identity_arn))
    error_message = "Provide an existing SES verified identity ARN, not email credentials."
  }
}
variable "invitation_sender_email" {
  type    = string
  default = ""
}
variable "aws_account_id" { type = string }
variable "runtime_permissions_boundary_arn" {
  type    = string
  default = null
}
variable "database_instance_class" {
  type    = string
  default = "db.t3.medium"
}
variable "postgres_engine_version" {
  type    = string
  default = "16.15"
}
variable "database_deletion_protection" {
  type    = bool
  default = true
}
variable "cognito_deletion_protection" {
  type    = string
  default = "ACTIVE"
  validation {
    condition     = contains(["ACTIVE", "INACTIVE"], var.cognito_deletion_protection)
    error_message = "Use ACTIVE normally; INACTIVE requires separate reviewed destroy preparation."
  }
}
variable "api_lambda_artifact_hash" {
  type    = string
  default = null
}
variable "provisioning_lambda_artifact_hash" {
  type    = string
  default = null
}
variable "expiry_lambda_artifact_hash" {
  type    = string
  default = null
}
variable "migration_lambda_artifact_hash" {
  type    = string
  default = null
}
variable "environment" {
  type    = string
  default = "prod"
}
variable "project_name" {
  type    = string
  default = "permissionhub"
}
variable "vpc_cidr" { type = string }
variable "availability_zones" { type = list(string) }
variable "public_subnet_cidrs" { type = list(string) }
variable "private_app_subnet_cidrs" { type = list(string) }
variable "private_db_subnet_cidrs" { type = list(string) }
variable "enable_rds_proxy" {
  type    = bool
  default = true
}
variable "interface_endpoint_services" {
  type    = list(string)
  default = ["secretsmanager", "sts", "logs", "sqs"]
}
variable "frontend_url" { type = string }
variable "allowed_origins" { type = list(string) }
variable "allowed_methods" {
  type    = list(string)
  default = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}
variable "allowed_headers" {
  type    = list(string)
  default = ["authorization", "content-type", "x-csrf-token", "idempotency-key", "x-aws-account-record-id"]
}
variable "callback_urls" { type = list(string) }
variable "logout_urls" { type = list(string) }
variable "enable_cognito_domain" {
  type    = bool
  default = false
}
variable "cognito_domain_prefix" {
  type    = string
  default = ""
}
variable "lambda_runtime" {
  type    = string
  default = "nodejs22.x"
}
variable "lambda_artifact_bucket" { type = string }
variable "api_lambda_artifact_key" { type = string }
variable "provisioning_lambda_artifact_key" { type = string }
variable "expiry_lambda_artifact_key" { type = string }
variable "migration_lambda_artifact_key" { type = string }
variable "api_lambda_handler" {
  type    = string
  default = "dist/lambda/api.handler"
}
variable "provisioning_lambda_handler" {
  type    = string
  default = "dist/lambda/provisioning.handler"
}
variable "expiry_lambda_handler" {
  type    = string
  default = "dist/lambda/expiry.handler"
}
variable "migration_lambda_handler" {
  type    = string
  default = "dist/lambda/migration.handler"
}
variable "api_lambda_memory_size" {
  type    = number
  default = 1024
}
variable "api_lambda_timeout" {
  type    = number
  default = 15
}
variable "api_lambda_reserved_concurrency" {
  type    = number
  default = 50
}
variable "provisioning_lambda_memory_size" {
  type    = number
  default = 1536
}
variable "provisioning_lambda_timeout" {
  type    = number
  default = 180
}
variable "provisioning_reserved_concurrency" {
  type    = number
  default = 5
}
variable "expiry_lambda_memory_size" {
  type    = number
  default = 1024
}
variable "expiry_lambda_timeout" {
  type    = number
  default = 180
}
variable "migration_lambda_timeout" {
  type    = number
  default = 300
}
variable "expiry_reserved_concurrency" {
  type    = number
  default = 2
}
variable "enable_expiry_worker" {
  type    = bool
  default = false
}
variable "expiry_schedule_expression" {
  type    = string
  default = "rate(15 minutes)"
}
variable "log_retention_days" {
  type    = number
  default = 30
}
variable "assumable_role_arns" {
  type    = list(string)
  default = []
}
variable "enable_demo_iam_permissions" {
  type    = bool
  default = false
}
variable "additional_tags" {
  type    = map(string)
  default = {}
}
