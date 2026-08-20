output "lambda_security_group_id" { value = aws_security_group.lambda.id }
output "rds_security_group_id" { value = aws_security_group.rds.id }
output "rds_proxy_security_group_id" { value = try(aws_security_group.rds_proxy[0].id, null) }
output "vpc_endpoint_security_group_id" { value = aws_security_group.vpc_endpoints.id }
