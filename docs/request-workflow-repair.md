# Request, approval and provisioning repair

Branch: `demo_ready_2`. No deployment, AWS mutation, live database migration, push or merge was performed.

## Verified defects and fixes

- The lifecycle rendered arbitrary approval text containing `T` as an ISO date. Labels such as `ACCOUNT_APPROVER` threw during rendering. ISO/date validation, API error/empty states and a request-specific error boundary now provide recovery instead of a blank page.
- Reviewer visibility depended on eligibility for the current approval stage. Persisted approval participation now retains history access while membership, account scope and reviewer permissions still apply. Existing historical reviews without an Approval record cannot be retrospectively attributed from an approver display name.
- Requests loaded only the first 100 records and reviewers defaulted to an attention filter. The default is All; pages load progressively with cancellation and ID deduplication. Provisioning status is polled and terminal results replace the original queued response.
- Request history incorrectly depended on a currently healthy connection. History now validates tenant/account access without requiring working AWS credentials; AWS operations retain connection checks.
- IAM GetUser/GetRole treated NoSuchEntity as an unexpected error. Only that specific error now means an absent target. AccessDenied and other AWS errors still fail. New role creation preserves the approved trust document, path and session duration. Retry reuse requires request ownership tags and matching role configuration.
- The SQS provisioning handler acknowledged records without executing them. The handler now claims persisted jobs, rechecks current actor membership, account scope, approvals, expiry and configuration, and invokes the existing guarded executor. Prisma Client is included in the provisioning package. Terraform enables partial-batch failures.
- Final live approval and its queued job are saved transactionally. Approval idempotency keys are persisted, queue payloads contain only the job ID, and explicit provisioning/retry uses a database advisory lock and job reuse. SQS duplicate claims cannot execute AWS twice concurrently. Queue send failure preserves approval and a queued job; replaying the same action can deliver it.
- Approval UI has one combined action. Information requests require a message, pause the request, and require a requester response before review resumes. Rejection retains a confirmation and required reason. The compatibility approval API remains, with its original security checks.
- Browser tokens remain in sessionStorage. Same-origin live windows can hand off the session through BroadcastChannel; refresh is serialized through navigator.locks where supported, and remote logout clears the other tab. No token lifetime was extended and no tokens are written to localStorage. Private profiles, other browsers/origins and browsers without BroadcastChannel do not share this mechanism.

## Safety and limits

No approval, provisioner, tenant/account, STS matching, connection, policy validation, ownership, expiry or live-confirmation gate was removed. A combined approval still requires the existing approval and provisioning capabilities. Intermediate approval stages remain mandatory.

Success is returned only after AWS confirmation and database persistence. A failed preflight or execution is persisted with a safe error. UUID grant IDs avoid cross-instance timestamp collisions. AWS cannot participate in a PostgreSQL transaction: a worker crash or database outage after a possible AWS mutation requires reconciliation, not blind replay. RUNNING uncertain jobs remain blocked and can reach the DLQ. An automatic outbox/reconciliation daemon was not added; a queue delivery failure needs the same review action replay or authorized provisioning retry.

The existing expiry Lambda is still a disabled placeholder, not a demonstrated revocation worker. Do not regard a configuration flag as proof of functional automatic expiry, and do not enable temporary production grants without a working, tested revocation mechanism. This repair does not implement expiry processing or add platform-role IAM permissions. Selected access keys or assumed execution roles must have the permissions for the requested IAM operations and ownership tags.

Progress comes from durable request states, not a new per-step streaming API. While running, the UI does not invent completed AWS steps or timings. Raw technical results remain available. Full live CloudTrail and AWS behavior were not verified.

## Database and deployment

No schema migration was required: existing Request, Approval, ProvisioningJob, PermissionGrant and AuditEvent models are reused. Prisma generation and schema validation passed. The local disposable PostgreSQL migration check could not run because Docker's engine was stopped. Deployed `_prisma_migrations` status is unknown.

The existing controlled backend deployment runs the migration/status gate before releasing dependent API/worker code and serializes deployment state. CI/CD was not edited. Deploy API and provisioning-worker artifacts together and include the event-source mapping change after review. Do not deploy only the API while leaving the old no-op worker active.

An authorized operator can perform this read-only deployed migration status check from PowerShell (the payload requests **status**, not migration):

```powershell
Set-Content -Path migration-status-payload.json -Value '{"action":"status"}' -Encoding ascii
aws lambda invoke --region af-south-1 --function-name permissionhub-dev-db-migration `
  --cli-binary-format raw-in-base64-out --payload file://migration-status-payload.json `
  migration-status-result.json
Get-Content migration-status-result.json
```

Review `ok`, `mode` and `upToDate`; a successful Lambda invocation alone is not proof of current migrations. This command was not executed during implementation.

## Verification results

- Backend: 245 tests across 32 files passed; typecheck and production build passed.
- Frontend: 216 tests across 41 files passed; typecheck and production build passed.
- Lint passed with two pre-existing unused-symbol warnings; diff whitespace check passed.
- Prisma Client generation and schema validation passed; database migration execution was not verified because the Docker engine was unavailable.
- Terraform formatting and offline dev validation passed. No live plan/apply was run.
- Independent Lambda package/export validation passed for API, provisioning, expiry and migration. Uncompressed sizes were approximately 20.9 MB, 20.8 MB, 0.43 MB and 92.7 MB respectively, below the packaging safety budget. Artifacts were not uploaded.

Changes are concentrated in the request routes/repository/authorization, IAM service, real provisioning worker and queue, request UI/presentation, live-tab Cognito handoff, focused tests, the Lambda build dependency selection, and SQS partial-batch configuration. Existing Cloudflare-domain edits present before this task were preserved, not expanded by this repair.

## Local checks

```powershell
npm run prisma:generate --workspace backend
npm run lint
npm run typecheck --workspace backend
npm run typecheck --workspace frontend
npm test --workspace backend
npm test --workspace frontend
npm run build --workspace backend
npm run build --workspace frontend
npm run build:lambda --workspace backend
npm run package:lambda --workspace backend
# Requires a running local Docker engine; creates an isolated test database only:
npm run test:migrations --workspace backend
```

Tests cover mocked HTTP user creation, role creation and role trust updates; request list/detail visibility; prior-reviewer access; comment/response validation; STS mismatch with no mutation; AWS SDK missing-target/ownership/attachment behavior; atomic review/job persistence; queue failure/replay; duplicate worker claims; failure and uncertain persistence; request rendering, progressive pagination and multi-window session messages. They do not establish that a deployed AWS flow has succeeded.
