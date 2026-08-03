# PermissionHub

The `user_login` branch adds server-managed user authentication, tenant membership, scoped AWS account selection, delegated application roles, approval routing, and guarded cross-account role assumption. See [Authentication architecture](docs/authentication-architecture.md) and [real AWS connectivity](docs/aws-real-connectivity.md) for configuration, onboarding, and security details.

PermissionHub is now a focused AWS permission request and provisioning application. The primary workflow is simple: discover IAM users and roles, choose managed policies or specific actions, submit a justified access request, approve it, preview the exact IAM change, provision the approved attachment through the backend, and audit the result.

The frontend never requests, captures, displays, logs, saves, or transmits AWS access keys. Local AWS credentials must stay outside this repository and be resolved by the AWS SDK v3 default credential provider chain in the backend.

## Project Structure

```text
frontend/
  src/
    components/Layout.tsx
    lib/api.ts
    pages/Overview.tsx
    pages/Requests.tsx
    pages/RequestDetail.tsx
    pages/NewRequest.tsx
    pages/Permissions.tsx
    pages/Identities.tsx
    pages/Activity.tsx
    pages/Connection.tsx
    types.ts
backend/
  src/
    routes/api.routes.ts
    services/aws/aws-services.ts
    services/mock.service.ts
    services/provisioning.service.ts
    services/email.service.ts
    config/env.ts
  prisma/schema.prisma
```

## Local Startup

Requirements: Node.js 20+ and npm 10+.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The backend serves REST APIs at `http://localhost:4000/api` and Swagger documentation at `http://localhost:4000/api/docs`.

## AWS Local Testing Workflow

1. Install dependencies with `npm install`.
2. Configure an AWS CLI profile outside this project.
3. Set `AWS_PROFILE=permissionhub-dev` and `AWS_REGION=af-south-1`.
4. Start the backend and frontend with `npm run dev`.
5. Open the Connection page.
6. Test the AWS connection.
7. Browse IAM policies and identities.
8. Create a permission request.
9. Approve the request.
10. Run SIMULATE mode.
11. Enable LIVE mode only in a dedicated sandbox AWS account.
12. Provision the approved attachment.
13. Verify the attachment in AWS IAM.
14. Revoke the test grant.
15. Review CloudTrail after testing.

## Required Environment Variables

`.env.example` contains variable names only. Do not commit real values.

```text
AWS_PROFILE
AWS_REGION
PROVISIONING_MODE
ENABLE_LIVE_PROVISIONING
PROVISIONING_CONFIRMATION
DATABASE_URL
REDIS_URL
AUTH_ENABLED
AUTH_PROVIDER
ENABLE_DEV_AUTH
SESSION_SECRET
SESSION_COOKIE_NAME
OIDC_ISSUER_URL
OIDC_CLIENT_ID
OIDC_CLIENT_SECRET
FRONTEND_URL
SES_FROM_EMAIL
```

Recommended local configuration:

```bash
AWS_PROFILE=permissionhub-dev
AWS_REGION=af-south-1
PROVISIONING_MODE=MOCK
AUTH_ENABLED=true
AUTH_PROVIDER=development
ENABLE_DEV_AUTH=true
SESSION_SECRET=<generate-at-least-32-random-characters>
```

## Provisioning Modes

`PROVISIONING_MODE=MOCK` is the default. It makes no AWS changes and returns realistic test results.

`PROVISIONING_MODE=SIMULATE` uses IAM simulation where supported and makes no policy attachments or modifications.

`PROVISIONING_MODE=LIVE` can attach or detach policies only when both server-side guards are present:

```bash
ENABLE_LIVE_PROVISIONING=true
PROVISIONING_CONFIRMATION=I_UNDERSTAND_THIS_CHANGES_AWS
```

The frontend cannot enable live provisioning.

## AWS APIs Implemented

STS:

- `GetCallerIdentity`

IAM:

- `ListUsers`, `GetUser`
- `ListRoles`, `GetRole`
- `ListPolicies`, `GetPolicy`, `GetPolicyVersion`
- `ListAttachedUserPolicies`, `ListUserPolicies`
- `ListAttachedRolePolicies`, `ListRolePolicies`
- `ListEntitiesForPolicy`
- `SimulatePrincipalPolicy`, `SimulateCustomPolicy`
- `AttachUserPolicy`, `DetachUserPolicy`
- `AttachRolePolicy`, `DetachRolePolicy`
- `CreatePolicy`
- Access Analyzer `ValidatePolicy` where available

Resource discovery:

- S3 `ListBuckets`, `GetBucketLocation`
- RDS `DescribeDBInstances`, `DescribeDBClusters`
- Lambda `ListFunctions`

## Security Warnings

- Use a dedicated sandbox AWS account.
- Never use root credentials.
- Do not test against production.
- Start with simulation mode.
- Use temporary or restricted credentials.
- Do not put `.env`, `.aws/`, `credentials`, `config`, `.pem`, or access keys in the repository.
- `AdministratorAccess` provisioning is explicitly blocked.
- Inline policy replacement, trust-policy modification, access-key creation, permission-boundary removal, user deletion, role deletion, and policy deletion are not supported.

## Mock Mode

The app works immediately without AWS credentials. Mock mode includes 8 IAM users, 8 IAM roles, AWS-managed policies, customer-managed policies, S3 buckets, RDS databases, Lambda functions, existing policy assignments, sample requests, grants, and audit history. The UI clearly displays a mock/disconnected account rather than claiming live AWS connectivity.

## Temporary Access Expiry

Managed-policy attachments store grant metadata: request ID, target identity, policy ARN, attachment time, expiry time, provisioning response, revocation response, and revoked time. The backend includes `PermissionGrantExpiryService` for idempotently finding expired grants and detaching only the exact policy attachment created by a request.

No scheduler is currently wired to run automatically. Use the service as the integration point for EventBridge Scheduler with Lambda, a scheduled backend worker, or an existing job runner. The UI does not claim automatic expiry is operational unless that scheduler is connected and tested.
