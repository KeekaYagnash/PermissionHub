# Manual AWS connections

Use a dedicated non-production AWS account and temporary or restricted credentials. Never use root credentials or paste access keys into PermissionHub.

## Configuration

```text
AUTH_ENABLED=false
ENABLE_DEV_AUTH=true
DEV_AUTH_USER_ID=user_org_admin_dev
AWS_CONNECTION_MODE=manual
ENABLE_AWS_DEMO_DATA=false
AWS_PROFILE=permissionhub-dev
AWS_REGION=af-south-1
```

The development user retains its tenant membership and application authorisation. SSO endpoints remain unavailable. In production, development authentication is rejected.

## Workflow

1. Apply the Prisma migration and start both applications.
2. Open Connection. It should say that no accounts are connected.
3. Add the expected 12-digit account ID and select `LOCAL_DEFAULT_CREDENTIALS` for the backend AWS profile, or `ASSUME_ROLE` with a read role ARN.
4. Leave “validate later” off to require STS account matching before saving. With it on, the account is saved as `PENDING` and cannot be selected or used for IAM calls.
5. Validate the connection. `CONNECTED` requires STS plus ListUsers, ListRoles, and ListPolicies. Partial IAM access is `DEGRADED`; STS/account failures are `ERROR`.
6. Set a connected account active. All IAM, policy, resource, request, and provisioning routes use that account from the server session.

The client never receives AWS credentials or external-ID values. Account switches clear the frontend query cache. The Connection page also provides development-only controls to clear the active AWS context and AWS discovery caches.

## Demo cleanup

Preview only records explicitly marked `DEMO_SEED`:

```bash
npm run aws:clear-demo-data -- --dry-run
```

Delete those records in a non-production environment:

```bash
npm run aws:clear-demo-data -- --confirm
```

Manual and unclassified legacy records are not deleted. Legacy records remain excluded from manual mode until explicitly reviewed and classified.
