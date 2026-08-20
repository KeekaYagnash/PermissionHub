locals {
  name = "${var.project_name}-${var.environment}"
  tags = merge({
    Application = "PermissionHub"
    Project     = "PermissionHub"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }, var.additional_tags)

  lambda_common_environment = {
    NODE_ENV                               = "production"
    AWS_REGION                             = var.aws_region
    FRONTEND_URL                           = module.frontend_hosting.frontend_url
    AWS_CONNECTION_MODE                    = "manual"
    ENABLE_AWS_DEMO_DATA                   = "false"
    AUTH_ENABLED                           = "true"
    SESSION_STORE                          = "memory"
    CSRF_ENABLED                           = "false"
    AWS_PROVISIONING_MODE                  = "disabled"
    CROSS_ACCOUNT_PROVISIONING_ENABLED     = "false"
    ENABLE_LIVE_PROVISIONING               = "false"
    EXPIRY_REVOCATION_MODE                 = var.enable_expiry_worker ? "worker" : "disabled"
    DATABASE_HOST                          = module.rds_proxy.endpoint
    DATABASE_PORT                          = "5432"
    DATABASE_NAME                          = "permissionhub"
    DATABASE_SECRET_ARN                    = module.rds.secret_arn
    APP_SECRET_ARN                         = module.secrets.app_secret_arn
    PROVISIONING_QUEUE_URL                 = module.queues.queue_url
    COGNITO_USER_POOL_ID                   = module.cognito.user_pool_id
    COGNITO_APP_CLIENT_ID                  = module.cognito.app_client_id
    COGNITO_ISSUER_URL                     = module.cognito.issuer_url
    PERMISSIONHUB_RUNTIME_ADAPTATION_STATE = "demo-ready-lambda"
  }
}

module "networking" {
  source                   = "../../modules/networking"
  name                     = local.name
  vpc_cidr                 = var.vpc_cidr
  availability_zones       = var.availability_zones
  public_subnet_cidrs      = var.public_subnet_cidrs
  private_app_subnet_cidrs = var.private_app_subnet_cidrs
  private_db_subnet_cidrs  = var.private_db_subnet_cidrs
  enable_nat_gateway       = var.enable_nat_gateway
  single_nat_gateway       = true
  tags                     = local.tags
}

module "security" {
  source = "../../modules/security"
  name   = local.name
  vpc_id = module.networking.vpc_id
  tags   = local.tags
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = toset(var.interface_endpoint_services)
  vpc_id              = module.networking.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.networking.private_app_subnet_ids
  security_group_ids  = [module.security.vpc_endpoint_security_group_id]
  private_dns_enabled = true
  tags                = merge(local.tags, { Name = "${local.name}-${each.value}-endpoint" })
}

module "rds" {
  source                  = "../../modules/rds"
  name                    = local.name
  subnet_ids              = module.networking.private_db_subnet_ids
  security_group_id       = module.security.rds_security_group_id
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  multi_az                = false
  backup_retention_period = 3
  deletion_protection     = false
  skip_final_snapshot     = true
  tags                    = local.tags
}

module "rds_proxy" {
  source                  = "../../modules/rds_proxy"
  name                    = local.name
  vpc_subnet_ids          = module.networking.private_db_subnet_ids
  proxy_security_group_id = module.security.rds_proxy_security_group_id
  db_instance_identifier  = module.rds.identifier
  database_secret_arn     = module.rds.secret_arn
  tags                    = local.tags
}

module "secrets" {
  source = "../../modules/secrets"
  name   = local.name
  tags   = local.tags
}

module "cognito" {
  source                = "../../modules/cognito"
  name                  = local.name
  environment           = var.environment
  callback_urls         = distinct(concat(var.callback_urls, ["${module.frontend_hosting.frontend_url}/auth/callback"]))
  logout_urls           = distinct(concat(var.logout_urls, ["${module.frontend_hosting.frontend_url}/login"]))
  enable_cognito_domain = var.enable_cognito_domain
  cognito_domain_prefix = var.cognito_domain_prefix
  deletion_protection   = "INACTIVE"
  mfa_configuration     = "OPTIONAL"
  create_default_groups = true
  tags                  = local.tags
}

module "queues" {
  source                     = "../../modules/queues"
  name                       = local.name
  visibility_timeout_seconds = var.provisioning_lambda_timeout + 30
  tags                       = local.tags
}

module "api_lambda" {
  source                      = "../../modules/lambda_api"
  name                        = "${local.name}-api"
  runtime                     = var.lambda_runtime
  handler                     = var.api_lambda_handler
  artifact_s3_bucket          = var.lambda_artifact_bucket
  artifact_s3_key             = var.api_lambda_artifact_key
  memory_size                 = var.api_lambda_memory_size
  timeout                     = var.api_lambda_timeout
  reserved_concurrency        = var.api_lambda_reserved_concurrency
  subnet_ids                  = module.networking.private_app_subnet_ids
  security_group_id           = module.security.lambda_security_group_id
  environment_variables       = local.lambda_common_environment
  app_secret_arn              = module.secrets.app_secret_arn
  database_secret_arn         = module.rds.secret_arn
  provisioning_queue_arn      = module.queues.queue_arn
  assumable_role_arns         = var.assumable_role_arns
  enable_demo_iam_permissions = var.enable_demo_iam_permissions
  log_retention_days          = var.log_retention_days
  tags                        = local.tags
}

module "provisioning_lambda" {
  source                      = "../../modules/lambda_provisioning"
  name                        = "${local.name}-provisioning"
  runtime                     = var.lambda_runtime
  handler                     = var.provisioning_lambda_handler
  artifact_s3_bucket          = var.lambda_artifact_bucket
  artifact_s3_key             = var.provisioning_lambda_artifact_key
  memory_size                 = var.provisioning_lambda_memory_size
  timeout                     = var.provisioning_lambda_timeout
  reserved_concurrency        = var.provisioning_reserved_concurrency
  subnet_ids                  = module.networking.private_app_subnet_ids
  security_group_id           = module.security.lambda_security_group_id
  environment_variables       = local.lambda_common_environment
  app_secret_arn              = module.secrets.app_secret_arn
  database_secret_arn         = module.rds.secret_arn
  queue_arn                   = module.queues.queue_arn
  assumable_role_arns         = var.assumable_role_arns
  enable_demo_iam_permissions = var.enable_demo_iam_permissions
  log_retention_days          = var.log_retention_days
  tags                        = local.tags
}

module "expiry_lambda" {
  source                = "../../modules/lambda_expiry"
  name                  = "${local.name}-expiry"
  runtime               = var.lambda_runtime
  handler               = var.expiry_lambda_handler
  artifact_s3_bucket    = var.lambda_artifact_bucket
  artifact_s3_key       = var.expiry_lambda_artifact_key
  memory_size           = var.expiry_lambda_memory_size
  timeout               = var.expiry_lambda_timeout
  reserved_concurrency  = var.expiry_reserved_concurrency
  subnet_ids            = module.networking.private_app_subnet_ids
  security_group_id     = module.security.lambda_security_group_id
  environment_variables = local.lambda_common_environment
  app_secret_arn        = module.secrets.app_secret_arn
  database_secret_arn   = module.rds.secret_arn
  assumable_role_arns   = var.assumable_role_arns
  schedule_expression   = var.expiry_schedule_expression
  enable_schedule       = var.enable_expiry_worker
  log_retention_days    = var.log_retention_days
  tags                  = local.tags
}

module "migration_lambda" {
  source                = "../../modules/lambda_migration"
  name                  = "${local.name}-db-migration"
  runtime               = var.lambda_runtime
  handler               = var.migration_lambda_handler
  artifact_s3_bucket    = var.lambda_artifact_bucket
  artifact_s3_key       = var.migration_lambda_artifact_key
  memory_size           = 1024
  timeout               = var.migration_lambda_timeout
  subnet_ids            = module.networking.private_app_subnet_ids
  security_group_id     = module.security.lambda_security_group_id
  environment_variables = local.lambda_common_environment
  app_secret_arn        = module.secrets.app_secret_arn
  database_secret_arn   = module.rds.secret_arn
  log_retention_days    = var.log_retention_days
  tags                  = local.tags
}

module "api_gateway" {
  source                = "../../modules/api_gateway"
  name                  = local.name
  stage_name            = "$default"
  lambda_invoke_arn     = module.api_lambda.invoke_arn
  lambda_function_name  = module.api_lambda.function_name
  cognito_issuer_url    = module.cognito.issuer_url
  cognito_app_client_id = module.cognito.app_client_id
  allowed_origins       = distinct(concat(var.allowed_origins, [module.frontend_hosting.frontend_url]))
  allowed_methods       = var.allowed_methods
  allowed_headers       = var.allowed_headers
  log_retention_days    = var.log_retention_days
  tags                  = local.tags
}

module "frontend_hosting" {
  source = "../../modules/frontend_hosting"
  name   = local.name
  tags   = local.tags
}

module "monitoring" {
  source                   = "../../modules/monitoring"
  api_id                   = module.api_gateway.api_id
  api_stage                = module.api_gateway.stage_name
  api_lambda_name          = module.api_lambda.function_name
  provisioning_lambda_name = module.provisioning_lambda.function_name
  expiry_lambda_name       = module.expiry_lambda.function_name
  provisioning_dlq_name    = module.queues.dlq_name
  rds_identifier           = module.rds.identifier
  tags                     = local.tags
}
