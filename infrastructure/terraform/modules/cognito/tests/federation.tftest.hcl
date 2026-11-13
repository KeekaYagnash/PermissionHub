mock_provider "aws" {
  mock_data "aws_secretsmanager_secret_version" {
    defaults = { secret_string = "{\"client_id\":\"test-client\",\"client_secret\":\"mock-not-a-real-secret\"}" }
  }
}
variables {
  name          = "permissionhub-test"
  environment   = "dev"
  callback_urls = ["https://test.example.invalid/auth/callback"]
  logout_urls   = ["https://test.example.invalid/login"]
}
run "email_signup_works_without_external_credentials" {
  command = plan
  assert {
    condition     = aws_cognito_user_pool_client.spa.supported_identity_providers == toset(["COGNITO"]) && length(aws_cognito_identity_provider.google) == 0 && length(aws_cognito_identity_provider.microsoft) == 0
    error_message = "Optional federation must not require credentials or display unconfigured providers."
  }
}
run "google_and_tenant_specific_entra" {
  command = plan
  variables {
    google_oauth_secret_arn = "arn:aws:secretsmanager:af-south-1:123456789012:secret:test-google"
    microsoft_oidc_providers = {
      EntraExample = { tenant_id = "12345678-1234-1234-1234-123456789012", client_id = "test-client", client_secret_arn = "arn:aws:secretsmanager:af-south-1:123456789012:secret:test-entra", label = "Microsoft Example" }
    }
  }
  assert {
    condition     = contains(aws_cognito_user_pool_client.spa.supported_identity_providers, "Google") && contains(aws_cognito_user_pool_client.spa.supported_identity_providers, "EntraExample") && !aws_cognito_user_pool_client.spa.generate_secret
    error_message = "SPA must use public Cognito client with explicitly configured federation."
  }
  assert {
    condition     = aws_cognito_identity_provider.microsoft["EntraExample"].provider_details["oidc_issuer"] == "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012/v2.0" && !contains(keys(aws_cognito_identity_provider.microsoft["EntraExample"].attribute_mapping), "email_verified")
    error_message = "Microsoft issuer must be tenant-specific and email must not be assumed verified."
  }
}
run "reject_common_issuer" {
  command = plan
  variables {
    microsoft_oidc_providers = { EntraInvalid = { tenant_id = "common", client_id = "test", client_secret_arn = "test", label = "Microsoft" } }
  }
  expect_failures = [var.microsoft_oidc_providers]
}
