# IAMOps V1 flow repair

Implemented on `demo_ready_2`, without deploying, accessing live AWS credentials, sending email, migrating a live database, or pushing/merging.

## Reproduced causes

1. The existing-policy visual editor displayed actionable checkboxes but generated **no permission item** unless an attached source policy had also been selected. Continue therefore remained disabled even with selected actions. Its validation also used a separate custom-JSON state. The regression test reproduced this before the fix.
2. Role creation incorrectly lowered the unlocked wizard step to step 2 whenever the new role lacked an existing target object. The role permission generator also inherited a hidden seven-day user-access expiry despite submitting roles as Permanent.
3. The API's default production routing rejected every permanent request (`PERMANENT_NOT_ALLOWED`), including every role request because roles use Permanent duration.
4. Email invitation proofs survived authentication, but the organization page only inspected them. Acceptance was connected only to a separately fetched invitation-inbox item, leaving the actual retained email token without an acceptance action.

## Behavior now

- Visual actions are the source for both validation and the generated policy. Actions remain selected through Back/Next, Resources, Reason, Review and submission. Existing policy selection is optional reference context, never permission to edit/copy an AWS-managed policy. JSON editing remains supported; empty/malformed policy objects and conflicting fields block progress. Wildcard-resource analysis warnings are not structural errors. Current Access Analyzer ERROR findings block; warnings remain review information.
- Role requests do not acquire user-only expiry conditions. Non-service trust defaults to `Principal.AWS = "*"`, constrained with `StringEquals: aws:PrincipalAccount = <selected account>`. Missing account context prevents generation. Explicit services retain their service principal. Wildcard trust without the selected-account condition is rejected by the server at request creation and in the provisioning plan. AWS-principal trust adds security review based on the **actual trust document**, not the client label. Organization-wide wildcard defaults were not introduced.
- Production permanent requests require `permanentAccessAcknowledged: true`. The acknowledgement is persisted in the existing notes field. Production account approver/security/provisioner stages remain intact; the change is permission to **request**, not permission to grant. Other account-class permanent-access restrictions remain unchanged. Both the role reason step and review summary explain no automatic expiry.
- A retained email proof now opens an explicit confirmation and calls the existing authenticated `POST /auth/invitations/accept`. No GET, email match alone, or sign-in alone grants membership. Token hashing, recipient verified-email checks, profile completion, expiry/revocation/single-use protection, allowed roles and transactional membership creation are unchanged. On success, the returned session refreshes memberships and the existing organization selector; account-scoped caches are cleared. Failed acceptance retains the proof, confirmation and recovery message. Existing inbox acceptance and decline remain supported.
- Neutral surfaces, restrained borders, 8px panels, consistent field/action spacing, blue primary controls and responsive one-column form layouts follow the supplied design guidance. Semantic warnings/errors/success retain distinct colors and focus indicators remain visible. The complete original reference was moved from `frontend/public/minimalism-design.md` to `docs/design/minimalism-design.md`, not deleted. Disraptor favicon/assets remain unchanged.

## Safety and migrations

The selected account, tenant isolation, STS account checks, approval authorization, live provisioning flags, queue claims/idempotency, ownership-tag checks and persisted results remain in place. Existing mocked IAM user/role success/failure tests were retained. Neither Cloudflare nor deployment configuration was changed by this task. The IAM bootstrap identity-policy edit already present in the worktree was left untouched.

No Prisma schema change or new migration is needed: notes, role policy JSON and invitations already have durable fields. Inspected migration history includes the initial baseline and additive authentication/account/workflow changes. Existing controlled CI deploys the migration Lambda and runs its migration gate before dependent API/worker release. Prisma generation/schema validation passed. Docker's local Linux engine was unavailable, so empty-database migration execution was not repeated. Deployed `_prisma_migrations` status was not inspected or changed.

An authorized operator can use the existing migration Lambda's `{"action":"status"}` payload for a read-only deployed status check; see `request-workflow-repair.md`. An invocation status alone is not proof that its returned `ok/upToDate` fields are true.

## Verification and remaining steps

Focused tests cover visual-editor reproduction through submission, Back/Next preservation, managed/custom/existing-policy routes, account-scoped trust generation/rejection, production acknowledgement/approval routing, invitation registration/sign-in through both retained proof and inbox, wrong-email/expired/revoked/used failures, single-use membership transactions and selector refresh. AWS SDK and mail delivery are mocked.

Final results: frontend 230 tests / 43 files, backend 256 tests / 33 files passed. Both typechecks and production builds passed; lint has no errors and the same two pre-existing unused-symbol warnings. Prisma generation/schema validation passed. All four Lambda package handler exports and size checks passed; no artifacts were uploaded. Full deployed Cognito/SES/STS/IAM and visual browser verification were not performed, so these results do not establish live end-to-end success.

After review, deploy frontend and backend/worker together through the existing pipeline; no special schema migration is introduced. Verify the real identity-provider redirect and organization join in a controlled account. Live IAM verification belongs in an explicitly authorized disposable AWS test environment. The pre-existing expiry Lambda remains a placeholder; automatic expiry must not be assumed operational. Uncertain worker completion after a crash/database outage still requires reconciliation rather than blindly repeating IAM writes.

Local checks:

```powershell
npm run prisma:generate --workspace backend
npm run lint
npm run typecheck --workspace frontend
npm run typecheck --workspace backend
npm test --workspace frontend
npm test --workspace backend
npm run build --workspace frontend
npm run build --workspace backend
npm run build:lambda --workspace backend
npm run package:lambda --workspace backend
```
