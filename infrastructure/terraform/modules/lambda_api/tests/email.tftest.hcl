mock_provider "aws" {}

variables {
  name                     = "permissionhub-dev-api"
  runtime                  = "nodejs22.x"
  handler                  = "dist/lambda/api.handler"
  artifact_s3_bucket       = "permissionhub-dev-lambda-artifacts"
  artifact_s3_key          = "test-only-api.zip"
  memory_size              = 512
  timeout                  = 15
  subnet_ids               = ["subnet-00000000000000001", "subnet-00000000000000002"]
  security_group_id        = "sg-00000000000000001"
  environment_variables    = { APP_AWS_REGION = "af-south-1", SES_REGION = "us-east-1", SES_FROM_EMAIL = "info@disraptor.co.za" }
  app_secret_arn           = "arn:aws:secretsmanager:af-south-1:143671530412:secret:test-app"
  database_secret_arn      = "arn:aws:secretsmanager:af-south-1:143671530412:secret:test-database"
  provisioning_queue_arn   = "arn:aws:sqs:af-south-1:143671530412:test-queue"
  log_retention_days       = 14
  permissions_boundary_arn = "arn:aws:iam::143671530412:policy/permissionhub-github-runtime-boundary-dev"
}

run "allow_existing_sender_on_api_execution_role" {
  command = plan
  variables {
    invitation_ses_identity_arn = "arn:aws:ses:us-east-1:143671530412:identity/info@disraptor.co.za"
  }
  assert {
    condition = length([for statement in jsondecode(aws_iam_role_policy.runtime.policy).Statement : statement
      if try(statement.Sid == "SendTransactionalEmail" && toset(statement.Action) == toset(["ses:SendEmail"]) && statement.Resource == "arn:aws:ses:us-east-1:143671530412:identity/info@disraptor.co.za" && statement.Condition.StringEquals["ses:FromAddress"] == "info@disraptor.co.za", false)
    ]) == 1
    error_message = "API runtime policy must allow only SendEmail against the configured SES identity and sender."
  }
  assert {
    condition     = aws_iam_role.this.permissions_boundary == var.permissions_boundary_arn && aws_iam_role_policy.runtime.name == "permissionhub-dev-api-runtime"
    error_message = "SES permission belongs to the API runtime role and must not remove its permissions boundary."
  }
}

run "disabled_email_has_no_ses_permission" {
  command = plan
  assert {
    condition     = length([for statement in jsondecode(aws_iam_role_policy.runtime.policy).Statement : statement if try(statement.Sid == "SendTransactionalEmail", false)]) == 0
    error_message = "Email must remain opt-in when no existing SES identity is configured."
  }
}

run "existing_domain_sender_is_scoped_to_configured_mailbox" {
  command = plan
  variables {
    invitation_ses_identity_arn = "arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net"
    environment_variables       = { APP_AWS_REGION = "af-south-1", SES_REGION = "us-east-1", SES_FROM_EMAIL = "notifications@disraptor-internal.net" }
  }
  assert {
    condition = length([for statement in jsondecode(aws_iam_role_policy.runtime.policy).Statement : statement
      if try(statement.Sid == "SendTransactionalEmail" && statement.Resource == "arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net" && statement.Condition.StringEquals["ses:FromAddress"] == "notifications@disraptor-internal.net", false)
    ]) == 1
    error_message = "Verified-domain sending must still be restricted to the configured mailbox."
  }
}
