resource "aws_security_group" "lambda" {
  name        = "${var.name}-lambda"
  description = "PermissionHub Lambda functions"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-lambda" })
}

resource "aws_security_group_rule" "lambda_egress_all" {
  type              = "egress"
  security_group_id = aws_security_group.lambda.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Outbound to RDS Proxy and AWS service endpoints/NAT where configured"
}

resource "aws_security_group" "rds_proxy" {
  count       = var.enable_rds_proxy ? 1 : 0
  name        = "${var.name}-rds-proxy"
  description = "PermissionHub RDS Proxy"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-rds-proxy" })
}

resource "aws_security_group_rule" "rds_proxy_ingress_lambda" {
  count                    = var.enable_rds_proxy ? 1 : 0
  type                     = "ingress"
  security_group_id        = aws_security_group.rds_proxy[0].id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  description              = "PostgreSQL from Lambda only"
}

resource "aws_security_group_rule" "rds_proxy_egress_rds" {
  count                    = var.enable_rds_proxy ? 1 : 0
  type                     = "egress"
  security_group_id        = aws_security_group.rds_proxy[0].id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
  description              = "PostgreSQL to RDS"
}

resource "aws_security_group" "rds" {
  name        = "${var.name}-rds"
  description = "PermissionHub PostgreSQL"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-rds" })
}

resource "aws_security_group_rule" "rds_ingress_proxy" {
  count                    = var.enable_rds_proxy ? 1 : 0
  type                     = "ingress"
  security_group_id        = aws_security_group.rds.id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds_proxy[0].id
  description              = "PostgreSQL from RDS Proxy only"
}

resource "aws_security_group_rule" "rds_ingress_lambda" {
  count                    = var.enable_rds_proxy ? 0 : 1
  type                     = "ingress"
  security_group_id        = aws_security_group.rds.id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  description              = "PostgreSQL from Lambda only"
}

resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.name}-vpc-endpoints"
  description = "PermissionHub interface VPC endpoints"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-vpc-endpoints" })
}

resource "aws_security_group_rule" "endpoint_ingress_lambda" {
  type                     = "ingress"
  security_group_id        = aws_security_group.vpc_endpoints.id
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  description              = "HTTPS from Lambda functions"
}
