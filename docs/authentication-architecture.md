# PermissionHub authentication and account scoping

This document describes the `user_login` branch. The branch introduces PermissionHub identities and server-managed sessions without treating an AWS principal as the logged-in application user.

## Authentication providers

`AuthProvider` separates login from application authorisation. The abstraction remains available so an external provider can be reintroduced later without changing tenant or account authorisation.

- `development` is currently the only configured provider. It provides an explicitly enabled local user selector and is rejected when `NODE_ENV=production`.
- SSO/OIDC login routes, callback handling, configuration, and frontend controls are currently removed.

The browser receives an HTTP-only session cookie. Redis stores production sessions; the Express memory store is used only outside production. State-changing API requests require the session CSRF token in `X-CSRF-Token`. No access token, refresh token, AWS credential, or external ID is stored in browser storage.

## Tenant and scope model

A `User` may have many `AuthIdentity` records and `TenantMembership` records. Membership roles are application roles, not AWS roles:

- `REQUESTER`
- `ACCOUNT_APPROVER`
- `OU_ADMIN`
- `SECURITY_REVIEWER`
- `PROVISIONER`
- `ORGANISATION_ADMIN`
- `PLATFORM_ADMIN`

`AdminScope` assigns capabilities at `TENANT`, `AWS_ORGANISATION`, `ORGANISATIONAL_UNIT`, or `AWS_ACCOUNT` level. OU scopes can include descendants. `AuthorizationService` performs server-side checks for tenant, organisation, OU, account, requesting, approval, provisioning, revocation, and configuration. A platform administrator receives no customer AWS scope merely because of the platform role.

The active tenant and AWS account are stored in the server session. The backend ignores client-supplied tenant or account identifiers unless they match an authorised session context. Switching context clears frontend query and policy catalogue caches. Backend AWS cache keys include the AWS account ID.

## Data model and migration

The migration in `backend/prisma/migrations/20260803120000_multi_tenant_auth` adds users, auth identities, tenants, memberships, AWS Organisations, OUs, accounts, scopes, approval policies, principal mappings, and connection audit events. Request scoping columns are nullable so historic requests remain readable. The migration copies the original user name to `displayName` and preserves the original role in `legacyRole` before removing the old single-role columns.

Before applying to an existing database:

1. Back up PostgreSQL.
2. Review the generated migration against the deployed schema.
3. Decide which tenant should own each legacy user and request.
4. Apply the migration with `npx prisma migrate deploy --schema backend/prisma/schema.prisma`.
5. Create explicit tenant memberships and backfill nullable request context in a controlled data migration.

Rollback requires restoring the database backup. Do not attempt a destructive down migration after tenant-scoped records have been created.

## AWS connection model

`AwsConnectionBroker` creates account-specific IAM, S3, RDS, Lambda, Access Analyzer, Organizations, and STS clients. It uses the backend default credential chain for a directly connected sandbox account or STS `AssumeRole` for managed/external accounts.

Cross-account sessions are short-lived and use a `PermissionHub-*` session name. External accounts resolve their external ID from a Secrets Manager reference; the raw value is not stored on the account or returned to the frontend. After assuming a role, PermissionHub calls `GetCallerIdentity` and rejects a result whose account ID differs from the configured account.

Read and provisioning roles are separate. `infrastructure/cloudformation/permissionhub-account-onboarding.yaml` creates `PermissionHubReadRole` and `PermissionHubProvisionRole` with limited permissions. Live cross-account provisioning additionally requires the existing live-provisioning safeguards and `CROSS_ACCOUNT_PROVISIONING_ENABLED=true`.

## Organisation and standalone onboarding

Organisation discovery uses AWS Organizations pagination for organisation metadata, roots, nested OUs, accounts, status, and placement. It is backend-only, cached for five minutes, manually refreshable, and protected by `AWS_ORGANISATIONS_DISCOVERY_ENABLED` plus organisation-admin authorisation.

For an organisation-managed account, deploy the onboarding template through StackSets, Terraform, or the organisation's existing infrastructure pipeline. For a standalone/external account, deploy it directly with a unique external ID, store that value in Secrets Manager, and save only the secret reference in PermissionHub.

## Identity Center approach

The request target model already distinguishes Identity Center users/groups, IAM users, IAM roles, and IAM groups. `IDENTITY_CENTER_ENABLED` remains off by default. Identity Store discovery, permission-set management, and account-assignment provisioning are interfaces/deferred integrations; this branch does not claim they have been tested against a live Identity Center instance.

## Approval routing

`ApprovalRoutingService` derives stages, maximum duration, permanent-access policy, and automatic/manual provisioning from account type and requested risk. Production adds account approval, security review, and provisioning; Security and Management accounts require stronger manual paths. A requester cannot approve their own request.

The in-code defaults are a bootstrap path. Persisted `ApprovalPolicy` records are the intended configurable source once the application moves request storage fully from the current in-memory compatibility layer to Prisma.

## Environment variables

See `.env.example`. Local authentication requires `AUTH_ENABLED=true`, `ENABLE_DEV_AUTH=true`, and a strong `SESSION_SECRET`. `ENABLE_DEV_AUTH` must be false in production. A production login provider must be implemented and reviewed before production deployment.

## Local branch test

```powershell
git checkout user_login
npm install
Copy-Item .env.example .env
# Set NODE_ENV=development, ENABLE_DEV_AUTH=true,
# AUTH_ENABLED=true, and a random SESSION_SECRET of at least 32 characters.
docker compose up -d postgres redis
npm run prisma:generate -w backend
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run seed
npm run dev
```

Open `http://localhost:5173/login`, select a development identity, choose an authorised AWS account, and exercise the request/review workflow with separate seeded users. Start with `AWS_PROVISIONING_MODE=disabled`; use `AWS_PROVISIONING_MODE=dry-run` to validate an operation plan without changing AWS.

## Security limitations

- SSO/OIDC login is not currently available. Development login is intentionally unavailable in production.
- Identity Center discovery and assignment are modeled but deferred.
- AWS Organizations discovery and cross-account role assumption require real role deployment and have not been asserted live by this branch.
- Development directory and request persistence retain an in-memory compatibility path while the existing app is migrated incrementally to Prisma.
- Production sessions require reachable Redis; development uses process memory.
