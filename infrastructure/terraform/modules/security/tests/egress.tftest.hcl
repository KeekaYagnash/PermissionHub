mock_provider "aws" {}

variables {
  name             = "permissionhub-dev"
  vpc_id           = "vpc-00000000000000001"
  enable_rds_proxy = false
}

run "preserve_standalone_all_ipv4_lambda_egress" {
  command = plan
  assert {
    condition     = aws_security_group.lambda.name == "permissionhub-dev-lambda"
    error_message = "The Lambda security-group name/address must remain unchanged."
  }
  assert {
    condition     = aws_security_group_rule.lambda_egress_all.type == "egress" && aws_security_group_rule.lambda_egress_all.protocol == "-1" && aws_security_group_rule.lambda_egress_all.from_port == 0 && aws_security_group_rule.lambda_egress_all.to_port == 0 && toset(aws_security_group_rule.lambda_egress_all.cidr_blocks) == toset(["0.0.0.0/0"])
    error_message = "Keep the existing standalone all-outbound rule; do not replace it with HTTPS-only egress."
  }
}
