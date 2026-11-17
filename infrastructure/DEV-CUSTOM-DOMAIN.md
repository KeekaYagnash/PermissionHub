# Dev custom domain

Canonical website: `https://dev.iamops.disraptor.co.za`. Production is unchanged.
The existing CloudFront/S3 distribution is updated in place, not recreated. Its AWS hostname
remains available and registered in Cognito and API Gateway CORS. Dev frontend builds use the
existing same-origin callback/logout fallback on both origins to preserve PKCE sessionStorage.

## Credentials and prerequisites

- Existing active Cloudflare zone: `disraptor.co.za` (public DNS already delegates to Cloudflare).
- Existing secret **actual ARN**: `arn:aws:secretsmanager:af-south-1:143671530412:secret:Cloudflare/IAMOps-OHd0cA`.
  The supplied `...-0Hd0cA` ARN used zero and returned ResourceNotFound; AWS metadata confirms capital O.
- JSON keys `API_TOKEN` and `ACCOUNT_ID`. Neither value belongs in tfvars, Terraform data sources,
  plans, state, frontend variables or repository/GitHub variables. The account ID is used only
  in memory to verify zone ownership. Provider authentication uses `CLOUDFLARE_API_TOKEN`.
- Token permissions: **Zone / Zone / Read** and **Zone / DNS / Edit**, scoped only to
  `disraptor.co.za`. The helper checks the zone and advertised DNS edit permission using GETs;
  it does not test permission by creating a record.
- Independent bootstrap adds a dedicated `terraform-domain` policy to the existing dev Terraform
  role: exact-secret GetSecretValue and us-east-1 ACM certificate management. Runtime/backend/frontend
  roles receive no Cloudflare credentials or additional rights. If a customer-managed KMS key is later
  used for this secret, review a narrowly scoped kms:Decrypt grant and key policy separately.
- Custom-domain CAA restrictions, if any, must permit Amazon certificate issuance. Do not edit unrelated DNS.

## Resources and configuration

Dev root owns `aws_acm_certificate.frontend` (DNS validation, no wildcard, us-east-1),
`cloudflare_dns_record.frontend_validation["dev.iamops.disraptor.co.za"]`,
`aws_acm_certificate_validation.frontend`, and `cloudflare_dns_record.frontend` (CNAME to
the existing distribution, DNS-only). Keep validation DNS for renewal. Zone itself is not managed.
Shared hosting module inputs default to the previous AWS certificate/empty alias behavior for prod.

Canonical frontend output feeds deployment health checks and public configuration. Only in dev,
callback/logout build overrides are empty so the existing frontend chooses its current origin;
Cognito enforces the two registered exact origins. Production's fixed build URLs remain unchanged.
Dev Lambda FRONTEND_URL uses the canonical URL (invitations/notifications); Cognito and API Gateway
allow both canonical and AWS-hostname URLs plus existing configured exact localhost entries.
API Gateway owns deployed HTTP API CORS responses. No wildcard origins or backend auth changes.
No new GitHub variable is required. Existing CI_TF_VARS_JSON overrides still work; do not put credentials
there. If running frontend-only deployment with no public outputs, set development FRONTEND_URL to
`https://dev.iamops.disraptor.co.za` (existing variable name).

Staged dev deployment loads and masks credentials in each Terraform job after OIDC login.
The optional protected dev PR planner also loads them; its separately configured plan role needs
the same exact-secret read and ACM read permissions, **not** certificate-write permissions.
Do not enable protected PR plans for untrusted PR code just to test this feature.
TF_LOG/provider tracing must remain disabled. Terraform plans remain private under the existing workflow.

## Review/apply order (PowerShell; nothing here was applied by the implementation)

Use **64-bit Terraform** (Cloudflare v5 has no windows_386 binary). Run from repository root:

```powershell
terraform -chdir=infrastructure/terraform/bootstrap/github-dev init
terraform -chdir=infrastructure/terraform/bootstrap/github-dev plan '-out=domain-bootstrap.tfplan'
# AWS-changing: review, then explicitly apply the independent bootstrap policy change:
terraform -chdir=infrastructure/terraform/bootstrap/github-dev apply domain-bootstrap.tfplan

terraform -chdir=infrastructure/terraform/environments/dev init -reconfigure
Push-Location infrastructure/terraform/environments/dev
node ../../../scripts/dev-domain.mjs --check
node ../../../scripts/dev-domain.mjs --check-ownership
# Read-only/non-applying; use CI config so SES and the existing runtime boundary stay aligned.
node ../../../scripts/dev-domain.mjs --terraform plan -lock=false '-var-file=ci.tfvars.json' '-out=domain.tfplan'
Pop-Location
```

For the actual deployment, review and run the existing **PermissionHub infrastructure review**
workflow on branch `dev`, environment `dev`, first with `apply=false`, then explicitly with `apply=true`.
It runs the existing staged infrastructure/backend/frontend flow, injects provider credentials again
for apply and uses the same runner-local reviewed plan. No manual S3 upload/frontend command required.
Do not apply a saved plan from a different commit/run. Existing destruction/replacement guards remain active.

## Existing/manual resources

The helper aborts when website DNS or an exact-name ACM certificate exists outside dev state.
Do not use overwrite flags, untaint, state removal or certificate replacement to bypass ownership.
Confirm the resource belongs to this application and no other Terraform root manages it first.
If appropriate, add reviewed temporary Terraform **import blocks** (not duplicate resources):

```hcl
import {
  to = aws_acm_certificate.frontend
  id = "arn:aws:acm:us-east-1:143671530412:certificate/<existing-certificate-uuid>"
}
import {
  to = cloudflare_dns_record.frontend
  id = "<zone-id>/<existing-record-id>"
}
import {
  to = cloudflare_dns_record.frontend_validation["dev.iamops.disraptor.co.za"]
  id = "<zone-id>/<existing-validation-record-id>"
}
```

Review/import in a credentialed maintenance session before rerunning the pipeline ownership check.
Existing validation CNAMEs must also be checked/imported if a certificate already exists. Do not import
the zone itself or unrelated certificates. A reused certificate must cover exactly this hostname,
use DNS validation and be in us-east-1. If another app owns it, agree on ownership instead of importing it.

After deployment verify DNS, certificate ISSUED, CloudFront Deployed, sign-in/out, invitation links,
API CORS and the AWS hostname. Do not remove the old hostname while verifying:

```powershell
Resolve-DnsName dev.iamops.disraptor.co.za -Type CNAME
Invoke-WebRequest https://dev.iamops.disraptor.co.za/ -Method Head
aws cloudfront get-distribution --id E3QJ7P2MOBI5SR --query 'Distribution.{Status:Status,Aliases:DistributionConfig.Aliases,Certificate:DistributionConfig.ViewerCertificate}'
```

The existing dedicated destroy workflow intentionally retains its conservative resource guard;
review custom-domain DNS/certificate cleanup before any future full environment destruction.

## Implementation validation

Read-only checks found active Cloudflare zone/DNS edit permission, no website DNS record and no
exact-name ACM certificate. Current dev distribution is `E3QJ7P2MOBI5SR` / `d2xbbgyohbpz8s.cloudfront.net`.
IAM simulation of the existing Terraform role returned implicitDeny for the exact secret; apply the
reviewed independent bootstrap permission update first. The secret uses the default Secrets Manager KMS key.
A full non-applying dev plan with **deployed** Lambda artifact references preserved reported
**4 add, 7 update, 0 destroy**, with only certificate/DNS, CloudFront, Cognito, HTTP API CORS and
the four Lambda FRONTEND_URL variables changing. Local ignored `lambda-artifacts.auto.tfvars.json`
had stale migration artifact references: do not blindly apply a local plan that changes code artifacts.
The staged pipeline resolves immutable artifacts through its existing build process.
Provider credentials are not Terraform inputs or data sources; plan/state credential leakage was checked
locally without printing either value.

## Changed files

- `.github/workflows/deploy-dev-staged.yml`, `deploy-dev-frontend.yml`, `terraform-pr.yml`
- `infrastructure/scripts/dev-domain.mjs`, `dev-domain.test.mjs`, `ci-lib.mjs`
- `infrastructure/terraform/environments/dev/frontend-domain.tf`, `providers.tf`, `versions.tf`,
  `main.tf`, `outputs.tf`, `.terraform.lock.hcl`, `tests/ci-config.tftest.hcl`
- `infrastructure/terraform/modules/frontend_hosting/main.tf`, `variables.tf` (optional inputs;
  unchanged production defaults)
- `infrastructure/terraform/bootstrap/github-dev/main.tf`, `.terraform.lock.hcl`,
  `bootstrap.tftest.hcl`, `policies/terraform-domain.json.tftpl`
- `frontend/src/lib/cognito.test.ts` (same-origin callback regression test only)
- This deployment guide. Lockfile changes select Cloudflare and include the 64-bit Windows provider checksum.
