output "queue_url" { value = aws_sqs_queue.provisioning.url }
output "queue_arn" { value = aws_sqs_queue.provisioning.arn }
output "dlq_url" { value = aws_sqs_queue.provisioning_dlq.url }
output "dlq_arn" { value = aws_sqs_queue.provisioning_dlq.arn }
output "dlq_name" { value = aws_sqs_queue.provisioning_dlq.name }
