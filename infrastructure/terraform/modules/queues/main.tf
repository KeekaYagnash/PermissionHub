resource "aws_sqs_queue" "provisioning_dlq" {
  name                      = "${var.name}-provisioning-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = var.tags
}

resource "aws_sqs_queue" "provisioning" {
  name                       = "${var.name}-provisioning"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.provisioning_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })
  tags = var.tags
}
