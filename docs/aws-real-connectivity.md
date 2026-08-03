# PermissionHub real AWS connectivity

## Architecture

PermissionHub authenticates application users independently from AWS. Every AWS request is checked against the active tenant, membership, delegated OU/account scope, and selected account before the backend creates a client. `AwsConnectionBroker` uses the AWS SDK v3 default credential provider chain to assume a short-lived `PermissionHubReadRole`. An independently configured `PermissionHubProvisionRole` is used only for fully approved requests when all server feature flags permit it.

No long-term AWS key, temporary STS credential, external ID value, OIDC token, or secret is stored in the browser or PermissionHub relational data. External IDs are represented by secret references and resolved on the backend through AWS Secrets Manager. Development-only `env:VARIABLE_NAME` references are supported outside production.

## Backend principal and local profile

Create a restricted PermissionHub execution role in the account where the backend runs. It needs `sts:AssumeRole` only for explicitly onboarded target-role ARNs and `secretsmanager:GetSecretValue` only for the configured connection-secret prefix.

For local development, authenticate outside the app:

```bash
aws sso login --profile permissionhub-dev
aws sts get-caller-identity --profile permissionhub-dev
```

Set variables in an ignored local environment file or shell:

```text
AWS_PROFILE=permissionhub-dev
AWS_REGION=af-south-1
AWS_ORGANISATIONS_REGION=us-east-1
CROSS_ACCOUNT_PROVISIONING_ENABLED=false
```

Do not copy credentials into PermissionHub.

## Target-account deployment

Deploy `infrastructure/aws-onboarding/permissionhub-account-role.yaml` in each sandbox target account. Supply placeholders, never production values in source control:

```bash
aws cloudformation deploy \
  --profile target-sandbox \
  --stack-name permissionhub-account-roles \
  --template-file infrastructure/aws-onboarding/permissionhub-account-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    PermissionHubTrustedPrincipalArn=arn:aws:iam::<PERMISSIONHUB_ACCOUNT_ID>:role/<BACKEND_ROLE> \
    ExternalId='<GENERATED_UNIQUE_EXTERNAL_ID>' \
    EnableProvisioning=false
```

Generate each external ID with a cryptographically secure tool, store it in AWS Secrets Manager, and save only its ARN/reference in PermissionHub:

```bash
aws secretsmanager create-secret \
  --profile permissionhub-dev \
  --region af-south-1 \
  --name /permissionhub/connections/<TARGET_ACCOUNT_ID>/external-id \
  --secret-string '<GENERATED_UNIQUE_EXTERNAL_ID>'
```

The trust policy optionally enforces `sts:ExternalId` or `aws:PrincipalOrgID` and permits `sts:SetSourceIdentity` and restricted session tagging. CloudTrail records the stable internal actor/request reference without placing email addresses in session names.

## Permissions

The read role grants IAM identity/policy listing and inspection, IAM simulation, Access Analyzer policy validation, and the S3/RDS/Lambda discovery calls used by the application. These read/list operations require `Resource: *` because the relevant AWS APIs do not support resource-level scoping. It does not grant IAM mutation.

The provision role is optional and disabled by default. Its policy permits approved user/role managed-policy attachment changes and customer-managed policy version operations only under `policy/permissionhub/*` where AWS supports resource scoping. It does not grant `AdministratorAccess`, user/role deletion, access-key management, trust-policy changes, or permission-boundary removal.

## Organisation discovery

Configure an Organisation discovery account/role visible to the backend, set `AWS_ORGANISATIONS_DISCOVERY_ENABLED=true`, then use **Synchronise Organisation** on the Connection page. Discovery calls `DescribeOrganization`, paginated `ListRoots`, recursively paginated `ListOrganizationalUnitsForParent` and `ListAccountsForParent`, plus paginated `ListAccounts` reconciliation. Direct-account placement is never assumed to include child OUs.

Organisation APIs normally run in `us-east-1`. Delegated administration is preferred; PermissionHub does not need to run in the management account. The current synchronous endpoint returns after traversal and records start/completion/failure events. Move this service behind a durable job runner for very large Organisations.

## Standalone and customer accounts

In **Connection → Add AWS account**, enter the target account metadata and a Secrets Manager reference. PermissionHub generates read/provision role ARNs but never requests credentials. Deploy the template in the target account, validate the read connection, run capability tests, and inspect the sanitised result.

## Validation and live provisioning

```bash
npm run aws:whoami
npm run aws:validate-account -- --account-id <TARGET_ACCOUNT_ID>
```

Read validation assumes the read role, calls `GetCallerIdentity`, rejects an unexpected account or assumed-role ARN, and tests small IAM pages. Provision-role validation calls STS only and performs no mutation.

Real provisioning additionally requires an authorised PermissionHub provisioner, an approved non-expired request for the active account, a configured provision role, account-level provisioning enabled, and all existing live-provisioning guards:

```text
CROSS_ACCOUNT_PROVISIONING_ENABLED=true
PROVISIONING_MODE=LIVE
ENABLE_LIVE_PROVISIONING=true
PROVISIONING_CONFIRMATION=I_UNDERSTAND_THIS_CHANGES_AWS
```

Enable these only in a dedicated non-production sandbox after reviewing the exact request. Provision sessions are not cached across requests. Verify `AssumeRole`, IAM attachment, and revocation events in CloudTrail.

## Identity Center

`IDENTITY_CENTER_ENABLED=false` remains the default. The access-target provider abstraction is ready for future SSO Admin `ListInstances`, permission-set/account-assignment discovery, and Identity Store user/group resolution. It is not required for cross-account IAM discovery.

## Errors and troubleshooting

- `AccessDenied`: verify the backend principal, role trust, External ID, `sts:SetSourceIdentity`, and `sts:TagSession` permissions.
- `NoSuchEntity`: deploy the configured role name/path or set a full ARN override.
- Account mismatch: confirm the account record and role ARN target the same 12-digit account.
- Expired/invalid token: refresh the local SSO profile or workload credentials.
- Organisation API error: run discovery through the configured management/delegated role and check SCP restrictions.
- IAM capability failure after successful STS: update only the missing read permission; do not broaden the role to administrator.

Browser errors are sanitised. Server logs and audits must never contain tokens, credentials, secret values, or raw external IDs.

## Rollback

1. Disable the account connection in PermissionHub; this clears cached read sessions and blocks new operations.
2. Set all provisioning flags to false.
3. Revoke active PermissionHub grants through the approved workflow.
4. Delete the target CloudFormation stack only after confirming no active grants depend on it.
5. Disable or schedule deletion of the external-ID secret.
6. Roll back the `20260803170000_cross_account_connectivity` migration only after exporting connection metadata; it contains references and status only, never credentials.
