mock_provider "aws" {}
mock_provider "random" {}

variables {
  aws_account_id                   = "123456789012"
  aws_region                       = "af-south-1"
  environment                      = "prod"
  vpc_cidr                         = "10.50.0.0/16"
  availability_zones               = ["af-south-1a", "af-south-1b"]
  public_subnet_cidrs              = ["10.50.0.0/24", "10.50.1.0/24"]
  private_app_subnet_cidrs         = ["10.50.10.0/24", "10.50.11.0/24"]
  private_db_subnet_cidrs          = ["10.50.20.0/24", "10.50.21.0/24"]
  frontend_url                     = "https://production.example.invalid"
  allowed_origins                  = []
  callback_urls                    = []
  logout_urls                      = []
  enable_cognito_domain            = true
  cognito_domain_prefix            = "permissionhub-prod-test"
  lambda_artifact_bucket           = "permissionhub-prod-lambda-artifacts"
  api_lambda_artifact_key          = "lambda/api/test.zip"
  provisioning_lambda_artifact_key = "lambda/provisioning/test.zip"
  expiry_lambda_artifact_key       = "lambda/expiry/test.zip"
  migration_lambda_artifact_key    = "lambda/migration/test.zip"
}

run "independent_fresh_production_plan" {
  command = plan
  assert {
    condition     = module.rds.identifier == "permissionhub-prod-postgres" && module.migration_lambda.function_name == "permissionhub-prod-db-migration"
    error_message = "Production must not use development database or migration resources."
  }
  assert {
    condition     = module.api_lambda.function_name == "permissionhub-prod-api" && module.rds_proxy[0].name == "permissionhub-prod-proxy"
    error_message = "Production must retain its independent API and existing proxy architecture."
  }
  assert {
    condition     = var.database_instance_class == "db.t3.medium" && var.database_deletion_protection && var.cognito_deletion_protection == "ACTIVE"
    error_message = "Production defaults must preserve cost baseline and deletion protection."
  }
}
