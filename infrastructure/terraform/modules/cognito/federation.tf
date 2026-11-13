# Provider credentials are read only when federation is explicitly configured.
# Sensitive values live in encrypted/restricted Terraform state, never frontend outputs.
data "aws_secretsmanager_secret_version" "google" {
  count     = var.google_oauth_secret_arn == null ? 0 : 1
  secret_id = var.google_oauth_secret_arn
}
resource "aws_cognito_identity_provider" "google" {
  count         = var.google_oauth_secret_arn == null ? 0 : 1
  user_pool_id  = aws_cognito_user_pool.this.id
  provider_name = "Google"
  provider_type = "Google"
  provider_details = {
    client_id        = jsondecode(data.aws_secretsmanager_secret_version.google[0].secret_string).client_id
    client_secret    = jsondecode(data.aws_secretsmanager_secret_version.google[0].secret_string).client_secret
    authorize_scopes = "openid email profile"
  }
  attribute_mapping = { email = "email", name = "name", email_verified = "email_verified" }
}
data "aws_secretsmanager_secret_version" "microsoft" {
  for_each  = var.microsoft_oidc_providers
  secret_id = each.value.client_secret_arn
}
resource "aws_cognito_identity_provider" "microsoft" {
  for_each      = var.microsoft_oidc_providers
  user_pool_id  = aws_cognito_user_pool.this.id
  provider_name = each.key
  provider_type = "OIDC"
  provider_details = {
    client_id                 = each.value.client_id
    client_secret             = jsondecode(data.aws_secretsmanager_secret_version.microsoft[each.key].secret_string).client_secret
    oidc_issuer               = "https://login.microsoftonline.com/${each.value.tenant_id}/v2.0"
    authorize_scopes          = "openid email profile"
    attributes_request_method = "GET"
  }
  # Entra email/UPN is NOT proof of verified email. PermissionHub requires Cognito
  # email verification before first enrollment or invitation acceptance.
  attribute_mapping = { email = "email", name = "name" }
}
