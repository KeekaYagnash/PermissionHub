output "endpoint" { value = aws_db_instance.this.endpoint }
output "address" { value = aws_db_instance.this.address }
output "identifier" { value = aws_db_instance.this.identifier }
output "secret_arn" { value = aws_secretsmanager_secret.database.arn }
