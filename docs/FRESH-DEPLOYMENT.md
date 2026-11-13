# Fresh PermissionHub dev deployment

Account `143671530412`, region `af-south-1`, repository
`KeekaYagnash/PermissionHub`, GitHub Environment **development**.
Implementation stays on `demo_ready_2`. Current pipelines deploy dev from **dev**
and production from **main**. The operator must update the separately managed dev
OIDC trust before dispatching; this task did not change deployment roles.
See [DEPLOYMENT-OPERATIONS.md](DEPLOYMENT-OPERATIONS.md) for authoritative dev/prod
settings and destroy instructions. This task did not push, merge, apply, upload,
invoke AWS Lambda, or migrate AWS.

## Ownership and readiness

There is no old RDS instance to recover. Application remote state is empty.
Do not restore previous state, import destroyed application resources, or seed
the new database with old/demo records.

The independent `infrastructure/terraform/bootstrap/github-dev` root remains
separate. It owns the three GitHub roles, policies, runtime boundary, and any
prerequisites it creates. Existing GitHub provider, state/artifact buckets and
lock table are reused, not recreated in application Terraform. Keep its local
state backed up securely. Do not destroy it with the application.

Read-only discovery confirmed `permissionhub-dev/database` and
`dev/permissionhub-dev/app` are scheduled for deletion. The old deterministic
database secret name would conflict. **Safest resolution: leave them to expire.**
Dev now creates unique `permissionhub-dev/database-*` and
`permissionhub-dev/app-*` secret names. The provider suffix avoids both the old
names and collisions on subsequent fresh rebuilds. All runtime references use
the newly generated ARNs, within existing OIDC policy namespaces. Production
module defaults retain their previous deterministic naming. No restore,
force-delete, import, or secret-value read is needed.

The restored baseline `20260801000000_initial_legacy_schema` creates the original
schema before the seven existing upgrades. Their SQL/checksums are unchanged.
See `backend/prisma/baseline/README.md`. Empty local PostgreSQL 16.15 validation:
8 migrations, 20 application tables, 49 indexes, 33 foreign keys, zero schema
drift; repeated deploy is a no-op; persistence/FK/unique/cascade checks pass.
CI repeats this test on a disposable PostgreSQL service. No schema push is used.

Application plan: **104 creates, 0 changes, 0 destroys**, from empty state.
It includes VPC, six subnets, routes/IGW/NAT/EIP, security groups, four interface
endpoints, private PostgreSQL RDS and subnet group, new secrets, Cognito pool/
client/domain/groups, HTTP API/JWT integration/routes/logs, four Lambda functions
and runtime roles/policies/logs, SQS queue/DLQ/consumer, private frontend S3/OAC/
CloudFront, and CloudWatch alarms. RDS Proxy and expiry schedule are disabled.
NAT is required for public IAM/Cognito/AWS endpoints not covered by the four
interface endpoints. Do not disable it for this deployment.

Read-only preflight also found 4 VPCs against a regional quota of 5, zero
allocated EIPs, and no pool currently associated with `permissionhub-demo-dev`.
The planned VPC fits but consumes the last available VPC slot; recheck before
apply if other deployments run concurrently. These observations are not resource
reservations.

All Lambda functions explicitly wait for their VPC/runtime IAM policies. The
migration Lambda receives `DATABASE_MIGRATION_MODE=migrate`; passwords and
credential-encryption keys are generated and stored in new Secrets Manager
secrets. Bootstrap consumes neither old database credentials nor old outputs.

## Read-only verification / local validation

These commands do not create/modify AWS resources. Local build/plan files are
generated. Plan files/state may contain secrets: never commit or publish them.

```powershell
cd C:\Users\yagi1\OneDrive\Desktop\PermissionHub
git branch --show-current  # must remain demo_ready_2 for this work
aws sts get-caller-identity --region af-south-1
aws rds describe-db-instances --region af-south-1 --query 'DBInstances[].{Name:DBInstanceIdentifier,Status:DBInstanceStatus}'
aws secretsmanager describe-secret --secret-id permissionhub-dev/database --region af-south-1 --query '{Name:Name,DeletedDate:DeletedDate}'
aws secretsmanager describe-secret --secret-id dev/permissionhub-dev/app --region af-south-1 --query '{Name:Name,DeletedDate:DeletedDate}'
# ResourceNotFound is acceptable once scheduled deletion finishes. Never read secret values.

npm ci
npm run prisma:generate --workspace backend
npm run typecheck
npm run lint
npm test --workspace backend
npm test --workspace frontend
node --test infrastructure/scripts/ci-lib.test.mjs
npm run build
npm run build:lambda --workspace backend
npm run package:lambda --workspace backend
terraform fmt -check -recursive infrastructure/terraform
terraform -chdir=infrastructure/terraform/bootstrap/github-dev init
.\infrastructure\scripts\prepare-oidc-bootstrap.ps1
.\infrastructure\scripts\validate-oidc-policies.ps1
terraform -chdir=infrastructure/terraform/bootstrap/github-dev validate
terraform -chdir=infrastructure/terraform/bootstrap/github-dev test
terraform -chdir=infrastructure/terraform/bootstrap/github-dev plan '-out=tfplan.oidc-bootstrap'
terraform -chdir=infrastructure/terraform/bootstrap/github-dev show 'tfplan.oidc-bootstrap'
```

Optional local migration reproduction using Docker (never an AWS database):

```powershell
docker run --detach --name permissionhub-migration-test --publish 127.0.0.1:55439:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=permissionhub_migration_test_fresh postgres:16
do { Start-Sleep -Seconds 1; docker exec permissionhub-migration-test pg_isready -U postgres | Out-Null } while ($LASTEXITCODE -ne 0)
try {
  $env:MIGRATION_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/permissionhub_migration_test_fresh'
  npm run test:migrations --workspace backend
  if ($LASTEXITCODE -ne 0) { throw 'Fresh migration validation failed' }
} finally {
  Remove-Item Env:MIGRATION_TEST_DATABASE_URL -ErrorAction SilentlyContinue
  docker rm --force permissionhub-migration-test
}
```

## Operator-approved changes — execute in order

The following commands **modify AWS or GitHub**, or dispatch workflows that do.
Review policies/plan first. They are instructions only; none were run by this task.

### 1. Apply the independent reviewed OIDC bootstrap

```powershell
terraform -chdir=infrastructure/terraform/bootstrap/github-dev apply 'tfplan.oidc-bootstrap'
terraform -chdir=infrastructure/terraform/bootstrap/github-dev output -json role_arns
```

Back up this root's state securely. If discovery sees existing resources, it
generates imports for review; do not make duplicate buckets/providers/roles.

### 2. Configure GitHub development environment

Create/reuse **development** in GitHub Settings → Environments. Select deployment
branches/tags: **selected branches**, **dev branch only**, no tags or wildcards.
Preserve any existing reviewer protection. Dev should require reviewed PRs and
validation. Repository Actions must permit these workflows/actions and OIDC.

```powershell
$repo='KeekaYagnash/PermissionHub'
gh auth status
$values=@{
 AWS_REGION='af-south-1'
 TF_STATE_BUCKET='permissionhub-dev-bucket'
 TF_STATE_KEY='permisionhub/dev/backend'
 TF_LOCK_TABLE='permissionhub-state-lock'
 LAMBDA_ARTIFACT_BUCKET='permissionhub-dev-lambda-artifacts'
 AWS_INFRA_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-terraform-dev'
 AWS_PLAN_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-terraform-dev'
 AWS_BACKEND_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-backend-dev'
 AWS_ARTIFACT_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-backend-dev'
 AWS_FRONTEND_ROLE_ARN='arn:aws:iam::143671530412:role/permissionhub-github-frontend-dev'
 CI_MIGRATIONS_READY='true' # only after reviewing/test-passing the initial migration
}
foreach ($item in $values.GetEnumerator()) { gh variable set $item.Key --body $item.Value --env development --repo $repo }
gh variable set ENABLE_PR_TERRAFORM_PLAN --body false --repo $repo
# Set once; keep stable across plan and apply jobs. Not an AWS credential.
$key=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$key | gh secret set TF_PLAN_ENCRYPTION_KEY --env development --repo $repo
Remove-Variable key

terraform -chdir=infrastructure/terraform/environments/dev init -reconfigure '-backend-config=bucket=permissionhub-dev-bucket' '-backend-config=key=permisionhub/dev/backend' '-backend-config=region=af-south-1' '-backend-config=dynamodb_table=permissionhub-state-lock' '-backend-config=encrypt=true'
$config=.\infrastructure\scripts\export-ci-config.ps1 -Environment dev -Fresh
$config | gh variable set CI_TF_VARS_JSON --env development --repo $repo
Remove-Variable config
```

Review `terraform.tfvars` before exporting (network ranges, availability zones,
RDS version, Cognito domain prefix). The exporter adds the boundary ARN from
independent bootstrap output; no application outputs/state recovery are needed.
The state key must be empty for fresh deployment. If nonempty, stop and inspect;
do not delete/overwrite/restore state automatically. Old placeholders/artifact
references in local auto tfvars are overridden by generated CI artifact vars.
Current public frontend outputs are passed between jobs automatically: no old
API, Cognito client, CloudFront or frontend bucket variable is required.

### 3. Verify all three OIDC roles (read-only AWS activity)

After reviewed workflow changes are available on dev:

```powershell
gh workflow run verify-aws-oidc.yml --ref dev --repo $repo -f environment=dev
gh run list --workflow verify-aws-oidc.yml --repo $repo --limit 5
# Enter the displayed run ID. All three identity checks must pass.
$oidcRunId=Read-Host 'OIDC verification run ID'
gh run watch $oidcRunId --exit-status --repo $repo
```

### 4. Resolve old secret names

No AWS command is necessary with the unique dev prefixes. Leave pending secrets
untouched. Do not restore or permanently delete them. Read-only describe commands
above provide status without exposing values.

### 5–9. First application deployment, migrations, frontend, health

The plan-only workflow still **uploads immutable build artifacts** to the
independently bootstrapped artifact bucket. It does not apply application infra.
It builds four independent Linux packages and checks handlers, checksums and size
before upload. No manual ZIP build/upload is needed.

```powershell
gh workflow run deploy-infrastructure.yml --ref dev --repo $repo -f environment=dev -f fresh_deployment=true -f apply=false -f run_migrations=true
gh run list --workflow deploy-infrastructure.yml --repo $repo --limit 5
$planRunId=Read-Host 'Plan-only run ID'
gh run watch $planRunId --exit-status --repo $repo
```

Review the plan in logs: new application resources only, no destruction or
bootstrap-owned resource creation. After approval:

```powershell
gh workflow run deploy-infrastructure.yml --ref dev --repo $repo -f environment=dev -f fresh_deployment=true -f apply=true -f run_migrations=true
gh run list --workflow deploy-infrastructure.yml --repo $repo --limit 5
$deployRunId=Read-Host 'Approved deployment run ID'
gh run watch $deployRunId --exit-status --repo $repo
```

This run creates/authenticates its own saved encrypted plan and applies that exact
plan after the configured environment gates. It is not reusing the earlier
plan-only run's plan. Fresh flow: upload artifacts → full infra apply → switch
to backend role → invoke private migration Lambda status/migrate/status → API
health → pass six allowlisted public outputs → frontend deploy/invalidate/health.
No migration is attempted before RDS/networking/secrets/Lambda exist.

The successful workflow summary prints the new frontend URL. Verify Cognito
signup/confirmation/signin, organisation setup, AWS onboarding and a request
create/read/approval through the UI. Do not test real IAM mutations without
separate permission. API /health + migration checks do not prove these workflows.

### 10. Routine deployments

After the first successful release, reviewed pushes/merges to dev automatically
deploy affected components. Do not pass fresh_deployment again. Approved pending
migrations use the migration Lambda before application updates. Frontend-only
changes read public outputs through a separate OIDC context job; the frontend
role never reads Terraform state. No manual packaging/upload/terraform apply is
needed after the independent one-time bootstrap.

If migration/frontend fails after a **complete** infra apply, inspect the failure
and dispatch again with fresh_deployment=false, apply=true, run_migrations=true.
For a **partial** Terraform creation failure, stop for reviewed reconciliation;
fresh mode deliberately refuses nonempty state, and normal mode requires all
four existing Lambda records. Never erase state to make the guard pass.

## Remaining limitations / approvals

No real GitHub OIDC session, least-privilege apply, AWS migration or browser
smoke test was executed. First-run IAM denial must be reviewed narrowly, not
fixed with AdministratorAccess. Check VPC/EIP quotas and Cognito domain
availability. Existing dev settings enable live provisioning and disable the
expiry worker: preserve approval gates, use disposable targets only, and treat
temporary revocation as manual until an approved expiry worker is enabled.
Production architecture/business logic is unchanged.
