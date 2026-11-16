# PermissionHub transactional email

## Current no-reply sender decision

- Application default: **no-reply@disraptor.co.za**. This is a configuration default, **not evidence that SES authorizes it**.
- The supplied identity evidence covers the individual `info@disraptor.co.za` address and the `disraptor-internal.net` domain. An individual email identity cannot authorize another mailbox. The repository does not prove that the `disraptor.co.za` domain is verified.
- Consequently the reviewed dev configuration explicitly selects **no-reply@disraptor-internal.net** and the existing `disraptor-internal.net` domain identity. This is the requested configurable alternative, not a new domain or a silent runtime fallback. No failed send is retried with another From address.
- `SES_IDENTITY_ARN` records the configured identity. Runtime checks and an API-policy Terraform precondition reject sender/identity/region mismatches before delivery. These checks establish configuration compatibility only; SES remains authoritative for verification, sending status and sandbox restrictions.
- The earlier user-supplied IAM simulation returned `implicitDeny` / `BoundaryAllowed=false`. That proves a boundary denial at that time, not that it has since been corrected. Repository runtime logs are from August 2026 and contain no current SES failure codes. No live AWS credentials, logs or account inspection were used during this no-reply repair.

To use the primary address, an authorized operator must first confirm the **already existing** `disraptor.co.za` domain has `IdentityType=DOMAIN` and `VerifiedForSendingStatus=true` in us-east-1, and that the API role and its boundary permit it. If it is absent/unverified, use the internal-domain alternative. Do not create another identity or request DNS changes as part of this change.

The independent bootstrap has `allow_existing_disraptor_co_za_ses_domain=false` by default. Set it to true only after that existing-domain verification is established and the IAM change is separately approved. It adds only the existing domain ARN and the exact `no-reply@disraptor.co.za` sender to the permission policy; it never creates/verifies a domain. Default grants still cover only the previously supplied identities. Application IAM/SES changes have not been applied.

## Earlier delivery blockers

Two repository configuration gaps were found after the first email release:

- The reviewed dev `ci.tfvars.json` originally omitted the SES identity ARN, so deployments using it disabled email and omitted the API role's SES allow statement. It now selects the existing internal-domain identity and no-reply mailbox in us-east-1.
- The independent runtime boundary omitted SES. A role's `ses:SendEmail` policy cannot exceed that boundary. By default the boundary now allows only `ses:SendEmail` on the two previously supplied us-east-1 identities, with a sender-address restriction. CI identity/runtime-role protections remain unchanged.

These are confirmed repository defects, not a claim that live CloudWatch logs or deployed policies have been inspected. No live AWS access or email send was used to investigate. SES sandbox/network/account issues still require live verification if delivery fails after configuration is corrected.

Any required boundary update belongs to the **existing independent bootstrap state** and an authorized bootstrap operator. App deployment roles intentionally cannot modify their own runtime boundary. Do not create new bootstrap state or recreate the application. Neither a boundary update nor deployment was executed in this pass. No frontend update or new database migration is needed for this sender repair; the previous email outbox migration is still required for request notifications.

If the GitHub `development` Environment supplies **CI_TF_VARS_JSON**, it overrides the checked-in fallback. Add these two fields to that JSON as well; an explicit null still means intentionally disabled:

```json
"invitation_ses_identity_arn": "arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net",
"invitation_sender_email": "no-reply@disraptor-internal.net"
```

### Read-only deployed check (operator command; no email sent)

```powershell
aws lambda get-function-configuration --function-name permissionhub-dev-api --region af-south-1 --query '{Role:Role,EmailMode:Environment.Variables.INVITATION_EMAIL_MODE,Notifications:Environment.Variables.NOTIFICATION_EMAIL_MODE,Sender:Environment.Variables.SES_FROM_EMAIL,SESRegion:Environment.Variables.SES_REGION,Identity:Environment.Variables.SES_IDENTITY_ARN}' --no-cli-pager
```

For the reviewed dev alternative, the result should show `ses`, `no-reply@disraptor-internal.net`, `us-east-1`, and the internal-domain identity ARN. Never dump all environment variables, app secrets or credentials. Invitation failures show a safe error code/message in the existing UI and log `INVITATION_EMAIL_DELIVERY_FAILED` with the AWS request ID when available. Request failures log the same sanitized cause alongside their receipt ID. No raw SDK error message, recipient address, message body, invitation proof or credentials are logged. Distinguish `EMAIL_SENDER_IDENTITY_MISMATCH`, `EMAIL_DISABLED`, `EMAIL_ACCESS_DENIED`/`EMAIL_BOUNDARY_DENIED`, `EMAIL_IDENTITY_NOT_VERIFIED`, `EMAIL_TIMEOUT` and `EMAIL_STORAGE_UNAVAILABLE` before changing more configuration.

## Scope and security

Emails cover organization invitations, submitted requests/current approval stages, **completed** approval, rejection (with the saved reason), confirmed `Provisioned` state, and `Provisioning failed` state. Draft creation, simulation and dry-run provisioning do not generate access-granted emails. Intermediate approvals notify the next eligible reviewers, not a premature final-approval email to the requester. Invitation acceptance confirmations remain supported.

Request emails contain the organization, request reference, status and a review link. They do not contain credentials, policy documents, resource lists, justification, raw AWS errors or API responses. Rejection reasons are escaped and limited to 1,000 characters. Treat decision comments as information that will be shared with the requester. Logs contain event/receipt identifiers, never addresses, message content or invitation proofs.

Email is **not** an authorization channel. The CTA opens the existing `/requests/:id` page, never an approval/denial GET endpoint. Users must sign in, select the correct organization/account and explicitly review through the existing protected POST routes. If login redirects to the overview, reopen the email link after signing in. No new review tokens, approval endpoints, bypasses or authentication settings are introduced. An old review link conveys no privilege: current backend authorization, assignment, state and approval checks still apply.

Invitations retain the existing `/accept-invitation#token=...` flow: sign up/sign in with the invited email, verify it, then explicitly accept. Proofs remain single-use, expire after 48 hours, are stored only as SHA-256 digests, and are rotated on intentional resend. HTML and plain text both include the acceptance link; no raw invitation proof is stored in the notification outbox or logged.

## SES sender and deployment configuration

All email clients use **us-east-1**, independently of `APP_AWS_REGION` / the application's general AWS region. `SES_REGION=us-east-1` is retained as the documented compatibility setting; the client enforces us-east-1 even if a stale environment supplies a different value. No SES identity is created or verified by the code.

Use only identities that an authorized operator confirms already exist and are verified:

| Sender | Matching SES identity (account 143671530412, us-east-1) | Available evidence |
| --- | --- | --- |
| `no-reply@disraptor.co.za` (application default) | `identity/disraptor.co.za` | Domain verification NOT established; operator must confirm before selecting it. |
| `no-reply@disraptor-internal.net` (reviewed dev override) | `identity/disraptor-internal.net` | Previously supplied as verified; current account status still needs operator verification. |
| `info@disraptor.co.za` (legacy compatibility only) | `identity/info@disraptor.co.za` | Previously supplied individual email identity; does NOT authorize no-reply. |

The sender and identity ARN must match. A policy for `identity/info@disraptor.co.za` cannot authorize `no-reply@disraptor.co.za`, and a policy scoped to `disraptor-internal.net` cannot authorize a `.co.za` sender. Unverified contact identities are not supported. Do not request DNS changes or a new domain. Previously configured verified senders remain supported to avoid breaking existing deployments.

Backend settings:

```dotenv
SES_REGION=us-east-1
SES_FROM_EMAIL=no-reply@disraptor-internal.net
SES_IDENTITY_ARN=arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net
INVITATION_EMAIL_MODE=ses
NOTIFICATION_EMAIL_MODE=ses
FRONTEND_URL=https://YOUR_EXISTING_FRONTEND_HOST
```

Use `disabled` for both modes in local development unless deliberately sending. If `NOTIFICATION_EMAIL_MODE` is omitted, it follows `INVITATION_EMAIL_MODE` for compatibility. Automated request-notification tests disable the default dispatcher; focused tests inject mocked delivery. No credentials belong in these settings.

The existing dev/prod Terraform roots retain their variable names:

```hcl
invitation_ses_identity_arn = "arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net"
invitation_sender_email    = "no-reply@disraptor-internal.net"
```

A null identity ARN leaves email disabled. A configured identity enables invitation/request email in Lambda environment settings. The existing API Lambda policy already grants `ses:SendEmail` against that identity ARN. No SES domain, DNS record, queue, CI workflow or new AWS resource is added. No application region change is required.

The platform API execution role, **not the selected customer's access keys or assumed provision role**, must have:

```json
{
  "Effect": "Allow",
  "Action": "ses:SendEmail",
  "Resource": "arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net",
  "Condition": {"StringEquals": {"ses:FromAddress": "no-reply@disraptor-internal.net"}}
}
```

Terraform enforces this sender condition, scopes the action to the configured identity ARN, and rejects mismatched identity/sender pairs. The runtime validates `SES_IDENTITY_ARN` when supplied, without querying AWS or claiming the identity is verified. Legacy environments without that optional variable retain SES-side enforcement. The retry process needs the same platform permission and database access. API Lambda needs HTTPS egress to SES in us-east-1: application-region VPC endpoints alone do not provide cross-region SES connectivity. Existing SES sandbox restrictions, sending quotas, account suppression and identity verification still apply. Actual delivery/inbox placement is not verified by local tests.

### Read-only operator verification (not executed during implementation)

```powershell
aws sesv2 get-email-identity --region us-east-1 --email-identity disraptor-internal.net --query '{Type:IdentityType,VerifiedForSending:VerifiedForSendingStatus}' --no-cli-pager
aws sesv2 get-email-identity --region us-east-1 --email-identity disraptor.co.za --query '{Type:IdentityType,VerifiedForSending:VerifiedForSendingStatus}' --no-cli-pager
aws sesv2 get-account --region us-east-1 --query '{ProductionAccessEnabled:ProductionAccessEnabled,SendingEnabled:SendingEnabled,SendQuota:SendQuota}' --no-cli-pager
```

For the reviewed internal-domain sender, verify the execution role with the **domain** ARN and actual no-reply From address, not the old info@ email ARN:

```powershell
$apiRoleArn = aws lambda get-function-configuration --function-name permissionhub-dev-api --region af-south-1 --query Role --output text
aws iam simulate-principal-policy --policy-source-arn $apiRoleArn --action-names ses:SendEmail --resource-arns "arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net" --context-entries "ContextKeyName=ses:FromAddress,ContextKeyValues=no-reply@disraptor-internal.net,ContextKeyType=string" --query 'EvaluationResults[].{Decision:EvalDecision,BoundaryAllowed:PermissionsBoundaryDecisionDetail.AllowedByPermissionsBoundary,MissingContext:MissingContextValues}' --no-cli-pager
```

For an independently confirmed `.co.za` domain, use its domain ARN and `no-reply@disraptor.co.za` context instead. An allowed policy simulation is useful but does not prove SES verification/sandbox readiness, network connectivity, or all organization-level restrictions.

The runtime does not require SES identity-inspection permissions. Those commands require separate operator read permissions; none sends mail or verifies/creates identities. A missing or false-verified `.co.za` result is a blocker for its no-reply sender. Sandbox status is regional; verified sender domains alone do not allow unverified recipients while sandboxed. An authorized operator must assess production access for organization invitations; do not work around it by verifying unrelated contacts. Current identity verification, sandbox status, recipient suppression, quotas, effective Lambda role/boundary/SCP permissions, credential availability and network egress cannot be established from this repository.

References: [SES identity verification](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html), [SES sandbox restrictions](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## Recipient isolation

Active users and memberships are queried by the request's **tenant ID**, with active tenant/user status. The existing account-scope and approval authorization engine selects the current stage's eligible approvers, honors an explicitly assigned approver, excludes unauthorized/self approvers according to existing rules, and supports scoped administrators only when they can actually approve that request. There is no global administrator fallback. Missing eligible recipients generate a metadata-only warning.

Decision/provisioning recipients are the recorded requester user ID, only if still an active authorized member of the request's organization/account. Email addresses are resolved from current users, not supplied by a request payload. Recipient selection is repeated before delivery/retry; removed users and stale reviewer assignments are cancelled. Non-manual accounts require an existing loaded authorization context; the notification service fails closed instead of reclassifying an account or inventing scope.

## Persistence, retries and operational limits

Migration `20261115120000_transactional_notifications` adds only `EmailNotification` with request/user foreign keys, tenant/request indexes and a due-delivery index. It stores a minimal event snapshot, IDs, delivery status, attempts and SES MessageId—not recipient addresses, credentials, policy content or invitation proofs. Existing migrations and request history are unchanged.

Notifications are observed **after successful request persistence**, not from frontend clicks. Keys include tenant, request, event, recipient and approval stage/provision attempt. Known-sent receipts survive Lambda cold starts and suppress repeated saves/workflow retries. Conditional database claims prevent concurrent workers from sending the same claim; expired one-minute leases are recoverable. SES SDK retries are bounded (three attempts inside a six-second overall deadline), with two concurrent deliveries maximum. Failed receipts have exponential backoff, starting at one minute, and stop after five claims.

Each request save attempts at most two queued deliveries to bound API latency. Further recipients/failed deliveries remain durable. Subsequent saves of that request can drain due receipts. **There is no new automatic scheduler in this change.** An operator or an approved existing scheduler must run the retry entry point for unattended backlog recovery. Do not assume SQS provisioning messages handle email: the current provisioning queue handler is unrelated.

After reviewing configuration, this command **sends real email** using platform credentials and drains up to 100 due deliveries; it was not run during implementation:

```powershell
npm run notifications:retry --workspace backend
```

Invitation failures continue to return `deliveryStatus=FAILED` and use the existing administrator resend action (which deliberately rotates the proof). Invitation/confirmation metadata failures cannot undo an already committed invitation or organization membership.

All notification errors fail open for the business operation. A missing outbox migration, failed recipient lookup or queue insert is logged without undoing a saved request. Because enqueue is post-commit, a process failure between saving a request and inserting its receipts can miss an email; repair/re-drive that request after correcting the cause. This is not a fully atomic transactional-outbox guarantee. Also, SES offers no exactly-once send key: if SES accepts a message but the response/receipt write is lost, a lease retry can duplicate that message. Known successful receipts are never deliberately resent.

## Release, validation and rollback

1. Review the additive migration and initialize it through the existing approved migration mechanism **before enabling notification modes**. No migrations against AWS were executed for this change.
2. Set the existing sender/identity variables and ensure platform IAM/egress/sandbox readiness. Deploy through the existing process when authorized; CI triggers/order are unchanged.
3. Configure an approved periodic retry invocation if unattended retries/backlog delivery are required.
4. Separately authorize a real delivery smoke test; none was sent during implementation.

Safe local checks:

```powershell
npm run prisma:generate --workspace backend
npm run typecheck --workspace backend
npm test --workspace backend
npm run build --workspace backend
npm run build:lambda --workspace backend
```

Rollback: set `NOTIFICATION_EMAIL_MODE=disabled` to stop request notifications; separately disable invitation email only if intended. Roll back application code via the normal process, retaining the additive table/delivery history. Do not delete request history or restore an old database. Do not use `db push --accept-data-loss`.
