mock_provider "aws" {
  mock_data "aws_iam_openid_connect_provider" {
    defaults = { client_id_list = ["sts.amazonaws.com"] }
  }
}

run "exact_trust_and_three_roles" {
  command = plan
  variables {
    create_oidc_provider   = true
    create_state_bucket    = true
    create_artifact_bucket = true
    create_lock_table      = true
  }
  assert {
    condition     = length(aws_iam_role.deploy) == 3 && aws_iam_role.deploy["terraform"].name == "permissionhub-github-terraform-dev" && aws_iam_role.deploy["backend"].name == "permissionhub-github-backend-dev" && aws_iam_role.deploy["frontend"].name == "permissionhub-github-frontend-dev"
    error_message = "Bootstrap must create exactly the three requested roles."
  }
  assert {
    condition     = local.trust_policy.Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:KeekaYagnash/PermissionHub:environment:development" && local.trust_policy.Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
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
    condition     = local.runtime_boundary.Statement[1].Effect == "Deny" && contains(local.runtime_boundary.Statement[1].Resource, "arn:aws:iam::143671530412:role/permissionhub-github-*")
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
    condition     = length(aws_iam_openid_connect_provider.github) == 0 && length(aws_s3_bucket.state) == 0 && length(aws_s3_bucket.artifacts) == 0 && length(aws_dynamodb_table.locks) == 0
    error_message = "Existing provider, buckets and lock table must not be recreated."
  }
}
