terraform {
  required_version = ">= 1.9.0, < 2.0.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.80" }
  }
  # Intentionally independent local state. Never place this root in application state.
}
provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.aws_account_id]
  default_tags { tags = { Application = "PermissionHub-CI", Environment = "dev", ManagedBy = "TerraformBootstrap" } }
}
variable "aws_account_id" { default = "143671530412" }
variable "aws_region" { default = "af-south-1" }
variable "github_repository" { default = "KeekaYagnash/PermissionHub" }
variable "github_environment" {
  default = "development"
  validation {
    condition     = var.github_environment == "development"
    error_message = "The existing workflows use the development environment for dev."
  }
}
variable "state_bucket" { default = "permissionhub-dev-bucket" }
variable "state_key" { default = "permissionhub/dev/terraform.tfstate" }
variable "lock_table" { default = "permissionhub-state-lock" }
variable "artifact_bucket" { default = "permissionhub-dev-lambda-artifacts" }
variable "create_oidc_provider" {
  type        = bool
  default     = false
  description = "Keep false to reference the existing account GitHub OIDC provider without importing, replacing, or modifying it."
}
variable "create_state_bucket" { default = false }
variable "create_artifact_bucket" { default = false }
variable "create_lock_table" { default = false }

locals {
  provider_arn = "arn:aws:iam::${var.aws_account_id}:oidc-provider/token.actions.githubusercontent.com"
  boundary_arn = "arn:aws:iam::${var.aws_account_id}:policy/permissionhub-github-runtime-boundary-dev"
  template_variables = {
    account_id      = var.aws_account_id, region = var.aws_region,
    state_bucket    = var.state_bucket, state_key = var.state_key, lock_table = var.lock_table,
    artifact_bucket = var.artifact_bucket, boundary_arn = local.boundary_arn
  }
  trust_policy = {
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow", Action = "sts:AssumeRoleWithWebIdentity",
      Principal = { Federated = local.provider_arn },
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud"         = "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub"         = "repo:${var.github_repository}:environment:${var.github_environment}",
        "token.actions.githubusercontent.com:ref"         = "refs/heads/dev",
        "token.actions.githubusercontent.com:environment" = var.github_environment
      } }
    }]
  }
  terraform_policies = { for name in ["state", "network", "identity", "platform", "discovery"] :
    name => jsondecode(templatefile("${path.module}/policies/terraform-${name}.json.tftpl", local.template_variables))
  }
  role_policies = merge(
    { for name, value in local.terraform_policies : "terraform-${name}" => value },
    { backend = jsondecode(templatefile("${path.module}/policies/backend.json.tftpl", local.template_variables)),
    frontend = jsondecode(templatefile("${path.module}/policies/frontend.json.tftpl", local.template_variables)) }
  )
  runtime_boundary = jsondecode(templatefile("${path.module}/policies/runtime-boundary.json.tftpl", local.template_variables))
}
resource "aws_iam_openid_connect_provider" "github" {
  count          = var.create_oidc_provider ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  lifecycle { prevent_destroy = true }
}
data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  arn   = local.provider_arn
  lifecycle {
    postcondition {
      condition     = contains(self.client_id_list, "sts.amazonaws.com")
      error_message = "Existing GitHub provider must already support audience sts.amazonaws.com. Do not replace it."
    }
  }
}
resource "aws_iam_role" "deploy" {
  for_each             = toset(["terraform", "backend", "frontend"])
  name                 = "permissionhub-github-${each.key}-dev"
  assume_role_policy   = jsonencode(local.trust_policy)
  max_session_duration = 3600
  lifecycle { prevent_destroy = true }
  depends_on = [aws_iam_openid_connect_provider.github, data.aws_iam_openid_connect_provider.github]
}
resource "aws_iam_policy" "deploy" {
  for_each = local.role_policies
  name     = "permissionhub-github-${each.key}-dev"
  policy   = jsonencode(each.value)
  lifecycle { prevent_destroy = true }
}
resource "aws_iam_role_policy_attachment" "deploy" {
  for_each   = local.role_policies
  role       = aws_iam_role.deploy[startswith(each.key, "terraform-") ? "terraform" : each.key].name
  policy_arn = aws_iam_policy.deploy[each.key].arn
}
resource "aws_iam_policy" "runtime_boundary" {
  name   = "permissionhub-github-runtime-boundary-dev"
  policy = jsonencode(local.runtime_boundary)
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket" "state" {
  count  = var.create_state_bucket ? 1 : 0
  bucket = var.state_bucket
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket" "artifacts" {
  count  = var.create_artifact_bucket ? 1 : 0
  bucket = var.artifact_bucket
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket_versioning" "prerequisites" {
  for_each = toset([var.state_bucket, var.artifact_bucket])
  bucket   = each.value
  versioning_configuration { status = "Enabled" }
  depends_on = [aws_s3_bucket.state, aws_s3_bucket.artifacts]
}
resource "aws_s3_bucket_server_side_encryption_configuration" "prerequisites" {
  for_each = toset([var.state_bucket, var.artifact_bucket])
  bucket   = each.value
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
  depends_on = [aws_s3_bucket.state, aws_s3_bucket.artifacts]
}
resource "aws_s3_bucket_public_access_block" "prerequisites" {
  for_each                = toset([var.state_bucket, var.artifact_bucket])
  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
  depends_on              = [aws_s3_bucket.state, aws_s3_bucket.artifacts]
}
resource "aws_dynamodb_table" "locks" {
  count        = var.create_lock_table ? 1 : 0
  name         = var.lock_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
  lifecycle { prevent_destroy = true }
}
output "github_oidc_provider_arn" { value = local.provider_arn }
# output "runtime_permissions_boundary_arn" { value = local.boundary_arn }
# output "trust_policy" { value = local.trust_policy }
# output "permission_policies" { value = local.role_policies }
# output "runtime_boundary" { value = local.runtime_boundary }
output "role_arns" { value = { for name, role in aws_iam_role.deploy : name => role.arn } }
