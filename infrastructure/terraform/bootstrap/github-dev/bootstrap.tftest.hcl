mock_provider "aws" {
  mock_data "aws_iam_openid_connect_provider" {
    defaults = { client_id_list = ["sts.amazonaws.com"] }
  }
}

run "exact_trust_and_three_roles" {
  command = plan
  assert {
    condition = jsonencode([for statement in local.runtime_boundary.Statement : statement if statement.Sid == "TransactionalEmailFromExistingIdentities"]) == jsonencode([{
      Sid       = "TransactionalEmailFromExistingIdentities"
      Effect    = "Allow"
      Action    = "ses:SendEmail"
      Resource  = "arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net"
      Condition = { StringEquals = { "ses:FromAddress" = "no-reply@disraptor-internal.net" } }
    }])
    error_message = "The four-role boundary must permit exactly SendEmail on the internal domain, with an exact no-reply From address and no wildcard/alternative identities."
  }
  assert {
    condition     = length([for statement in local.runtime_boundary.Statement : statement if anytrue([for action in flatten([statement.Action]) : startswith(action, "ses:")])]) == 1
    error_message = "SES must not also be allowed by another broader boundary statement."
  }
  variables {
    create_oidc_provider   = true
    create_state_bucket    = true
    create_artifact_bucket = true
    create_lock_table      = true
  }
  assert {
    condition     = toset(local.role_policies["terraform-logging"].Statement[0].Action) == toset(["logs:CreateLogDelivery", "logs:GetLogDelivery", "logs:UpdateLogDelivery", "logs:DeleteLogDelivery", "logs:ListLogDeliveries", "logs:DescribeResourcePolicies", "logs:PutResourcePolicy"]) && local.role_policies["terraform-logging"].Statement[0].Resource == "*" && local.role_policies["terraform-logging"].Statement[0].Condition.StringEquals["aws:RequestedRegion"] == "af-south-1" && aws_iam_role_policy_attachment.deploy["terraform-logging"].role == "permissionhub-github-terraform-dev"
    error_message = "HTTP API logging requires the complete regional log-delivery permission set attached to the Terraform role."
  }
  assert {
    condition = length([
      for statement in local.role_policies["terraform-platform"].Statement : statement
      if try(statement.Sid == "HttpApiConfiguration" && contains(statement.Action, "apigateway:POST") && contains(statement.Action, "apigateway:TagResource") && contains(statement.Action, "apigateway:UntagResource") && statement.Resource == "arn:aws:apigateway:af-south-1::*", false)
    ]) == 1
    error_message = "Tagged API Gateway stage creation and subsequent tag updates require explicit TagResource/UntagResource permissions alongside the HTTP management actions."
  }
  assert {
    condition = alltrue([for name in ["terraform-platform", "terraform-discovery", "backend"] : length([
      for statement in local.role_policies[name].Statement : statement
      if try(contains(statement.Resource, "arn:aws:logs:af-south-1:143671530412:log-group:/aws/apigateway/permissionhub-dev") && contains(statement.Resource, "arn:aws:logs:af-south-1:143671530412:log-group:/aws/apigateway/permissionhub-dev:*"), false)
    ]) >= 1])
    error_message = "API Gateway uses the exact /aws/apigateway/permissionhub-dev name, without a hyphen suffix; read/write permissions must cover both ARN forms."
  }
  assert {
    condition = alltrue([for name in ["terraform-discovery", "backend"] : length([
      for statement in local.role_policies[name].Statement : statement
      if try(statement.Sid == "LogRead" && contains(statement.Action, "logs:ListTagsForResource") && contains(statement.Action, "logs:ListTagsLogGroup") && contains(statement.Resource, "arn:aws:logs:af-south-1:143671530412:log-group:/aws/lambda/permissionhub-dev-*") && contains(statement.Resource, "arn:aws:logs:af-south-1:143671530412:log-group:/aws/apigateway/permissionhub-dev"), false)
    ]) == 1])
    error_message = "Terraform/backend log tag reads must support the modern API and bare log-group ARNs for Lambda and API Gateway."
  }
  assert {
    condition = alltrue([for name in ["terraform-discovery", "backend"] : length([
      for statement in local.role_policies[name].Statement : statement
      if try(statement.Sid == "CognitoDomainRead" && statement.Resource == "*" && contains(statement.Action, "cognito-idp:DescribeUserPoolDomain") && statement.Condition.StringEquals["aws:RequestedRegion"] == "af-south-1", false)
    ]) == 1])
    error_message = "Cognito domain polling requires a dedicated Resource:* read allow restricted to the deployment region for Terraform and backend roles."
  }
  assert {
    condition     = length(aws_iam_role_policy.storage_full_access) == 3 && alltrue([for policy in values(aws_iam_role_policy.storage_full_access) : toset(jsondecode(policy.policy).Statement[0].Action) == toset(["s3:*", "dynamodb:*"]) && jsondecode(policy.policy).Statement[0].Resource == "*"])
    error_message = "All three dev GitHub roles must receive the explicitly requested S3/DynamoDB full-access policy, without broader service actions."
  }
  assert {
    condition     = contains(local.role_policies["frontend"].Statement[2].Action, "cloudfront:GetDistribution") && contains(local.role_policies["frontend"].Statement[2].Action, "cloudfront:GetInvalidation")
    error_message = "Frontend deployment must inspect its CloudFront distribution and wait for invalidation."
  }
  assert {
    condition     = contains(local.role_policies["terraform-state"].Statement[1].Resource, "arn:aws:s3:::permissionhub-dev-bucket/permisionhub/dev/backend") && contains(local.role_policies["backend"].Statement[1].Resource, "arn:aws:s3:::permissionhub-dev-bucket/permisionhub/dev/backend")
    error_message = "Deployment role state permissions must follow the exact dev backend key."
  }
  assert {
    condition     = local.trust_policy.Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:ref"] == "refs/heads/dev"
    error_message = "Dev deployment roles must trust the dev deployment branch, not main or a PR ref."
  }
  assert {
    condition     = length(aws_iam_role.deploy) == 3 && aws_iam_role.deploy["terraform"].name == "permissionhub-github-terraform-dev" && aws_iam_role.deploy["backend"].name == "permissionhub-github-backend-dev" && aws_iam_role.deploy["frontend"].name == "permissionhub-github-frontend-dev"
    error_message = "Bootstrap must create exactly the three requested roles."
  }
  assert {
    condition     = local.trust_policy.Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:KeekaYagnash@134513323/PermissionHub@1321706781:environment:development" && local.trust_policy.Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
    error_message = "Trust must be exact repository/environment and audience, never a wildcard."
  }
  assert {
    condition     = alltrue([for policy in values(local.role_policies) : length(jsonencode(policy)) <= 6144])
    error_message = "Each managed IAM permission policy must fit the 6144-character limit."
  }
  assert {
    condition     = alltrue([for policy in values(local.role_policies) : alltrue([for statement in policy.Statement : !contains(try(tolist(statement.Action), [statement.Action]), "*")])])
    error_message = "Do not grant unrestricted AdministratorAccess-equivalent actions."
  }
  assert {
    condition     = length([for statement in local.runtime_boundary.Statement : statement if try(statement.Sid == "ProtectCiIdentities" && statement.Effect == "Deny" && contains(statement.Resource, "arn:aws:iam::143671530412:role/permissionhub-github-*"), false)]) == 1
    error_message = "Runtime roles must not modify CI roles."
  }
}

run "reuse_existing_prerequisites" {
  command = plan
  variables {
    create_oidc_provider   = false
    create_state_bucket    = false
    create_artifact_bucket = false
    create_lock_table      = false
  }
  assert {
    condition     = length(data.aws_iam_openid_connect_provider.github) == 1 && alltrue([for role in values(aws_iam_role.deploy) : jsondecode(role.assume_role_policy).Statement[0].Principal.Federated == "arn:aws:iam::143671530412:oidc-provider/token.actions.githubusercontent.com"])
    error_message = "All three deployment roles must trust the existing account GitHub provider, read through a data source rather than managed or replaced."
  }
  assert {
    condition     = alltrue([for role in values(aws_iam_role.deploy) : jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:KeekaYagnash@134513323/PermissionHub@1321706781:environment:development"])
    error_message = "Every deployment role must use the immutable repository subject, not a legacy, wildcard, or pull-request subject."
  }
  assert {
    condition     = length(aws_iam_openid_connect_provider.github) == 0 && length(aws_s3_bucket.state) == 0 && length(aws_s3_bucket.artifacts) == 0 && length(aws_dynamodb_table.locks) == 0
    error_message = "Existing provider, buckets and lock table must not be recreated."
  }
}
