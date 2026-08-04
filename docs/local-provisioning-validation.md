# Local provisioning validation

PermissionHub has a narrowly scoped development-only mode for validating the `CreatePolicy` and `AttachUserPolicy`/`AttachRolePolicy` flow with the backend's currently connected AWS credentials.

## Safety boundary

The override is enabled only when both values are present:

```dotenv
NODE_ENV=development
ALLOW_LOCAL_PROVISIONING=true
```

The backend refuses to start in production if `ALLOW_LOCAL_PROVISIONING=true`. When the flag is absent or false, the enterprise approval, account-scoped Provisioner, provision-role, expiry-worker, and provisioning-mode checks remain unchanged.

Local mode still requires:

- an authenticated PermissionHub Security Reviewer with access to the selected account;
- a connected account whose STS identity matches the configured 12-digit account number;
- a valid target IAM user or role in that account;
- a complete and valid generated policy document or an existing managed policy;
- a target permitted by `AWS_LIVE_TEST_ALLOWED_PRINCIPALS` when that allowlist is configured;
- the exact `PROVISION <request-id>` confirmation and both safety acknowledgements;
- an explicit **Approve and provision locally** action from the request review page.

The standalone provision endpoint is blocked in local mode so it cannot bypass review confirmation. Local mode permits policy creation and attachment only; it does not enable detachment or automatic expiry cleanup.

## Recommended local validation

Use a disposable IAM user or role in a dedicated sandbox account. Configure `AWS_LIVE_TEST_ALLOWED_PRINCIPALS` to that exact ARN, restart the backend, validate the Connection page, sign in as the seeded Security Reviewer, and review the exact policy and operations before confirming.

After validation, remove the created attachment and policy manually through a controlled AWS administrator workflow, inspect CloudTrail, set `ALLOW_LOCAL_PROVISIONING=false`, and restart the backend.

Automated tests mock the AWS service boundary and never call mutating IAM APIs.
