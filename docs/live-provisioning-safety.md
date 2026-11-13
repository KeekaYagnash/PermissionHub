# PermissionHub live provisioning safety

Live IAM changes remain disabled by default. Development login is separate from AWS identities, SSO remains disabled on this branch, and no AWS credential is accepted by the browser.

## Explicit development access

Grant only the roles required for one user and one AWS account:

```powershell
npm run dev:grant-request-access -- --user-email org.admin@disraptor.example --account-id 143671530412 --roles SECURITY_REVIEWER,PROVISIONER --confirm
```

Revoke the same grants:

```powershell
npm run dev:revoke-request-access -- --user-email org.admin@disraptor.example --account-id 143671530412 --roles SECURITY_REVIEWER,PROVISIONER --confirm
```

These commands refuse to run in production, resolve the user's tenant membership, scope grants to the single internal AWS account record, and write connection audit events. Sign out and back in after a grant change so the server-managed session reloads it. They never grant `PLATFORM_ADMIN`.

Self-approval remains blocked. `ALLOW_DEV_SELF_APPROVAL=true` is accepted only outside production and should be used solely in an isolated development workflow; using a separate requester and reviewer is safer.

## Provision role

Configure a separate `PermissionHubProvisionRole`, normally:

```text
arn:aws:iam::<account-number>:role/PermissionHubProvisionRole
```

Use **Validate provision role** on Connection. Validation assumes the provision role, calls STS `GetCallerIdentity`, and verifies both account number and assumed-role name. It performs no IAM mutation. Validation status and the sanitised last error are persisted separately from the read connection.

The role should use least privilege. Generated policies are constrained to `/permissionhub/` and tagged with `ManagedBy=PermissionHub` and the request ID. The current custom-policy plan can require `iam:CreatePolicy`, `iam:GetPolicy`, `iam:GetPolicyVersion`, `iam:TagPolicy`, `iam:ListAttachedUserPolicies` or `iam:ListAttachedRolePolicies`, and the relevant attach operation. Some IAM policy-management APIs require `Resource: "*"` while creating a policy because its ARN does not exist yet; constrain these with IAM paths, permission boundaries, approved targets, session tags, and organisation guardrails. Do not attach `AdministratorAccess`.

## Enabling live mode

All of these controls must pass:

```dotenv
AWS_PROVISIONING_MODE=live
ENABLE_LIVE_PROVISIONING=true
PROVISIONING_CONFIRMATION=I_UNDERSTAND_THIS_CHANGES_AWS
CROSS_ACCOUNT_PROVISIONING_ENABLED=true
AWS_LIVE_TEST_ALLOWED_PRINCIPALS=arn:aws:iam::123456789012:user/PermissionHub-Test-User
EXPIRY_REVOCATION_MODE=worker
```

The target account must also have provisioning enabled and its provision role must show `VALIDATED`. Temporary access in a `PRODUCTION` account is blocked unless `EXPIRY_REVOCATION_MODE=worker`; storing an expiry timestamp alone is not treated as automatic revocation.

## Human-run live test only

Do not automate this procedure.

1. Manually create a disposable IAM user with no console access and no policies; tag it `PermissionHubTest=true`.
2. Add only that ARN to `AWS_LIVE_TEST_ALLOWED_PRINCIPALS`.
3. Deploy the least-privilege read and provision roles and validate the provision role.
4. Grant a separate development reviewer account-scoped `SECURITY_REVIEWER` and `PROVISIONER` roles.
5. Restart the backend after setting live environment values.
6. Create a low-risk, temporary request targeting the disposable user.
7. Review the generated policy and exact `CreatePolicy -> AttachUserPolicy` plan.
8. Type the required `PROVISION <request-id>` phrase and accept both confirmations.
9. Verify the generated policy and attachment in IAM and CloudTrail.
10. Immediately test revoke and verify removal.
11. Delete the disposable user and generated test policy after validation.
12. Restore `AWS_PROVISIONING_MODE=dry-run` and `CROSS_ACCOUNT_PROVISIONING_ENABLED=false`.

Never use an arbitrary existing user, a production workload role, root credentials, or `AdministratorAccess` for this test.
