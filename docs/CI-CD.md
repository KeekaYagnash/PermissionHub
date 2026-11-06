# PermissionHub CI/CD

Current authoritative operations: [DEPLOYMENT-OPERATIONS.md](DEPLOYMENT-OPERATIONS.md).
Branch mapping is now **dev → development/dev**, **main → production/prod**.
OIDC infrastructure was deliberately not changed: the operator must update the
separately managed dev trust from main to dev and supply independent production
and protected read-only planning roles.

For current dev OIDC role names, exact policies, prerequisite ownership and one-time commands, use [OIDC-BOOTSTRAP.md](OIDC-BOOTSTRAP.md). That guide supersedes the previous five-role/development-plan setup. Dev now uses exactly three roles and the existing **development** environment. The prior dev teardown was intentional; explicit fresh deployment is supported.

## Workflows

- terraform-pr.yml: credential-free PR validation, Prisma checks, both applications' tests/builds, deterministic Lambda packages, Terraform formatting/validation and mocked bootstrap tests. Optional cloud planning stays disabled for the three-role dev setup.
- deploy.yml: automatic changed-component releases after merge to dev/main, mapped to dev/prod; manual fresh/reviewed deployments from the matching branch. One concurrency lock per state, shared with destroy; cumulative comparison against the last successful release on that branch.
- deploy-dev-backend.yml: reusable backend artifact staging, schema gate, saved/inspected/encrypted Terraform plans and exact-plan application. Existing AWS_*_ROLE_ARN names are retained; dev maps plan/infrastructure to the Terraform role and artifacts/backend to the backend role.
- deploy-dev-frontend.yml: frontend-only OIDC role, allowlisted public outputs passed from backend, asset-first/HTML-last publication and CloudFront invalidation. It has no state/secret access. Frontend-only releases obtain current public outputs in a separate read-only backend context job; no manual output-variable handoff is needed.
- deploy-infrastructure.yml: manual plan-only default, same orchestration, explicit fresh_deployment for empty dev state.
- verify-aws-oidc.yml: manual dev/prod STS identity check from the matching branch; no deployment.
- destroy-infrastructure.yml: the only manual destroy workflow; exact confirmation, encrypted saved plan, separate protected human approval and exact-plan application. Bootstrap resources are excluded.

## Safety

GitHub OIDC replaces AWS access-key secrets. Development requires dev branch; production requires main, reviewers, self-review prevention and disabled admin bypass. The existing five role-variable names are resolved separately in each environment. OIDC trust provisioning is outside this pass. PR roles use protected development-plan/production-plan environments and must never reuse deployment-write roles.

Artifact keys are content-addressed and uploaded with conditional create-only writes. The shared deterministic Node ZIP packager verifies handlers and sizes; the PowerShell wrapper uses the same implementation. Terraform owns Lambda code. CI does not call update-function-code.

Saved plans are AES-256-GCM encrypted with TF_PLAN_ENCRYPTION_KEY and authenticated against repository/environment/commit. Destruction/replacement is blocked. Backend-only plans cannot change general infrastructure. Bootstrap Terraform/state is separate and cannot be destroyed by application CI.

Ordinary releases check migration status first; approved migrations run before application updates. Fresh infrastructure must exist before its database can be initialized; migration failure blocks frontend release. No schema push/data-loss fallback exists. Production migrations remain explicitly selected.

## One-time preparation and limitations

See the authoritative bootstrap guide before activation. Both prerequisite buckets, lock table and GitHub provider already exist and are reusable. Three CI roles must still be created by the operator after reviewing their bootstrap plan. No AWS role/resource changes have been applied by this work.

See [FRESH-DEPLOYMENT.md](FRESH-DEPLOYMENT.md) for the fresh deployment sequence. Dev secret names now use unique prefixes to avoid old scheduled-deletion names. The restored initial migration plus unchanged upgrades is validated on isolated PostgreSQL in CI. Set CI_MIGRATIONS_READY=true only after reviewing that chain, and explicitly select run_migrations for the first deployment. AWS policy validation is not equivalent to a real GitHub OIDC login or successful least-privileged infrastructure deployment.
