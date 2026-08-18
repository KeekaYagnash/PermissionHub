locals {
  groups = toset(["ORGANISATION_ADMIN", "SECURITY_REVIEWER", "REQUESTER", "FINANCE_MANAGER"])
}

resource "aws_cognito_user_pool" "this" {
  name                = var.name
  username_attributes = ["email"]
  deletion_protection = var.deletion_protection
  mfa_configuration   = var.mfa_configuration

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 14
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  software_token_mfa_configuration {
    enabled = true
  }

  tags = var.tags
}

resource "aws_cognito_user_pool_client" "spa" {
  name                                 = "${var.name}-spa"
  user_pool_id                         = aws_cognito_user_pool.this.id
  generate_secret                      = false
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  prevent_user_existence_errors        = "ENABLED"
  access_token_validity                = 60
  id_token_validity                    = 60
  refresh_token_validity               = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "this" {
  count        = var.enable_cognito_domain ? 1 : 0
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}

resource "aws_cognito_user_group" "default" {
  for_each     = var.create_default_groups ? local.groups : toset([])
  name         = each.value
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Future PermissionHub ${each.value} identity group. Account-scoped authorization remains in the application database."
}
