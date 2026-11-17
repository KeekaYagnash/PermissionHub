mock_provider "aws" {}
mock_provider "random" {}
mock_provider "aws" { alias = "cloudfront_certificate" }
mock_provider "cloudflare" {}

override_resource {
  target = aws_acm_certificate.frontend
  values = {
    arn = "arn:aws:acm:us-east-1:143671530412:certificate/00000000-0000-0000-0000-000000000000"
    domain_validation_options = [{
      domain_name           = "dev.iamops.disraptor.co.za"
      resource_record_name  = "_validation.dev.iamops.disraptor.co.za."
      resource_record_type  = "CNAME"
      resource_record_value = "_validation.acm-validations.aws."
    }]
  }
}

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
    condition     = local.lambda_common_environment.SES_REGION == "us-east-1" && local.lambda_common_environment.SES_FROM_EMAIL == "no-reply@disraptor-internal.net" && local.lambda_common_environment.SES_IDENTITY_ARN == "arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net"
    error_message = "Dev Lambda sender, SES region and identity ARN must remain aligned with the exact shared boundary grant."
  }
  assert {
    condition     = var.environment == "dev" && var.aws_region == "af-south-1" && var.lambda_artifact_bucket == "permissionhub-dev-lambda-artifacts"
    error_message = "CI configuration must target the expected development environment."
  }
  assert {
    condition     = local.lambda_common_environment.FRONTEND_URL == "https://dev.iamops.disraptor.co.za"
    error_message = "Dev must use the canonical URL while retaining the CloudFront hostname."
  }
  assert {
    condition     = cloudflare_dns_record.frontend.proxied == false && cloudflare_dns_record.frontend.type == "CNAME" && aws_acm_certificate.frontend.domain_name == "dev.iamops.disraptor.co.za"
    error_message = "Only the dev hostname should use a DNS-only CNAME and a dedicated certificate."
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
