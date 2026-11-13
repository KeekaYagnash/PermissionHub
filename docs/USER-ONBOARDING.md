# Registration, organisations, invitations and optional federation

Implementation stays on `demo_ready_2`. No AWS resources, provider registrations,
emails or migrations were executed against AWS. No deployment/push/merge occurred.
Microsoft/Google sign-in is prepared, **not live-verified**.

## Audit findings and changes

Previously `/admin/users` pre-created users and ACTIVE memberships. New Cognito
subjects could claim those memberships solely by matching verified email. Native
registration unnecessarily collected a company before invitation acceptance;
password recovery lacked the final code/new-password step; Hosted UI login lacked
state/nonce checks and refresh did not work. Reusing a prior Cognito session during
subject changes could copy the previous identity's memberships before hydration.

Now registration creates only a subject-bound User/AuthIdentity. No membership
comes from Cognito groups, an email domain, frontend role fields or matching email.
Every request rebuilds Cognito identity from API Gateway's verified JWT and loads
current memberships/scopes from PostgreSQL. Profile names are persisted, not
overwritten on each login. New-account races resolve the same provider subject to
one user. Email conflicts require explicit linking, not automatic merging.

The deployed JWT trust boundary remains Cognito + API Gateway. A bare local
Express server does not treat arbitrary bearer text as a verified Cognito identity.
Local automated tests mock that gateway boundary explicitly, never skip tenant/RBAC
checks, and use a real disposable PostgreSQL database.

## Registration and profile

1. Choose email signup, or a configured federated provider.
2. Native signup collects full name/email/password, verifies the emailed Cognito
   code, then signs in. Existing unconfirmed signups can resend verification.
3. Federated users without a verified email must request/enter a Cognito email
   verification code. Entra email/UPN is never assumed verified.
4. Missing profile name routes to `/complete-profile`.
5. Pending invitation routes to `/accept-invitation`; otherwise create/select an
   organisation on `/select-tenant`. Existing users may create another organisation.
6. Organisation creation grants ORGANISATION_ADMIN only for that organisation.
   A deterministic owner/name key plus serializable transaction makes retries
   idempotent. Different owners with the same company name create separate tenants.
   Removed owners cannot restore their role by replaying organisation creation.

`/profile` edits the display name and starts explicit identity linking. Header
organisation selection retains authorised memberships and clears AWS account
context/cache on changes. AWS accounts/IAM principals remain managed targets,
not application login identities. Email/password auth uses the existing public
Cognito SDK flow; hosted/federated login uses authorization code + PKCE S256,
random state and nonce with a 10-minute single-use callback transaction.

Password recovery includes ForgotPassword + ConfirmForgotPassword. Concurrent
refresh requests are deduplicated. Tokens stay in sessionStorage (the existing
JWT SPA architecture), never localStorage; provider secrets never reach the SPA.
Logout records a PostgreSQL revocation cutoff, consumes outstanding link proofs,
globally signs out/revokes refresh credentials in Cognito and clears client caches.
The backend rejects old auth_time claims even when API Gateway's stateless JWT
authorizer would otherwise accept them. All sign-ins for this PermissionHub user
are invalidated. Network failures cannot guarantee remote revocation; local logout
still clears browser credentials. Session-check network errors offer Retry instead
of silently treating cached membership as authenticated.

## Invitations and membership administration

Administration → Users & roles supports invite, pending/expired status, resend,
revoke, member role changes and removal. PLATFORM_ADMIN is never assignable;
platform identities are protected from tenant-level edits. The last active
organisation administrator cannot be removed/demoted. Serializable transactions
protect concurrent administrator changes. All changes record transactional audit
events. Removal suspends membership and clears scopes/development role grants,
preserving identity and request history; it does NOT silently mutate AWS grants.
Revoke those separately through the approved AWS workflow when appropriate.

Invitations create NO user or membership before acceptance. They support both
unregistered and existing users. Proofs are 32 cryptographically random bytes;
only SHA-256 digests are stored. Links expire after 48 hours. Resend rotates the
proof and invalidates older links; revoke and acceptance invalidate it. Atomic
consumption and tenant/email checks prevent replay, cross-tenant changes and
double membership creation. Frontend-supplied user IDs/emails are not identity proof.
Acceptance uses only the gateway-verified Cognito email_verified/email claims.

Links use `/accept-invitation#token=...`: bearer proofs are not server URL query
parameters. The browser removes the fragment and temporarily retains the pending
proof through signup/verification/login. They must not be pasted into logs/issues.
Expired/revoked/used links show recovery instructions; ask the organisation admin
to resend. The HTTP acceptance endpoint never re-grants membership on replay.

`POST /admin/users` remains an adapter to invitation creation, not a direct-user
creation backdoor. New endpoints: `/admin/members`, `/admin/invitations`, resend/
revoke, and `/auth/invitations/inspect|accept`. These do not require an AWS account
to be connected. Administration is checked against current tenant membership in
the database, not a UI flag or user-supplied tenant ID.

## SES delivery

Configure an existing SES verified sender/domain per environment. Invitations use
the platform Lambda's default credential chain, NOT onboarded AWS account keys.
SDK retries are bounded by a 6-second deadline. Delivery state is persisted as
PENDING/SENT/FAILED; errors never masquerade as delivered local-log email. Failed
invitations remain visible and may be resent. Acceptance sends a confirmation;
failure is tracked as CONFIRMATION_FAILED and does not undo membership.

This implementation uses bounded synchronous delivery + visible persisted failure
and explicit resend, not a background email worker. An abrupt Lambda termination
can leave PENDING delivery; resend safely rotates the proof. Expiry is checked on
inspect/accept; there is no scheduled expiry-notification email worker.

SES verification, DKIM/DNS and production access are operator tasks. In the SES
sandbox, recipients generally must also be verified; verifying a sender alone is
not enough for arbitrary invitations. Request SES production access in the sending
region and observe sending quotas. Cognito account verification/password-reset
email remains managed by Cognito's default email configuration; its quotas are
separate. Custom Cognito SES sender configuration is not enabled by this change.

Terraform optional inputs (both roots):

```hcl
invitation_sender_email    = "access@YOUR_VERIFIED_DOMAIN"
invitation_ses_identity_arn = "arn:aws:ses:af-south-1:ACCOUNT_ID:identity/YOUR_VERIFIED_DOMAIN"
```

Runtime: INVITATION_EMAIL_MODE=ses, SES_FROM_EMAIL, SES_REGION. Without the ARN,
delivery is disabled and the UI reports that emails cannot be delivered. SES_REGION
is derived from the configured identity ARN; no email passwords/access keys exist.
The API execution role gets ses:SendEmail only for that configured identity.

**Independent IAM prerequisite:** the existing dev runtime boundary does not allow
SES. The operator must separately review/allow ses:SendEmail on the chosen verified
identity ARN in that boundary (and equivalent prod boundary if used), otherwise the
inline API role permission is insufficient. No bootstrap role/boundary was modified
by this work. Keep source-scoped permissions, not ses:* on all resources.

## Microsoft Entra registration — exact upstream configuration

Cognito compares an upstream ID token's issuer with the configured OIDC issuer.
Microsoft common/organizations metadata uses tenant-dependent issuers. A single
generic Cognito provider is therefore NOT claimed to securely accept arbitrary
Microsoft tenants. This implementation requires one explicitly onboarded
tenant-specific Cognito OIDC provider per Entra tenant. Additional tenants are
configuration entries, not email-domain membership rules.

Sources: [Cognito OIDC verification](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-oidc-flow.html),
[Microsoft tenant-independent issuer validation](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).

For each deployment environment:

1. Get `cognito_federation_redirect_uri` from Terraform output. It is
   `https://COGNITO_PREFIX.auth.REGION.amazoncognito.com/oauth2/idpresponse`.
   This is **not** the frontend `/auth/callback` URL.
2. Entra admin center → App registrations → New registration. Use an environment-
   specific name. Select **Accounts in any organizational directory** for a
   multitenant organisational application (not personal Microsoft accounts).
3. Authentication → add **Web** platform; register the EXACT Cognito URI above.
   Do not enable implicit grant, public-client flows or a SPA client secret.
   Cognito is the confidential upstream Web client; PermissionHub is its public SPA.
4. Record Application (client) ID and each explicitly supported Directory (tenant) ID.
   Create a client secret with an appropriate expiry. Store its VALUE in an existing
   Secrets Manager JSON secret `{"client_secret":"VALUE"}`; never in GitHub frontend
   variables or source. Track rotation/expiry.
5. Scopes: `openid email profile`. Do not add Directory.Read.All or application
   Graph permissions for login. Configure an `email` optional ID-token claim and
   populate each user's actual mailbox as required. An email claim is not guaranteed
   for all Entra users; do not substitute UPN as verified ownership.
6. In each onboarded tenant, obtain the necessary consent/service principal for
   the multitenant app, subject to that tenant's admin-consent policies.
7. Configure the explicit issuer `https://login.microsoftonline.com/TENANT_GUID/v2.0`.
   Never configure `/common` or `/organizations` as the generic issuer.
8. Terraform creates the OIDC provider, maps name/email, and adds it to the Cognito
   app client's supported providers. It deliberately does NOT map email_verified=true.
   The first sign-in verifies the mailbox through Cognito before enrollment.

Example reviewed root tfvars (replace every placeholder):

```hcl
microsoft_oidc_providers = {
  EntraExample = {
    tenant_id         = "REPLACE_WITH_DIRECTORY_TENANT_GUID"
    client_id         = "REPLACE_WITH_APPLICATION_CLIENT_ID"
    client_secret_arn = "REPLACE_WITH_EXISTING_SECRETS_MANAGER_ARN"
    label             = "Microsoft · Example company"
  }
}
```

Arbitrary Microsoft tenant discovery, personal Microsoft accounts and a generic
issuer-brokering service are deferred. Do not bypass issuer validation to enable them.

## Google OAuth registration — exact upstream configuration

1. Google Cloud Console → select/create an environment-specific project → Google
   Auth Platform/OAuth consent screen. Choose **External**, not Internal, to support
   personal Google accounts and multiple Workspace domains.
2. Configure app/support contact, authorised application domain and privacy/terms
   information as required. Add test users while in Testing; complete Google's
   publishing/verification requirements before allowing general registration.
3. Create an OAuth client of type **Web application**. Its authorised redirect URI
   is the SAME Cognito `.../oauth2/idpresponse` URI above, not the SPA callback.
4. Scopes: `openid email profile`. No hosted-domain (`hd`) restriction is configured;
   Workspace administrators can still enforce their own third-party-app policies.
5. Store `{"client_id":"GOOGLE_CLIENT_ID","client_secret":"GOOGLE_CLIENT_SECRET"}`
   in an existing environment-specific Secrets Manager secret.
6. Set `google_oauth_secret_arn` to its ARN. Terraform maps Google's email/name/
   email_verified claims and enables Google for the public Cognito app client.

[AWS Google federation instructions](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social-idp-google.html).

## Cognito callbacks, secrets and optional provider buttons

Provider inputs default to null/empty; Terraform deploys without any external
credentials. Existing native Cognito signup remains enabled. The Cognito SPA
client has no secret, enables token revocation, and permits authorization code,
openid/email/profile plus aws.cognito.signin.user.admin (self-service verification,
NOT PermissionHub administrator access). Current frontend URL is automatically
added as callback `/auth/callback` and logout `/login`; no destroyed endpoint is used.

Secrets Manager data sources read upstream credentials only when configured.
Terraform state/plan contains sensitive provider configuration: retain encrypted,
access-controlled state and encrypted CI plan artifacts. Frontend output contains
ONLY provider names/labels; the CI helper strips unexpected fields. Conditional
buttons use VITE_COGNITO_PROVIDERS, supplied from Terraform's cognito_providers
output through CI's COGNITO_PROVIDERS_JSON. No provider secret reaches JS assets.

Deployment-role prerequisites for OPTIONAL federation: scoped Secrets Manager
GetSecretValue (and KMS decrypt if CMK), Cognito Create/Describe/Update/DeleteIdentityProvider
and ListIdentityProviders, plus existing app-client update permissions. Provision
these through the independently managed deployment IAM process; do not attach
AdministratorAccess. Existing main/dev OIDC trust setup remains a separate task.

## Explicit account linking and recovery

Sign in with the ORIGINAL method → Profile → Link a configured provider (or
another Cognito sign-in) → confirm intent → authenticate the new method with the
SAME verified mailbox within 10 minutes. A hashed, expiring, single-use proof
binds both authentications. The second Cognito subject is added to the original
User; memberships are neither copied nor recreated. Existing bindings to another
user cannot be merged. Logout invalidates unused proofs. Replay/email mismatch/
expiry fail closed. The browser temporarily retains the linking proof in
sessionStorage to complete the redirect.

If a different profile already exists, the mailbox differs, or Cognito alias rules
prevent a second federated profile, stop and use a reviewed support recovery.
Verify control of BOTH original and proposed provider identities and the target
User before any audited administrative correction. Do not force aliases, email-link
accounts, or run AdminLinkProviderForUser based solely on email. No automatic
user merge, invitation-based claim of legacy unbound users, or unverified recovery
endpoint exists. These cases require manual review and are not claimed verified.

## Database and testing

Migration `20261106150000_organization_onboarding` adds OrganizationInvitation,
IdentityLinkChallenge, nullable Tenant.createdByUserId and User.sessionsRevokedAfter,
with unique proof/email indexes and foreign keys. Existing initial/historical SQL
is unchanged. Deploy only through the existing reviewed migration Lambda/CI flow.
Never db push/reset or migrate AWS directly during this implementation.

`test:migrations` now runs the complete nine-migration chain on a disposable local
PostgreSQL database, verifies zero drift/no-op repeat, and executes real DB/service/
HTTP onboarding tests. Cognito gateway claims and SES delivery are mocked; no AWS
calls or real users are created. Native/signup/reset/PKCE/nonce/refresh/logout,
conditional providers and invitation UI states have frontend tests. Terraform
uses mocked provider tests for disabled, Google/tenant-specific Entra and invalid
common-issuer configurations. Real Microsoft/Google browser login and SES delivery
require operator configuration and are NOT claimed tested.

### PowerShell verification commands — no deployment

```powershell
cd C:\Users\yagi1\OneDrive\Desktop\PermissionHub
git branch --show-current
npm ci
npm run prisma:generate --workspace backend
# Schema validation parses the URL but does not connect to this test database.
$previousDatabaseUrl=$env:DATABASE_URL
try {
 $env:DATABASE_URL='postgresql://validation@127.0.0.1:5432/permissionhub_migration_test_schema'
 npx prisma validate --schema backend/prisma/schema.prisma
 if ($LASTEXITCODE -ne 0) { throw 'Prisma schema validation failed' }
} finally { $env:DATABASE_URL=$previousDatabaseUrl }
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
terraform -chdir=infrastructure/terraform/modules/cognito init -backend=false
terraform -chdir=infrastructure/terraform/modules/cognito test
terraform -chdir=infrastructure/terraform/environments/prod test
```

Isolated PostgreSQL integration (Docker required; creates only a local test container):

```powershell
docker run --detach --name permissionhub-onboarding-test --publish 127.0.0.1:55439:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=permissionhub_migration_test_onboarding postgres:16
try {
 do { Start-Sleep -Seconds 1; docker exec permissionhub-onboarding-test pg_isready -U postgres | Out-Null } while ($LASTEXITCODE -ne 0)
 $env:MIGRATION_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/permissionhub_migration_test_onboarding'
 npm run test:migrations --workspace backend
 if ($LASTEXITCODE -ne 0) { throw 'Fresh migration/onboarding validation failed' }
} finally {
 Remove-Item Env:MIGRATION_TEST_DATABASE_URL -ErrorAction SilentlyContinue
 docker rm --force permissionhub-onboarding-test
}
```

Read-only checks AFTER a separately approved environment exists (no secret values):

```powershell
$root='infrastructure/terraform/environments/dev' # use prod for independent prod
$redirect=terraform "-chdir=$root" output -raw cognito_federation_redirect_uri
$redirect
$pool=terraform "-chdir=$root" output -raw cognito_user_pool_id
$client=terraform "-chdir=$root" output -raw cognito_app_client_id
aws cognito-idp describe-user-pool-client --region af-south-1 --user-pool-id $pool --client-id $client --query 'UserPoolClient.{Providers:SupportedIdentityProviders,Callbacks:CallbackURLs,Logout:LogoutURLs,Flows:AllowedOAuthFlows}'
aws cognito-idp list-identity-providers --region af-south-1 --user-pool-id $pool --query 'Providers[].{Name:ProviderName,Type:ProviderType}'
aws sesv2 get-account --region af-south-1 --query '{ProductionAccessEnabled:ProductionAccessEnabled,SendingEnabled:SendingEnabled}'
$senderDomain=Read-Host 'Configured SES verified sender domain'
aws sesv2 get-email-identity --region af-south-1 --email-identity $senderDomain --query '{Verified:VerifiedForSendingStatus,Dkim:DkimAttributes.Status}'
$tenant=Read-Host 'Explicitly configured Microsoft tenant GUID'
(Invoke-RestMethod "https://login.microsoftonline.com/$tenant/v2.0/.well-known/openid-configuration").issuer
$api=terraform "-chdir=$root" output -raw api_gateway_endpoint
Invoke-RestMethod "$api/health"
```

Those read-only commands do not prove live SSO/email. After approved setup, use
two real test inboxes to register/verify, create an organisation, invite/accept,
switch organisations, resend/revoke, check requester isolation and explicitly
link a provider. Never include bearer links, passwords, JWTs or provider secrets
in screenshots/logs. Do not test IAM mutations as part of onboarding verification.
