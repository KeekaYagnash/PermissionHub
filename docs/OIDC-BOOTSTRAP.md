# Dev GitHub OIDC bootstrap — authoritative setup

**Historical bootstrap guide:** the infrastructure in this root is intentionally
unchanged by the dev/prod CI/CD update. Its current trust still requires main.
The operator must separately change dev trust to refs/heads/dev, retaining the
development environment and exact repository restriction, and supply production
and read-only planning roles. Do not use the old main-only dev workflow commands
below. See [DEPLOYMENT-OPERATIONS.md](DEPLOYMENT-OPERATIONS.md) for current commands.

Account **143671530412**, region **af-south-1**, repository **KeekaYagnash/PermissionHub**. Logical dev maps to the EXISTING GitHub Environment **development**, not a new environment named dev. Deployment jobs and all three trust policies now agree on that name. Only **main** can assume these roles; branch work/PR validation stays credential-free. Leave ENABLE_PR_TERRAFORM_PLAN=false with this three-role setup (there is no additional untrusted-PR read role).

## Separate ownership and repeatability

`infrastructure/terraform/bootstrap/github-dev` owns CI roles, managed deployment policies, runtime boundary, and (only if absent) prerequisite buckets/lock table/OIDC provider. Application Terraform remains under `environments/dev` and cannot delete bootstrap resources or read/write bootstrap state using the CI roles. Bootstrap intentionally uses a **separate local state**; keep an encrypted, access-controlled backup of that directory's terraform.tfstate and backup. Never copy it into the application remote-state key, commit it, delete it, or run bootstrap destroy. All bootstrap-owned durable resources use prevent_destroy. Provider audience/trust is not modified when an existing provider is reused.

`prepare-oidc-bootstrap.ps1` is discovery-only: validates the AWS account, checks bucket ownership/provider audience/lock schema, retains existing bootstrap ownership on repeat runs, and generates ignored creation flags plus declarative imports for any existing exact-named roles/policies. AccessDenied/network errors are never treated as absence. Terraform plan shows any trust/policy/security-setting updates before operator approval. Existing bucket encryption, public-access blocking and versioning are configured by this separate root; inspect changes before applying, especially if a shared bucket has non-default encryption requirements.

## Roles and workflow variables

| Role | Existing variables pointing to its ARN |
|---|---|
| permissionhub-github-terraform-dev | AWS_INFRA_ROLE_ARN, AWS_PLAN_ROLE_ARN |
| permissionhub-github-backend-dev | AWS_BACKEND_ROLE_ARN, AWS_ARTIFACT_ROLE_ARN |
| permissionhub-github-frontend-dev | AWS_FRONTEND_ROLE_ARN |

ARN prefix: `arn:aws:iam::143671530412:role/`. Exactly three deployment roles are created, not five. Because plan/apply share the Terraform role, its main-only trust and development environment restrictions are essential. Never grant it to pull-request code. These are privileged trusted-code deployment identities, not IAM identities managed by access requests.

Every role trusts only the existing GitHub provider and requires ALL of:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Federated": "arn:aws:iam::143671530412:oidc-provider/token.actions.githubusercontent.com"},
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {"StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:KeekaYagnash/PermissionHub:environment:development",
      "token.actions.githubusercontent.com:ref": "refs/heads/main",
      "token.actions.githubusercontent.com:environment": "development"
    }}
  }]
}
```

Current AWS IAM supports GitHub ref/environment condition keys. The workflow also rejects non-main refs. GitHub environment branch protection is additional defense, not a substitute for IAM trust.

## Exact permission documents

Source of truth: `infrastructure/terraform/bootstrap/github-dev/policies/*.json.tftpl`. `write-oidc-policies.ps1` renders those SAME Terraform policies (no duplicated policy generator and no dependency on nonexistent application outputs) into `artifacts/oidc/dev`:

* Terraform: terraform-state-policy.json, terraform-network-policy.json, terraform-identity-policy.json, terraform-platform-policy.json, terraform-discovery-policy.json.
* Backend: backend-policy.json.
* Frontend: frontend-policy.json.
* Boundary: runtime-boundary-policy.json.
* Three exact-named role trust JSONs.

Terraform policies cover only the services used by this dev infrastructure. Project-named resources are ARN-scoped. Networking and HTTP API operations use regional/account scopes where generated IDs prevent name-prefix scoping; certain discovery/create operations require wildcard resources. CloudFront/Cognito writes use application/environment tag restrictions where supported. No AdministratorAccess or blanket Allow Action:* policy is attached. RDS Proxy is not enabled in the current dev config; enabling additional architecture/features requires a reviewed permissions update.

Terraform IAM delegation is limited to `permissionhub-dev-*-role`, requires the bootstrap-managed permissions boundary on creation, only attaches the two Lambda service policies, and only passes those runtime roles to lambda.amazonaws.com. CI roles/policies/provider are outside the delegated namespace. The boundary explicitly denies runtime IAM mutation of CI identities and runtime-role permission changes. It grants no permissions by itself. CI_TF_VARS_JSON must include runtime_permissions_boundary_arn; the exporter adds it from bootstrap state. Do not remove it to bypass a denied CreateRole.

Backend can read application state, use only its dev lock keys, upload content-addressed Lambda artifacts using literal If-None-Match: *, and update project Lambda code. Only the migration Lambda allows configuration update/invocation. It cannot create infrastructure, change CI IAM, or delete state/artifact buckets. Provider-refresh reads include sensitive application state/Secrets Manager; backend and Terraform roles must only be available to trusted main code. A principal that can deploy application code necessarily has access to its runtime secrets; this is not an isolation boundary against malicious trusted deployments.

Frontend can list/upload only permissionhub-dev-frontend-* objects and invalidate distributions in this account tagged Application=PermissionHub and Environment=dev. It has no Terraform-state, IAM, Lambda, Secrets Manager or backend-artifact access. Prefix/tag scoping supports newly generated frontend names without stale deployment outputs.

## GitHub Environment configuration

Create/reuse **development**, Settings > Environments. Configure deployment branches/tags to **Selected branches and tags**, allow **main (branch) only**, no wildcard, no tags. Main itself should require PR approval and the validation checks. Dev reviewers are optional if automatic post-merge deployment is desired; production protections are unchanged. Do not create development-plan for these dev roles. Existing production/prod-plan roles, if used, are separate and are not provisioned by this dev bootstrap.

Set these existing variables on development:

* AWS_REGION=af-south-1
* TF_STATE_BUCKET=permissionhub-dev-bucket
* TF_STATE_KEY=permissionhub/dev/terraform.tfstate
* TF_LOCK_TABLE=permissionhub-state-lock
* LAMBDA_ARTIFACT_BUCKET=permissionhub-dev-lambda-artifacts
* Five AWS_*_ROLE_ARN variables from the three-role table.
* CI_TF_VARS_JSON from the fresh-aware exporter below.
* CI_MIGRATIONS_READY=true ONLY after reviewing the restored initial migration and successful empty-PostgreSQL test. Do not set true to bypass a failed migration.
* Existing frontend public variables API_GATEWAY_ENDPOINT, FRONTEND_URL, FRONTEND_BUCKET, CLOUDFRONT_DISTRIBUTION_ID, COGNITO_DOMAIN, COGNITO_CLIENT_ID remain supported for standalone reuse. Orchestrated releases automatically pass current public outputs (including frontend-only releases); do not reuse old destroyed values.

Secret: TF_PLAN_ENCRYPTION_KEY, 32 random bytes/base64, on development. No AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/session-token secret is used. Remove obsolete deployment key secrets after OIDC verification; do not revoke any key also used by an onboarded application connection without checking ownership.

## One-time commands — operator execution ONLY

None of the following apply/configure commands were run by this task. Review IAM policies and the saved bootstrap plan before approving changes. The existing operator identity needs administrative authority to create the scoped deployment policies/roles and configure prerequisite buckets; the restricted CI Terraform role does NOT bootstrap its own permissions.

```powershell
cd C:\Users\yagi1\OneDrive\Desktop\PermissionHub
git branch --show-current
aws sts get-caller-identity --region af-south-1

terraform -chdir=infrastructure/terraform/bootstrap/github-dev init
.\infrastructure\scripts\prepare-oidc-bootstrap.ps1
.\infrastructure\scripts\write-oidc-policies.ps1
.\infrastructure\scripts\validate-oidc-policies.ps1
terraform -chdir=infrastructure/terraform/bootstrap/github-dev test
terraform -chdir=infrastructure/terraform/bootstrap/github-dev plan '-out=tfplan.oidc-bootstrap'
terraform -chdir=infrastructure/terraform/bootstrap/github-dev show 'tfplan.oidc-bootstrap'

# APPROVAL REQUIRED: applies only the separate CI bootstrap, not PermissionHub application infrastructure.
terraform -chdir=infrastructure/terraform/bootstrap/github-dev apply 'tfplan.oidc-bootstrap'
terraform -chdir=infrastructure/terraform/bootstrap/github-dev output -json role_arns
```

Back up the resulting independent bootstrap state securely. Repeat discovery/plan for updates; do not lose the state and create duplicate access infrastructure. Declarative imports generated by discovery safely adopt existing exact-named roles/policies after review. If either bucket name is owned by a different account, discovery stops; choose a reviewed account-owned name consistently in the bootstrap/application/GitHub settings rather than treating 403 as absence.

After bootstrap approval/apply and creating/restricting the GitHub development environment:

```powershell
cd C:\Users\yagi1\OneDrive\Desktop\PermissionHub
gh auth status
$repo='KeekaYagnash/PermissionHub'
$values=@{
 AWS_REGION='af-south-1'; TF_STATE_BUCKET='permissionhub-dev-bucket'; TF_STATE_KEY='permissionhub/dev/terraform.tfstate'
 TF_LOCK_TABLE='permissionhub-state-lock'; LAMBDA_ARTIFACT_BUCKET='permissionhub-dev-lambda-artifacts'
 AWS_INFRA_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-terraform-dev'
 AWS_PLAN_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-terraform-dev'
 AWS_BACKEND_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-backend-dev'
 AWS_ARTIFACT_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-backend-dev'
 AWS_FRONTEND_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-frontend-dev'
}
foreach($item in $values.GetEnumerator()){gh variable set $item.Key --body $item.Value --env development --repo $repo}
gh variable set ENABLE_PR_TERRAFORM_PLAN --body false --repo $repo
$key=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$key | gh secret set TF_PLAN_ENCRYPTION_KEY --env development --repo $repo
Remove-Variable key

terraform -chdir=infrastructure/terraform/environments/dev init -reconfigure
$config=.\infrastructure\scripts\export-ci-config.ps1 -Environment dev -Fresh
$config | gh variable set CI_TF_VARS_JSON --env development --repo $repo
```

Fresh deployment requires explicit `fresh_deployment=true` in the manual infrastructure workflow, main ref, dev environment, four real built/uploaded packages and empty application state. Routine pushes never silently bootstrap. Fresh infrastructure must exist before private-RDS migrations can be checked. A failed migration blocks frontend release; it does not roll back newly created infrastructure. Review a plan-only run first. Do not set apply=true until the blockers below are resolved/accepted.

After these workflow changes are reviewed/merged to main, verify authentication only:

```powershell
gh workflow run verify-aws-oidc.yml --ref main --repo KeekaYagnash/PermissionHub
gh run list --workflow verify-aws-oidc.yml --repo KeekaYagnash/PermissionHub --limit 3
```

That workflow assumes each of the three roles and calls GetCallerIdentity only. It does not deploy, invoke provisioning, upload objects or change IAM. Local access-key authentication succeeding is NOT proof GitHub OIDC works.

Additional read-only verification:

```powershell
aws iam get-open-id-connect-provider --open-id-connect-provider-arn arn:aws:iam::143671530412:oidc-provider/token.actions.githubusercontent.com
foreach($name in @('terraform','backend','frontend')) { aws iam get-role --role-name "permissionhub-github-$name-dev" --query 'Role.{Arn:Arn,Trust:AssumeRolePolicyDocument}' }
aws s3api get-bucket-versioning --bucket permissionhub-dev-bucket --region af-south-1
aws s3api get-bucket-versioning --bucket permissionhub-dev-lambda-artifacts --region af-south-1
aws dynamodb describe-table --table-name permissionhub-state-lock --region af-south-1 --query 'Table.{Status:TableStatus,Keys:KeySchema}'
```

## Current validation and application blockers

Read-only discovery found the OIDC provider (with STS audience), both same-account buckets and correctly shaped lock table already present. They are reused; three requested roles/policies were absent. No AWS create/update/apply has run. Access Analyzer validates rendered policies; its literal-wildcard warning on `StringEquals s3:if-none-match = *` is intentional: '*' is the required exact header value, not a pattern. Audience-claim informational suggestions do not require broadening trust.

The fresh-deployment follow-up resolves the two previously identified application blockers without recovering old infrastructure:

1. `permissionhub-dev/database` and `dev/permissionhub-dev/app` remain scheduled for deletion. Dev now creates unique `permissionhub-dev/database-*` and `permissionhub-dev/app-*` names and passes their new ARNs through Terraform. Leave old secrets to expire. No restore/import/permanent deletion was performed; production defaults are unchanged.
2. `20260801000000_initial_legacy_schema` restores the original schema from commit 7f453d8 before the seven unchanged upgrades. The full chain initializes an empty PostgreSQL 16 database with zero schema drift. No schema-push/data-loss fallback exists. See [FRESH-DEPLOYMENT.md](FRESH-DEPLOYMENT.md) for tests and ordered commands.

Regional create/read permissions for generated resource IDs cannot be fully validated without an approved real deployment. No live OIDC session or least-privileged deployment was executed; inspect first-run AccessDenied errors narrowly rather than attaching AdministratorAccess. No VPC/RDS/Cognito topology or provisioning business logic was changed.
