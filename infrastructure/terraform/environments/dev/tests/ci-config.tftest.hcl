mock_provider "aws" {}
mock_provider "random" {}

run "foundation_plan_does_not_need_lambda_packages" {
  command = plan
  plan_options {
    target = [module.networking, module.security, module.rds, module.rds_proxy, module.secrets, module.cognito, module.queues, module.frontend_hosting, aws_vpc_endpoint.interface]
  }
  assert {
    condition     = module.rds.identifier == "permissionhub-dev-postgres"
    error_message = "The first infrastructure stage must include the actual dev database."
  }
}

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
