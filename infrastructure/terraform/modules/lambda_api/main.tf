resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_iam_role" "this" {
  permissions_boundary = var.permissions_boundary_arn
  name                 = "${var.name}-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "runtime" {
  name = "${var.name}-runtime"
  role = aws_iam_role.this.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue", "kms:Decrypt"]
        Resource = [var.app_secret_arn, var.database_secret_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = var.provisioning_queue_arn
      },
      {
        Effect   = "Allow"
        Action   = ["sts:GetCallerIdentity"]
        Resource = "*"
      }
      ], var.enable_demo_iam_permissions ? [{
        Effect = "Allow"
        Action = [
          "access-analyzer:ValidatePolicy",
          "iam:Get*",
          "iam:List*",
          "iam:SimulatePrincipalPolicy",
          "iam:SimulateCustomPolicy",
          "iam:CreatePolicy",
          "iam:AttachUserPolicy",
          "iam:AttachRolePolicy",
          "iam:DetachUserPolicy",
          "iam:DetachRolePolicy"
        ]
        Resource = "*"
        }] : [], length(var.assumable_role_arns) > 0 ? [{
        Effect   = "Allow"
        Action   = ["sts:AssumeRole", "sts:TagSession", "sts:SetSourceIdentity"]
        Resource = var.assumable_role_arns
        }] : [], var.invitation_ses_identity_arn == null ? [] : [{
        Sid      = "SendTransactionalEmail"
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = var.invitation_ses_identity_arn
        Condition = {
          StringEquals = {
            "ses:FromAddress" = lower(trimspace(lookup(var.environment_variables, "SES_FROM_EMAIL", "no-reply@disraptor.co.za")))
          }
        }
    }])
  })
  lifecycle {
    precondition {
      condition = var.invitation_ses_identity_arn == null ? true : try(
        can(regex("^arn:aws:ses:us-east-1:[0-9]{12}:identity/", var.invitation_ses_identity_arn)) &&
        contains([
          lower(trimspace(lookup(var.environment_variables, "SES_FROM_EMAIL", "no-reply@disraptor.co.za"))),
          split("@", lower(trimspace(lookup(var.environment_variables, "SES_FROM_EMAIL", "no-reply@disraptor.co.za"))))[1]
        ], split(":identity/", var.invitation_ses_identity_arn)[1]), false
      )
      error_message = "SES sender and existing us-east-1 identity must match. An info@ email identity cannot authorize no-reply@. Use the existing disraptor-internal.net domain, or confirm that disraptor.co.za is already verified before selecting its domain identity."
    }
  }
}

resource "aws_lambda_function" "this" {
  architectures    = ["x86_64"]
  function_name    = var.name
  runtime          = var.runtime
  handler          = var.handler
  s3_bucket        = var.artifact_s3_bucket
  s3_key           = var.artifact_s3_key
  source_code_hash = var.artifact_source_hash
  role             = aws_iam_role.this.arn
  memory_size      = var.memory_size
  timeout          = var.timeout

  reserved_concurrent_executions = var.reserved_concurrency

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment {
    variables = var.environment_variables
  }

  depends_on = [aws_cloudwatch_log_group.this, aws_iam_role_policy_attachment.basic, aws_iam_role_policy_attachment.vpc, aws_iam_role_policy.runtime]
  tags       = var.tags
}
