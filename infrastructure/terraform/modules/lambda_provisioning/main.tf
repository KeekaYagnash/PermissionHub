resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_iam_role" "this" {
  name = "${var.name}-role"
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
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"]
        Resource = var.queue_arn
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
    }] : [])
  })
}

resource "aws_lambda_function" "this" {
  function_name                  = var.name
  runtime                        = var.runtime
  handler                        = var.handler
  s3_bucket                      = var.artifact_s3_bucket
  s3_key                         = var.artifact_s3_key
  role                           = aws_iam_role.this.arn
  memory_size                    = var.memory_size
  timeout                        = var.timeout
  reserved_concurrent_executions = var.reserved_concurrency

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment {
    variables = var.environment_variables
  }

  depends_on = [aws_cloudwatch_log_group.this]
  tags       = var.tags
}

resource "aws_lambda_event_source_mapping" "queue" {
  event_source_arn = var.queue_arn
  function_name    = aws_lambda_function.this.arn
  batch_size       = 1
  enabled          = true
}
