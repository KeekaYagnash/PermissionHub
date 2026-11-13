output "user_pool_id" { value = aws_cognito_user_pool.this.id }
output "user_pool_arn" { value = aws_cognito_user_pool.this.arn }
output "app_client_id" { value = aws_cognito_user_pool_client.spa.id }
output "issuer_url" { value = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}" }
output "domain" { value = var.enable_cognito_domain ? aws_cognito_user_pool_domain.this[0].domain : null }
output "providers" {
  value = concat(var.google_oauth_secret_arn == null ? [] : [{ name = "Google", label = "Google" }], [for name, provider in var.microsoft_oidc_providers : { name = name, label = provider.label }])
}
output "federation_redirect_uri" {
  value = var.enable_cognito_domain ? "https://${var.cognito_domain_prefix}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/idpresponse" : null
}

data "aws_region" "current" {}
