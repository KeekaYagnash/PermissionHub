# PermissionHub dev/prod deployment and reviewed destruction

## Recover the healthy but tainted dev Cognito domain in Actions

A failed creation waiter can leave `permissionhub-demo-dev` tainted even when the
AWS domain is ACTIVE. Repeating deployment does not clear that marker. Keep the
replacement guard enabled; do not delete state or the domain.

After merging the recovery implementation into dev, use the existing deployment
workflow's manual inputs: branch `dev`, environment `dev`,
`recover_cognito_domain=true`, `apply=true`, and confirmation
`RECOVER DEV COGNITO DOMAIN`. This is **recovery-only**, not an application apply.
For inspection without writing state, select `apply=false`.

The existing workflow can also be dispatched with GitHub CLI (no local Terraform):

```powershell
gh workflow run deploy.yml --repo KeekaYagnash/PermissionHub --ref dev -f environment=dev -f recover_cognito_domain=true -f apply=true -f recovery_confirmation='RECOVER DEV COGNITO DOMAIN'
```

The reusable recovery workflow checks branch/account/region/backend identity,
finds both pool and domain in raw state, requires the AWS domain to be ACTIVE in
that exact pool, and requires versioned state backups. Only then does it call
`terraform untaint` for the single fixed domain address under the normal state
lock. It neither changes AWS resources nor runs apply/import/destroy. It shares
the deployment concurrency group. Coordinate with any local Terraform users;
do not run competing state operations manually. Recovery is idempotent if the
domain is already untainted. Failed checks leave state unchanged.

After recovery succeeds, start a new normal dev deployment with recovery disabled.
PRs and ordinary pushes never clear taint automatically. No recovery was executed
against AWS or remote state during implementation.

## Current dev deployment: infrastructure first, no plan-encryption secret

Dev now routes through `deploy-dev-staged.yml`, superseding the older encrypted
cross-job backend workflow described below. `TF_PLAN_ENCRYPTION_KEY` is **not
required for dev deployment**. Production and the separate destroy workflow retain
their existing encrypted-plan requirements.

After validation, dev executes these ordered stages:

1. Plan/apply foundation networking, security, RDS, Secrets Manager, Cognito,
   queues, VPC endpoints and frontend hosting. This narrow bootstrap plan cannot
   create/update Lambda code and refuses destructive or unrelated changes.
2. Build/package all four real Lambda handlers, validate hashes/sizes/handlers,
   and upload immutable ZIPs using the backend artifact role.
3. Create/update the migration Lambda and run migration status/deploy/status.
4. Plan/apply the full configuration (including API Gateway, Lambda and monitoring),
   then check API health. Migration failure stops the API release and frontend.
5. Deploy frontend assets using the frontend role and invalidate CloudFront.

Every saved plan is applied in the **same job and runner** that created it. Plans
are not uploaded as GitHub artifacts or forwarded to another job. Runner-local
plan files are restricted with `umask 077`. Targeting is limited to the ordered
foundation/migration stages; a full untargeted plan completes the deployment.
Lambda creation necessarily follows packaging because AWS requires real code.

Partial dev deployments can resume from the existing state; never erase state or
change its key to retry. Existing Lambda artifact-bucket mismatches and destructive
plans remain blocked. `apply=false` produces only the foundation plan and does
not bundle/upload/deploy application code. Explicit migration validation must
pass, and `CI_MIGRATIONS_READY=false` remains an operator stop switch. No live IAM
provisioning operation is run as part of these implementation tests.

After merging this implementation to dev, an operator can start deployment:

```powershell
gh workflow run deploy.yml --repo KeekaYagnash/PermissionHub --ref dev -f environment=dev -f apply=true -f run_migrations=true
```

This command creates/modifies AWS resources; it was not executed during development.

Implementation branch: `demo_ready_2`. No AWS deployment/destruction, role/provider
changes, AWS migration, push or merge was performed during implementation.
This guide supersedes the old main-only development instructions.

## Branches, workflows and protections

| Event | Target | Behaviour |
|---|---|---|
| PR to dev | development-plan (optional AWS plan) | Credential-free tests/builds/Prisma/format/validation plus read-only plan when explicitly enabled |
| PR to main | production-plan (optional AWS plan) | Same validation, production config, no deployment |
| Push/merge to dev | development → dev Terraform | Validate, immutable artifacts, guarded deploy, controlled migrations, frontend, health |
| Push/merge to main | production → prod Terraform | Same pipeline, protected production approval before AWS deployment work |
| Manual fresh deployment | matching dev/main branch | Explicit fresh_deployment; empty application state only; all four artifacts and reviewed migrations required |
| Manual destroy | matching dev/main branch | Confirmation, encrypted saved plan, optional separate human approval, exact-plan apply |

`terraform-pr.yml` handles PRs and reusable validation. `deploy.yml` is the only
push deployment trigger. `deploy-dev-backend.yml` and `deploy-dev-frontend.yml`
retain their filenames but support both environments. `deploy-infrastructure.yml`
is a manual wrapper, not another push trigger. `verify-aws-oidc.yml` only reads
STS identity. `destroy-infrastructure.yml` is the ONLY destruction workflow and
has workflow_dispatch only. Deployment and destruction share the concurrency
group `permissionhub-state-dev` or `permissionhub-state-prod`; no child workflow
takes a second conflicting lock. Terraform state locking provides extra safety.

Configure GitHub Environments before dispatch:

* development: selected **dev branch only**, preserve reviewer requirements.
* production: selected **main branch only**, required reviewers, prevent self-review,
  disable administrator bypass. Workflow checks fail closed if protections are absent.
* development-plan / production-plan: optional, reviewed same-repository PR plans
  only, required reviewers, prevent self-review, disable admin bypass. Permit the
  PR merge refs appropriate to GitHub's environment branch rules. Use dedicated
  read-only planning identities, NEVER deployment-write role ARNs.
* development-destroy: selected dev branch only; required reviewers.
* production-destroy: selected main branch only; required reviewers, prevent
  self-review, disable admin bypass. Separate security/operations reviewers are
  recommended. This approval job has no AWS credentials/OIDC access.

GitHub Environment reviewers approve a job, not a Terraform CLI prompt. Destroy
approval must review the resources printed by the preceding plan job. Native
reviewer lists require one reviewer, not all listed reviewers. If two-person
approval is mandatory, add an external/custom protection rule; do not claim
native GitHub lists enforce a quorum. Some repository visibility/plan combinations
do not support required environment reviewers; production/destroy stays blocked
until the necessary protection is available.

References: [GitHub environment protections](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments),
[reviewing deployments](https://docs.github.com/en/actions/how-tos/managing-workflow-runs-and-deployments/managing-deployments/reviewing-deployments).

## External OIDC/prerequisite dependencies — not provisioned by this work

Configure the EXISTING variable names independently on development and production:

`AWS_INFRA_ROLE_ARN`, `AWS_PLAN_ROLE_ARN`, `AWS_BACKEND_ROLE_ARN`,
`AWS_ARTIFACT_ROLE_ARN`, `AWS_FRONTEND_ROLE_ARN`.

Also configure `AWS_ACCOUNT_ID`, `AWS_REGION`, `TF_STATE_BUCKET`, `TF_STATE_KEY`,
`TF_LOCK_TABLE`, `LAMBDA_ARTIFACT_BUCKET`, `CI_TF_VARS_JSON`,
`CI_MIGRATIONS_READY`, and secret `TF_PLAN_ENCRYPTION_KEY` (32 random bytes/base64).
Do not configure AWS access-key secrets. The shared OIDC action requires a role
ARN and clears existing credentials; missing roles fail explicitly.

The independent dev bootstrap files were deliberately NOT modified. Their old
main-only dev trust must be separately updated by the operator to dev branch,
environment development, repository KeekaYagnash/PermissionHub. Production roles
must trust main/production, and cover production resource names, RDS Proxy and
IAM pass-role to RDS as well as Lambda. No production role is created here.
The boundary, if configured, must permit the proxy role's secret access too.

State/artifact buckets and lock tables must be provisioned separately from the
application root. Keep the independent bootstrap state. Suggested production
names: permissionhub-prod-state-ACCOUNT_ID, permissionhub-prod-lambda-artifacts-ACCOUNT_ID,
permissionhub-prod-state-lock. Actual globally unique bucket names are operator
inputs. Artifact bucket names must contain the selected dev/prod segment.
State keys are strictly permisionhub/dev/backend and
permisionhub/prod/backend; workspace must be default. Backend bucket,
key, region and STS account are checked against the selected environment. Never
reuse the dev artifact bucket for production. Buckets need encryption, public
access blocking and versioning. CI checks artifact bucket versioning and ownership
via the selected account/permissions before it can upload. Initial bucket creation
is not an application Terraform dependency cycle.

For PR cloud plans, set repository ENABLE_PR_TERRAFORM_PLAN=true only after
protected planning environments and externally provisioned read-only roles are
ready. Populate their selected environment configuration/state variables and
AWS_PLAN_ROLE_ARN. Fork PRs never receive AWS credentials. Terraform state can
contain secrets: approve only trusted PR code. Local/fork validation works with
the flag false and reports AWS plan NOT RUN, rather than claiming a successful plan.
An opted-in missing role/configuration is a clear failure, not a silent skip.

## Production architecture and costs

Production is independent: prod namespaces, provider allowed_account_ids from
aws_account_id, separate remote backend, VPC 10.50.0.0/16, private DB, Cognito,
secrets, four Lambda functions, API, queues, frontend bucket/CloudFront and alarms.
Do not copy dev URLs, secrets, state, artifact references or connection keys.
Replace the placeholders in prod/terraform.tfvars.example before exporting.

RDS baseline: **db.t3.medium, 20 GiB**, PostgreSQL 16.15, encrypted storage,
Multi-AZ retained, 14-day automated backups, private access, deletion protection.
Read-only AWS discovery confirmed db.t3.medium/PostgreSQL 16.15/Multi-AZ is orderable
in af-south-1. db.t3.small can be viable for tiny workloads but has less memory
(2 GiB vs 4 GiB), less cache/connection headroom and needs load testing; it is not
the default. T3 is burstable; CPU credit charges can apply. No unrelated Lambda
memory/concurrency sizing was changed.

Multi-AZ, two NAT gateways, RDS Proxy and four interface endpoints remain present
and have continuing cost. They were not silently removed. Alarms do not currently
have notification actions configured. Production live IAM provisioning remains
disabled by default. Any real enablement is a separately reviewed operation.

Final snapshot names have a stable random suffix; automated backups are retained
on RDS deletion. Existing allocated RDS storage cannot be shrunk in place: the
20 GiB configuration is for a fresh production environment, not an instruction
to reduce an existing database's storage.

## Artifacts, migrations and frontend

Validation packages API/provisioning/expiry/migration independently from the
exact workflow commit. Handler exports and compressed/uncompressed sizes are
checked. CI uploads SHA-256 content-addressed objects using conditional create-only
writes in the selected environment bucket. Terraform alone updates Lambda code.

Routine releases update/check the migration Lambda first, then apply the main
guarded application plan. These are serial stages under ONE orchestration/state
concurrency lock, not independent applies. Fresh releases first create the full
infrastructure, then run status/migrate-deploy/status using the backend role.
Prisma's PostgreSQL advisory lock and orchestration concurrency prevent competing
migrations. Pending migrations require explicit reviewed flags; failed deploy or
postcheck blocks application/frontend release. The validated initial migration
and seven historical upgrades are unchanged; no db push/reset exists.

Public frontend outputs are passed from Terraform, including frontend-only
releases through a read-only context job. No stale bucket/distribution IDs are
hardcoded. The frontend checks bucket ownership, existence and CloudFront origin
before publication. New Terraform resources are usable immediately through new
outputs. Missing REQUIRED outputs/resources fail clearly. Set defer_frontend=true
only when intentionally deferring publication; the summary says DEFERRED, not
deployed. Backend/API health is still checked. A successful /health response is
not proof of Cognito login or live IAM operations; browser smoke testing follows
the first approved deployment.

## Reviewed destroy: what it does and does not delete

Phase A: exact DESTROY dev/prod confirmation, matching branch, selected OIDC role,
account/region/default-workspace/backend checks, terraform plan -destroy, resource
allowlist, resource display, encrypted plan artifact (one-day retention). No apply.
Phase B exists only when execute=true. A SEPARATE protected destroy Environment
job must be approved after reviewing Phase A; apply then authenticates the same
saved plan, environment, account, backend, commit, run and run attempt. It never
regenerates a plan. Terraform also rejects a stale state serial. Re-run the entire
workflow after preparation, not an old apply job.

The guard rejects OIDC providers, lock tables, shared buckets, CI roles/policies,
other-environment resources, forced bucket deletion, non-delete actions and
production plans without retained snapshots/backups. The bootstrap root is never
initialized by this workflow. Resources outside application Terraform state are
not removed or claimed removed.

Preparation requiring separate explicit approval:

1. Archive required data, exports, frontend objects and account credentials.
   Existing disposable dev RDS settings skip a final snapshot; take a separately
   approved backup first if dev data must survive. Destroy never silently changes
   those settings or disables deletion protection.
2. For prod RDS/Cognito, change database_deletion_protection=false and
   cognito_deletion_protection=INACTIVE in reviewed production config, export it,
   and run a NORMAL guarded infrastructure deployment first. Destroy does not
   disable protections itself. Restore protections if destruction is cancelled.
3. Confirm final snapshot identifier is unique and backups retained. Do not set
   skip_final_snapshot=true or delete_automated_backups=true to bypass a blocker.
4. Frontend buckets have force_destroy=false. Nonempty buckets intentionally
   block; apply preflight checks current objects (and versions/delete markers
   when versioning is enabled) before deleting anything. Separately archive and
   explicitly empty only that application bucket. Versioned buckets require the
   externally managed infrastructure role to allow s3:ListBucketVersions.
   No automatic recursive purge, shared-bucket deletion or force-delete exists.
5. Secrets are scheduled for normal recovery windows, not permanently deleted.
   Retained snapshots/backups, scheduled secrets, immutable build artifacts and
   out-of-state resources may continue to exist after destroy.

## Commands — local checks and operator-only operations

Local validation was executed as reported below. GitHub configuration and live
deployment/destruction commands are instructions only and were NOT executed.

### Safe local verification

```powershell
cd C:\Users\yagi1\OneDrive\Desktop\PermissionHub
git branch --show-current
npm ci
npm run prisma:generate --workspace backend
npm run typecheck
npm run lint
npm test --workspace backend
npm test --workspace frontend
node --test infrastructure/scripts/ci-lib.test.mjs infrastructure/scripts/workflows.test.mjs
npm run build
npm run build:lambda --workspace backend
npm run package:lambda --workspace backend
terraform fmt -check -recursive infrastructure/terraform
foreach ($environment in @('dev','prod')) {
  terraform "-chdir=infrastructure/terraform/environments/$environment" init -backend=false
  terraform "-chdir=infrastructure/terraform/environments/$environment" validate
}
terraform -chdir=infrastructure/terraform/environments/prod test
terraform -chdir=infrastructure/terraform/modules/rds init -backend=false
terraform -chdir=infrastructure/terraform/modules/rds test
# If actionlint is on PATH:
actionlint -shellcheck=''
```

For an empty local PostgreSQL test, use the Docker commands in
[FRESH-DEPLOYMENT.md](FRESH-DEPLOYMENT.md); choose a new disposable test database.
Never point MIGRATION_TEST_DATABASE_URL at AWS. The script rejects remote URLs.

### GitHub configuration — modifies GitHub, not AWS

First configure the Environment reviewers/branch restrictions listed above in
GitHub Settings. After OIDC/prerequisite provisioning by the operator, repeat
this block for dev and prod, entering actual values. No AWS keys are requested.

```powershell
$repo='KeekaYagnash/PermissionHub'
$environment=Read-Host 'Terraform environment: dev or prod'
if ($environment -notin @('dev','prod')) { throw 'Invalid environment' }
$githubEnvironment=if ($environment -eq 'dev') {'development'} else {'production'}
$values=@{
 AWS_ACCOUNT_ID=(Read-Host '12-digit selected AWS account ID')
 AWS_REGION='af-south-1'
 TF_STATE_BUCKET=(Read-Host 'Existing selected-environment state bucket')
 TF_STATE_KEY="permisionhub/$environment/backend"
 TF_LOCK_TABLE=(Read-Host 'Existing selected-environment lock table')
 LAMBDA_ARTIFACT_BUCKET=(Read-Host 'Existing selected-environment Lambda artifact bucket')
 AWS_INFRA_ROLE_ARN=(Read-Host 'Infrastructure deployment role ARN')
 AWS_PLAN_ROLE_ARN=(Read-Host 'Deployment-plan role ARN')
 AWS_BACKEND_ROLE_ARN=(Read-Host 'Backend deployment role ARN')
 AWS_ARTIFACT_ROLE_ARN=(Read-Host 'Artifact upload role ARN')
 AWS_FRONTEND_ROLE_ARN=(Read-Host 'Frontend deployment role ARN')
 CI_MIGRATIONS_READY='true' # after reviewed/passing migration history
}
foreach ($item in $values.GetEnumerator()) {
 gh variable set $item.Key --body $item.Value --env $githubEnvironment --repo $repo
}
gh variable set ENABLE_PR_TERRAFORM_PLAN --body false --repo $repo
# Generate once per environment; don't rotate between plan and apply jobs.
$key=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$key | gh secret set TF_PLAN_ENCRYPTION_KEY --env $githubEnvironment --repo $repo
Remove-Variable key

# Read-only checks of separately provisioned prerequisites:
aws s3api head-bucket --bucket $values.TF_STATE_BUCKET --expected-bucket-owner $values.AWS_ACCOUNT_ID
aws s3api get-bucket-versioning --bucket $values.LAMBDA_ARTIFACT_BUCKET --region $values.AWS_REGION
aws dynamodb describe-table --table-name $values.TF_LOCK_TABLE --region $values.AWS_REGION --query 'Table.TableStatus'

# Review/create the local terraform.tfvars first; replace ALL prod example placeholders.
# Uses the already configured operator AWS identity; no apply or state recovery.
terraform "-chdir=infrastructure/terraform/environments/$environment" init -reconfigure "-backend-config=bucket=$($values.TF_STATE_BUCKET)" "-backend-config=key=$($values.TF_STATE_KEY)" "-backend-config=region=$($values.AWS_REGION)" "-backend-config=dynamodb_table=$($values.TF_LOCK_TABLE)" '-backend-config=encrypt=true'
$boundary=Read-Host 'Externally managed runtime boundary ARN (blank if not required)'
$config=.\infrastructure\scripts\export-ci-config.ps1 -Environment $environment -Fresh -RuntimePermissionsBoundaryArn $boundary
$config | gh variable set CI_TF_VARS_JSON --env $githubEnvironment --repo $repo
Remove-Variable config
```

Optional protected PR plans: independently populate development-plan and
production-plan with the matching AWS_ACCOUNT_ID, AWS_REGION, state/lock/artifact
variables, CI_TF_VARS_JSON, and a dedicated read-only AWS_PLAN_ROLE_ARN. Only after
trust/reviewer verification:

```powershell
gh variable set ENABLE_PR_TERRAFORM_PLAN --body true --repo $repo
```

### Initial deployment — dispatches AWS-changing workflows

Only after reviewed changes exist on the matching branches and external trust
is correct. Plan-only still builds/uploads immutable S3 artifacts. It never
applies infrastructure. Apply runs create their own exact saved plan; they do not
reuse a prior plan-only run's plan. Review logs and environment gates accordingly.

```powershell
# Read-only AWS identity verification:
gh workflow run verify-aws-oidc.yml --ref dev --repo $repo -f environment=dev
gh workflow run verify-aws-oidc.yml --ref main --repo $repo -f environment=prod

# Initial dev: plan first, then approved creation/migrations/frontend:
gh workflow run deploy-infrastructure.yml --ref dev --repo $repo -f environment=dev -f fresh_deployment=true -f apply=false -f run_migrations=true
gh workflow run deploy-infrastructure.yml --ref dev --repo $repo -f environment=dev -f fresh_deployment=true -f apply=true -f run_migrations=true

# Initial prod: separate state/account/config, protected production approval:
gh workflow run deploy-infrastructure.yml --ref main --repo $repo -f environment=prod -f fresh_deployment=true -f apply=false -f run_migrations=true
gh workflow run deploy-infrastructure.yml --ref main --repo $repo -f environment=prod -f fresh_deployment=true -f apply=true -f run_migrations=true

# Add -f defer_frontend=true ONLY if intentionally deferring frontend publication.
gh run list --repo $repo --limit 10
$runId=Read-Host 'Run ID to watch'
gh run watch $runId --exit-status --repo $repo
```

After the first successful deployment, merges to dev/main perform routine releases
without fresh mode. Never erase nonempty state to satisfy a fresh guard. A partial
creation failure requires reviewed reconciliation, not automated recovery/deletion.

### Manual destroy — plan only, then separately approved execution

```powershell
# Plans only; no destruction:
gh workflow run destroy-infrastructure.yml --ref dev --repo $repo -f environment=dev -f confirmation='DESTROY dev' -f execute=false
gh workflow run destroy-infrastructure.yml --ref main --repo $repo -f environment=prod -f confirmation='DESTROY prod' -f execute=false

# DESTRUCTIVE: only after preparation/approval. Each run generates a plan,
# pauses at a SEPARATE protected destroy approval, then applies THAT saved plan.
gh workflow run destroy-infrastructure.yml --ref dev --repo $repo -f environment=dev -f confirmation='DESTROY dev' -f execute=true
gh workflow run destroy-infrastructure.yml --ref main --repo $repo -f environment=prod -f confirmation='DESTROY prod' -f execute=true
```

No deploy/destroy commands above were executed during this implementation. Real
OIDC trust, protected-environment approvals, IAM permissions, browser sign-in and
live provisioning remain to be verified after separately approved configuration.

## Validation results

* Backend: 102 tests passed, zero failed.
* Frontend: 111 tests passed, zero failed.
* Deployment/destroy helpers and workflow scenarios: 24 tests passed.
* Typechecks, backend/frontend builds, Lambda builds/packages/handler exports: passed.
* Prisma schema validation and isolated empty PostgreSQL 16.15 migration chain:
  passed, 8 migrations, 20 application tables, zero schema drift, second deploy no-op.
* Terraform dev/prod validation and recursive formatting: passed.
* Mocked independent fresh-production plan: 1 passed; mocked RDS safeguard plan: 1 passed.
* All 8 workflow/composite YAML files parsed; actionlint passed; PowerShell scripts parsed.
* Lint: zero errors, two pre-existing unused-variable warnings.
* No authenticated production Terraform plan/apply/destroy or GitHub approval run
  was executed. Production account/role/backend configuration is operator-supplied.

## Files changed in this pass

```text
.github/actions/aws-oidc/action.yml
.github/workflows/terraform-pr.yml
.github/workflows/deploy.yml
.github/workflows/deploy-dev-backend.yml
.github/workflows/deploy-dev-frontend.yml
.github/workflows/deploy-infrastructure.yml
.github/workflows/verify-aws-oidc.yml
.github/workflows/destroy-infrastructure.yml
infrastructure/scripts/ci.mjs
infrastructure/scripts/ci-lib.mjs
infrastructure/scripts/ci-lib.test.mjs
infrastructure/scripts/workflows.test.mjs
infrastructure/scripts/export-ci-config.ps1
infrastructure/terraform/environments/prod/main.tf
infrastructure/terraform/environments/prod/providers.tf
infrastructure/terraform/environments/prod/variables.tf
infrastructure/terraform/environments/prod/terraform.tfvars.example
infrastructure/terraform/environments/prod/tests/fresh.tftest.hcl
infrastructure/terraform/modules/rds/main.tf
infrastructure/terraform/modules/rds/variables.tf
infrastructure/terraform/modules/rds/versions.tf
infrastructure/terraform/modules/rds/.terraform.lock.hcl
infrastructure/terraform/modules/rds/tests/production.tftest.hcl
infrastructure/terraform/modules/rds_proxy/main.tf
infrastructure/terraform/modules/rds_proxy/variables.tf
docs/CI-CD.md
docs/FRESH-DEPLOYMENT.md
docs/OIDC-BOOTSTRAP.md
docs/DEPLOYMENT-OPERATIONS.md
```

Pre-existing unrelated working-tree changes were preserved. Initial/historical
migration SQL and independent OIDC bootstrap Terraform/policies were not changed.
# Dev backend configuration defaults

State object keys use the exact requested `permisionhub` spelling (one `s`):
`permisionhub/dev/backend` on dev and `permisionhub/prod/backend` on main.
These are S3 object keys, not local directories; no `.tfstate` suffix is required.
Update any explicit `TF_STATE_KEY` GitHub Environment variable, because variables
override workflow defaults. The preflight rejects the former keys before init.

**Existing state:** do not simply point a populated deployment at a new empty key.
Back up the old state and arrange a reviewed `terraform init -migrate-state` from
its previously initialized backend first, while deployments are paused. No state
was migrated by this change. For a genuinely fresh environment, initialize the
new key normally. Update the independent bootstrap IAM policies before CI uses
the new state key; production policies are separately managed. Keep the OIDC
bootstrap's own state key unchanged.

Deployment workflows use these defaults only for dev; explicit GitHub Variables
still override them. Production has no dev-resource fallback.

| GitHub Variable | Dev default |
|---|---|
| `TF_STATE_BUCKET` | `permissionhub-dev-bucket` |
| `TF_STATE_KEY` | `permisionhub/dev/backend` |
| `TF_LOCK_TABLE` | `permissionhub-state-lock` |
| `AWS_ACCOUNT_ID` | `143671530412` |
| `LAMBDA_ARTIFACT_BUCKET` | `permissionhub-dev-lambda-artifacts` |

The application state key is deliberately different from the independent OIDC
bootstrap key `permissionhub/github_roles/terraform.tfstate`. Never interchange them.
The state bucket, lock table and artifact bucket must already exist. Defaults do
not create or verify those resources. Backend preflight rejects empty or padded
values with named errors before Terraform init. Reviewed `CI_TF_VARS_JSON` and the
`TF_PLAN_ENCRYPTION_KEY` secret remain required; neither is fabricated by defaults.
# Initial dev deployment (empty state)

**Migration readiness update:** dev deployments now receive
`migrations_validated` from the same-commit validation workflow. That job runs the
complete migration chain on disposable PostgreSQL before packaging and the new
`Backend prepare pre-merge checks (no AWS access)` step. A successful validation
therefore satisfies dev readiness without setting `CI_MIGRATIONS_READY=true`
manually. An explicit `CI_MIGRATIONS_READY=false` remains an operator stop switch.
Production still requires its manually configured readiness flag.

Pre-merge preparation verifies all four artifact hashes/sizes, manifest handler
paths, backend settings and repository-level `CI_TF_VARS_JSON` if supplied. It
does not assume AWS roles, read remote state, upload ZIPs or use environment
secrets. GitHub Environment-only values cannot be inspected by this credential-free
PR job. Deployment still verifies environment configuration, remote state and
AWS permissions. Protect dev with required validation checks; never give PR code
the deployment role just to run preparation early.

The backend now detects an entirely empty, identity-checked **dev** application
state and selects initial deployment automatically. It requires the full Lambda
build manifest, uploads the four artifacts, uses the infrastructure role and
guarded infrastructure plan, applies that exact plan, and only then runs the
migration Lambda. API verification and frontend publication follow migrations.
Set `CI_MIGRATIONS_READY=true` in GitHub Environment `development` only after
reviewing the passing migration checks; initial apply refuses to proceed without
it. Reviewed `CI_TF_VARS_JSON`, plan encryption and bootstrap prerequisites remain
required. Dev-only detection never automatically initializes production.

Nonempty/partially created application state is **not** automatically treated as
fresh. Do not delete state or change keys to trigger initial deployment. A failed
partial apply needs review and a controlled recovery, not another empty-state
deployment. Production still requires explicit `fresh_deployment` and migration
approval. Older instructions requiring explicit fresh mode for dev are superseded
by this dev-only detection.
# Terraform configuration source for CI

For dev, an unset, empty or whitespace-only `CI_TF_VARS_JSON` now selects the
reviewed `infrastructure/terraform/environments/dev/ci.tfvars.json`. This file
contains non-secret networking/demo settings and the independently managed dev
runtime boundary ARN. Artifact keys/hashes still come from the actual build
manifest, not placeholder ZIP names. It intentionally omits credentials and
provider client secrets. Keep this CI configuration aligned with local
`terraform.tfvars` when intentionally changing dev settings.

A non-empty GitHub Variable overrides the file and must be a complete valid JSON
object matching the selected environment, region and artifact bucket. Malformed
or truncated overrides fail with a named error rather than falling back silently.
Production still requires explicit `CI_TF_VARS_JSON`; it never uses dev settings.
The configuration is checked before uploads, in PR preparation, and through a
credential-free mocked Terraform dev plan. Deployment-environment overrides are
only visible to the deployment job, not the PR job. `TF_PLAN_ENCRYPTION_KEY`
remains a required GitHub Environment secret and must not be committed here.
# One-time saved-plan encryption secret

Set `TF_PLAN_ENCRYPTION_KEY` as a **Secret**, not Variable, in GitHub Environment
`development` (production has its own independent secret). It must encode exactly
32 cryptographically random bytes as base64. It cannot safely be supplied as a
checked-in default. A deployment now runs `deployment-preflight` before the build,
artifact uploads or Terraform plan, reporting missing/invalid configuration
together. This check has no AWS credentials and is never run with secrets on PRs.
AWS policy/resource/quota errors still require real deployment-time checks.

Run locally, after `gh auth login`, to create a missing secret without displaying it:

```powershell
.\infrastructure\scripts\set-plan-encryption-key.ps1 -Environment development
```

If the existing secret is invalid, first ensure no deployment or destroy runs are
active/queued, then explicitly rotate it:

```powershell
.\infrastructure\scripts\set-plan-encryption-key.ps1 -Environment development -Rotate
```

This command changes GitHub configuration only, not AWS. It does not print/store
the generated value on disk. Rotation prevents old saved plans from decrypting;
start a new deployment run afterwards. The same environment secret is required
by plan and apply. The helper refuses replacement without `-Rotate`.
