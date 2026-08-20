variable "aws_region" { type = string }
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
