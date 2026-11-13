variable "api_id" { type = string }
variable "api_stage" { type = string }
variable "api_lambda_name" { type = string }
variable "provisioning_lambda_name" { type = string }
variable "expiry_lambda_name" { type = string }
variable "provisioning_dlq_name" { type = string }
variable "rds_identifier" { type = string }
variable "alarm_actions" {
  type    = list(string)
  default = []
}
variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.api_id}-${var.api_stage}-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_actions       = var.alarm_actions
  dimensions = {
    ApiId = var.api_id
    Stage = var.api_stage
  }
  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each            = toset([var.api_lambda_name, var.provisioning_lambda_name, var.expiry_lambda_name])
  alarm_name          = "${each.value}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_actions       = var.alarm_actions
  dimensions          = { FunctionName = each.value }
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each            = toset([var.api_lambda_name, var.provisioning_lambda_name, var.expiry_lambda_name])
  alarm_name          = "${each.value}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_actions       = var.alarm_actions
  dimensions          = { FunctionName = each.value }
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${var.provisioning_dlq_name}-visible-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_actions       = var.alarm_actions
  dimensions          = { QueueName = var.provisioning_dlq_name }
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.rds_identifier}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = var.alarm_actions
  dimensions          = { DBInstanceIdentifier = var.rds_identifier }
  tags                = var.tags
}
