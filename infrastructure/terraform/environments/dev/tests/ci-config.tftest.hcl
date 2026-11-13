mock_provider "aws" {}
mock_provider "random" {}

run "reviewed_dev_ci_configuration_plans_without_aws" {
  command = plan
  variables {
    api_lambda_artifact_key          = "lambda/api/test.zip"
    provisioning_lambda_artifact_key = "lambda/provisioning/test.zip"
    expiry_lambda_artifact_key       = "lambda/expiry/test.zip"
    migration_lambda_artifact_key    = "lambda/migration/test.zip"
  }
  assert {
    condition     = var.environment == "dev" && var.aws_region == "af-south-1" && var.lambda_artifact_bucket == "permissionhub-dev-lambda-artifacts"
    error_message = "CI configuration must target the expected development environment."
  }
  assert {
    condition     = var.runtime_permissions_boundary_arn == "arn:aws:iam::143671530412:policy/permissionhub-github-runtime-boundary-dev"
    error_message = "The dev deployment must use its independently managed runtime IAM boundary."
  }
  assert {
    condition     = module.api_lambda.function_name == "permissionhub-dev-api" && module.migration_lambda.function_name == "permissionhub-dev-db-migration"
    error_message = "CI configuration must plan the actual API and migration functions."
  }
}
