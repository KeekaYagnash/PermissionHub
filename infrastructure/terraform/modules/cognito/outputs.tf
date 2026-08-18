output "user_pool_id" { value = aws_cognito_user_pool.this.id }
output "user_pool_arn" { value = aws_cognito_user_pool.this.arn }
output "app_client_id" { value = aws_cognito_user_pool_client.spa.id }
output "issuer_url" { value = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}" }
output "domain" { value = var.enable_cognito_domain ? aws_cognito_user_pool_domain.this[0].domain : null }

data "aws_region" "current" {}
