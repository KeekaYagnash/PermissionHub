aws_region   = "af-south-1"
environment  = "dev"
project_name = "permissionhub"

vpc_cidr = "10.20.0.0/16"

availability_zones = [
  "af-south-1a",
  "af-south-1b"
]

public_subnet_cidrs = [
  "10.20.0.0/24",
  "10.20.1.0/24"
]

private_app_subnet_cidrs = [
  "10.20.10.0/24",
  "10.20.11.0/24"
]

private_db_subnet_cidrs = [
  "10.20.20.0/24",
  "10.20.21.0/24"
]

enable_nat_gateway               = true
enable_rds_proxy                 = false
postgres_engine_version          = "16.15"
enable_expiry_worker             = false
enable_demo_iam_permissions      = true
enable_cognito_domain            = true
cognito_domain_prefix            = "permissionhub-demo-dev"
interface_endpoint_services      = ["secretsmanager", "sts", "logs", "sqs"]
frontend_url                     = "http://localhost:5173"
allowed_origins                  = ["http://localhost:5173"]
allowed_methods                  = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
allowed_headers                  = ["authorization", "content-type", "x-csrf-token", "idempotency-key", "x-aws-account-record-id"]
callback_urls                    = ["http://localhost:5173/auth/callback"]
logout_urls                      = ["http://localhost:5173/login"]
lambda_runtime                   = "nodejs22.x"
lambda_artifact_bucket           = "permissionhub-dev-lambda-artifacts"
api_lambda_artifact_key          = "permissionhub-api-demo.zip"
provisioning_lambda_artifact_key = "permissionhub-provisioning-demo.zip"
expiry_lambda_artifact_key       = "permissionhub-expiry-demo.zip"
migration_lambda_artifact_key    = "permissionhub-db-migration-demo.zip"

api_lambda_handler          = "dist/lambda/api.handler"
provisioning_lambda_handler = "dist/lambda/provisioning.handler"
expiry_lambda_handler       = "dist/lambda/expiry.handler"
migration_lambda_handler    = "dist/lambda/migration.handler"

api_lambda_memory_size            = 512
api_lambda_timeout                = 15
api_lambda_reserved_concurrency   = 10
provisioning_lambda_memory_size   = 1024
provisioning_lambda_timeout       = 120
provisioning_reserved_concurrency = 2
expiry_lambda_memory_size         = 512
expiry_lambda_timeout             = 120
expiry_reserved_concurrency       = 1
migration_lambda_timeout          = 300
expiry_schedule_expression        = "rate(15 minutes)"
log_retention_days                = 14
assumable_role_arns               = []

additional_tags = {
  Environment = "dev"
  Project     = "PermissionHub"
  Purpose     = "Demo"
}
