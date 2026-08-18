resource "random_password" "session_secret" {
  length  = 48
  special = false
}

resource "random_password" "credential_encryption_key" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/app"
  recovery_window_in_days = 30
  tags                    = var.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    session_secret                   = random_password.session_secret.result
    credential_encryption_key        = random_password.credential_encryption_key.result
    provisioning_confirmation        = ""
    aws_live_test_allowed_principals = ""
  })
}
