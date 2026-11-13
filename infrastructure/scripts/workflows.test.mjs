import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../../.github/workflows/${name}`,import.meta.url),'utf8');

test('Cognito recovery is explicitly dispatched and cannot deploy or weaken replacement guards',()=>{
 const deploy=read('deploy.yml'),recover=read('recover-dev-cognito.yml');
 assert.match(deploy,/recover_cognito_domain:[\s\S]*?default: false/);
 assert.match(deploy,/github.event_name == 'workflow_dispatch' && inputs.recover_cognito_domain && inputs.environment == 'dev'/);
 assert.match(deploy,/changes:\s*\n\s*if: \$\{\{ !inputs.recover_cognito_domain \}\}/);
 assert.match(recover,/RECOVER DEV COGNITO DOMAIN/);
 assert.match(recover,/test "\$GITHUB_REF" = refs\/heads\/dev/);
 assert.doesNotMatch(recover,/terraform apply|terraform destroy|force-unlock|lock=false/);
 const cli=readFileSync(new URL('./ci.mjs',import.meta.url),'utf8');
 assert.match(cli,/versioning.Status!=='Enabled'/);
 assert.match(cli,/\['untaint','-lock-timeout=5m',cognitoDomainAddress\]/);
});

test('dev applies same-runner plans before packaging and never needs cross-job plan encryption',()=>{
 const deploy=read('deploy.yml'),staged=read('deploy-dev-staged.yml');
 assert.match(deploy,/backend-dev:[\s\S]*uses: \.\/\.github\/workflows\/deploy-dev-staged.yml/);
 assert.match(staged,/backend:[\s\S]*needs: infrastructure/);
 assert.ok(staged.indexOf('foundation.tfplan"')<staged.indexOf('npm run build:lambda'));
 assert.ok(staged.indexOf('Initialize or upgrade database before API release')<staged.indexOf('Plan and apply Lambda, API and remaining infrastructure'));
 assert.doesNotMatch(staged,/seal-plan|open-plan|TF_PLAN_ENCRYPTION_KEY|upload-artifact/);
 assert.match(staged,/terraform apply .*"\$RUNNER_TEMP\/foundation.tfplan"/);
 assert.match(staged,/terraform apply .*"\$RUNNER_TEMP\/backend.tfplan"/);
 assert.match(read('terraform-pr.yml'),/if: \$\{\{ !inputs.defer_lambda_packaging \}\}/);
 const cli=readFileSync(new URL('./ci.mjs',import.meta.url),'utf8');
 assert.match(cli,/if\(process.env.DEPLOY_ENV!=='dev'\)try\{validatePlanEncryptionKey/);
});

test('deployment checks environment secrets before build, upload or plan',()=>{
 const deploy=read('deploy.yml'),preflight=read('deployment-preflight.yml');
 assert.match(deploy,/validation:\s*\n\s*needs: \[changes, preflight\]/);
 assert.match(preflight,/secrets.TF_PLAN_ENCRYPTION_KEY/);
 assert.match(preflight,/node infrastructure\/scripts\/ci.mjs preflight/);
 assert.doesNotMatch(preflight,/id-token: write|configure-aws-credentials|aws sts|terraform apply/);
 assert.doesNotMatch(read('terraform-pr.yml'),/secrets.TF_PLAN_ENCRYPTION_KEY/);
 const script=readFileSync(new URL('./set-plan-encryption-key.ps1',import.meta.url),'utf8');
 assert.match(script,/RandomNumberGenerator/);
 assert.match(script,/gh secret set TF_PLAN_ENCRYPTION_KEY/);
 assert.doesNotMatch(script,/Write-Host.*\$encoded|Write-Output.*\$encoded|Set-Content/);
});

test('configuration is validated in prepare before any artifact upload and in PR checks',()=>{
 const backend=read('deploy-dev-backend.yml');
 assert.ok(backend.indexOf('Validate deployment configuration before uploading artifacts')<backend.indexOf('Upload only changed artifacts'));
 const cli=readFileSync(new URL('./ci.mjs',import.meta.url),'utf8');
 assert.match(cli,/ci.tfvars.json/);
 assert.doesNotMatch(cli,/JSON.parse\(process.env.CI_TF_VARS_JSON/);
 assert.match(read('terraform-pr.yml'),/environments\/dev test -var-file=ci.tfvars.json/);
});

test('same-commit migration validation unblocks dev prepare without manual readiness variable',()=>{
 const validation=read('terraform-pr.yml'),backend=read('deploy-dev-backend.yml');
 assert.match(validation,/migrations_validated:[\s\S]*jobs.validate.outputs.migrations_validated/);
 assert.ok(validation.indexOf('npm run test:migrations')<validation.indexOf('Backend prepare pre-merge checks'));
 assert.ok(validation.indexOf('npm run package:lambda')<validation.indexOf('Backend prepare pre-merge checks'));
 assert.match(validation,/node infrastructure\/scripts\/ci.mjs prepare-check/);
 assert.match(read('deploy.yml'),/migrations_validated: \$\{\{ needs.validation.outputs.migrations_validated == 'true' \}\}/);
 const settings=backend.split('\n').filter(line=>line.includes('vars.CI_MIGRATIONS_READY'));
 assert.equal(settings.length,4);
 for(const line of settings)assert.match(line,/vars.CI_MIGRATIONS_READY \|\| \(inputs.environment == 'dev' && inputs.migrations_validated && 'true' \|\| 'false'\)/);
});

test('detected initial dev deployment propagates through infrastructure, migrations and frontend',()=>{
 const backend=read('deploy-dev-backend.yml');
 assert.match(backend,/AUTO_BOOTSTRAP_DEV: \$\{\{ inputs.environment == 'dev' && 'true' \|\| 'false' \}\}/);
 assert.match(backend,/fresh_deployment: \$\{\{ steps.references.outputs.fresh_deployment \}\}/);
 assert.match(backend,/inputs.apply && needs.prepare.outputs.fresh_deployment != 'true'/);
 assert.match(backend,/PLAN_MODE:.*needs.prepare.outputs.fresh_deployment == 'true'/);
 assert.match(backend,/role-to-assume:.*inputs.infrastructure \|\| needs.prepare.outputs.fresh_deployment == 'true'/);
 assert.match(backend,/needs: \[plan, prepare\]/);
 assert.match(backend,/Initialize a fresh database only after infrastructure exists\s*\n\s*if: needs.prepare.outputs.fresh_deployment == 'true'/);
 assert.match(read('deploy.yml'),/needs.backend-dev.result == 'success'/);
 const cli=readFileSync(new URL('./ci.mjs',import.meta.url),'utf8');
 assert.ok(cli.indexOf('Initial deployment needs CI_MIGRATIONS_READY')<cli.indexOf("artifactReferences(state,manifest"));
});

test('backend init defaults match dev Terraform and step overrides cannot erase them',()=>{
 const code=read('deploy-dev-backend.yml');
 const expected={TF_STATE_BUCKET:'permissionhub-dev-bucket',TF_STATE_KEY:'permisionhub/dev/backend',TF_LOCK_TABLE:'permissionhub-state-lock',AWS_ACCOUNT_ID:'143671530412',LAMBDA_ARTIFACT_BUCKET:'permissionhub-dev-lambda-artifacts'};
 for(const [key,value] of Object.entries(expected)){
  const bindings=code.split('\n').filter(line=>line.includes(`vars.${key}`));
  assert.ok(bindings.length>0);
  for(const line of bindings)assert.ok(line.includes(`vars.${key} || (inputs.environment == 'dev' && '${value}' || `),`Missing guarded dev default: ${line}`);
 }
 assert.equal((code.match(/ci\.mjs" backend-config/g)||[]).length,5);
 assert.doesNotMatch(code,/test -n "\$STATE_BUCKET" &&/);
 const terraform=readFileSync(new URL('../terraform/environments/dev/versions.tf',import.meta.url),'utf8');
 for(const key of ['TF_STATE_BUCKET','TF_STATE_KEY','TF_LOCK_TABLE'])assert.ok(terraform.includes(`"${expected[key]}"`));
 assert.match(code,/inputs.environment == 'prod' && 'permisionhub\/prod\/backend'/);
});

test('OIDC diagnostics cannot deploy, assume a role, or execute PR repository code',()=>{
 const diagnostic=read('diagnose-oidc.yml');
 assert.match(diagnostic,/pull_request:\s*\n\s*branches: \[dev\]/);
 assert.doesNotMatch(diagnostic,/pull_request_target:|actions\/checkout|configure-aws-credentials|uses:|secrets\.|terraform apply|aws sts/);
 assert.match(diagnostic,/head\.repo\.full_name == github\.repository/);
 assert.match(diagnostic,/workflow_dispatch' && github.ref == 'refs\/heads\/dev'/);
 assert.match(diagnostic,/const keys=\['iss','aud','sub'/);
 assert.match(diagnostic,/::add-mask::/);
 assert.doesNotMatch(diagnostic,/console\.log\(payload|JSON\.stringify\(payload/);
});

test('dev deployment uses supplied OIDC role ARNs without a production or PR fallback',()=>{
 for(const file of ['deploy-dev-backend.yml','deploy-dev-frontend.yml','verify-aws-oidc.yml','destroy-infrastructure.yml']){
  const code=read(file);
  const fallbacks=[...code.matchAll(/inputs.environment == 'dev' && '(arn:aws:iam::143671530412:role\/permissionhub-github-(terraform|backend|frontend)-dev)' \|\| ''/g)];
  assert.ok(fallbacks.length>0,`${file} must include dev-only OIDC defaults`);
  for(const line of code.split('\n').filter(line=>/vars\.AWS_\w+_ROLE_ARN/.test(line))){
   assert.match(line,/vars\.AWS_\w+_ROLE_ARN \|\| \(inputs.environment == 'dev'/);
  }
 }
 assert.doesNotMatch(read('terraform-pr.yml'),/permissionhub-github-(terraform|backend|frontend)-dev/);
 const deploy=read('deploy.yml');
 assert.match(deploy,/backend:\s*\n\s*needs: \[changes, validation\]/);
 assert.match(deploy,/frontend:\s*\n\s*needs: \[changes, validation, backend, backend-dev\]/);
});
test('missing OIDC roles fail explicitly and static credentials are never configured',()=>{
 const action=readFileSync(new URL('../../.github/actions/aws-oidc/action.yml',import.meta.url),'utf8');
 assert.match(action,/Missing\/invalid OIDC role ARN/);
 assert.match(action,/unset-current-credentials: true/);
 assert.doesNotMatch(action,/aws-access-key-id:|aws-secret-access-key:/);
 for(const file of ['deploy-dev-backend.yml','deploy-dev-frontend.yml','terraform-pr.yml','destroy-infrastructure.yml'])assert.match(read(file),/uses: \.\/\.github\/actions\/aws-oidc/);
});
test('PRs to dev/main validate and never contain an apply or upload to S3',()=>{
 const pr=read('terraform-pr.yml');
 assert.match(pr,/branches: \[dev, main\]/);
 assert.match(pr,/github\.base_ref == 'dev'/);
 assert.match(pr,/development-plan/);assert.match(pr,/production-plan/);
 assert.doesNotMatch(pr,/terraform apply|ci\.mjs upload|aws s3 (sync|cp)/);
 assert.match(pr,/head\.repo\.full_name == github\.repository/);
});
test('only deployment orchestrator handles push and serializes with manual destroy',()=>{
 const deploy=read('deploy.yml'),destroy=read('destroy-infrastructure.yml');
 assert.match(deploy,/branches: \[dev, main\]/);
 assert.match(deploy,/permissionhub-state-/);assert.match(destroy,/permissionhub-state-/);
 for(const file of ['deploy-dev-backend.yml','deploy-dev-frontend.yml','deploy-infrastructure.yml','destroy-infrastructure.yml'])assert.doesNotMatch(read(file),/^  (push|pull_request|schedule):/m);
 assert.match(deploy,/protection production strict/);
});
test('destroy is manual, confirmation-required, plan-only by default with a separate approval',()=>{
 const code=read('destroy-infrastructure.yml');
 assert.match(code,/workflow_dispatch:/);assert.match(code,/confirmation:/);
 assert.match(code,/execute:[\s\S]*?default: false/);
 assert.match(code,/development-destroy/);assert.match(code,/production-destroy/);
 assert.match(code,/needs: \[plan, approval\]/);
 assert.match(code,/PLAN_PURPOSE: destroy/);
 assert.match(code,/seal-plan/);assert.match(code,/open-plan/);
 const apply=code.split('  apply:')[1];
 assert.doesNotMatch(apply,/terraform plan|terraform destroy/);
 assert.match(apply,/terraform apply -input=false -lock-timeout=5m "\$RUNNER_TEMP\/destroy.tfplan"/);
 assert.match(apply,/DESTROY_APPLY: 'true'/);
});
test('fresh migration runs after infrastructure; failed migration prevents frontend handoff',()=>{
 const backend=read('deploy-dev-backend.yml');
 assert.ok(backend.indexOf('Apply exact reviewed plan')<backend.indexOf('Initialize a fresh database only after infrastructure exists'));
 assert.ok(backend.indexOf('Initialize a fresh database only after infrastructure exists')<backend.indexOf('Verify API and report frontend outputs'));
 assert.match(backend,/RUN_MIGRATIONS:/);assert.match(backend,/CI_MIGRATIONS_READY:/);
 assert.match(backend,/node .*ci.mjs migrate/);
});
test('frontend explicit deferral differs from a missing required infrastructure failure',()=>{
 assert.match(read('deploy.yml'),/!inputs.defer_frontend/);
 assert.match(read('deploy.yml'),/frontend-deferred:/);
 assert.match(read('deploy-dev-frontend.yml'),/head-bucket/);
 assert.match(read('deploy-dev-frontend.yml'),/get-distribution/);
 assert.match(read('deploy-dev-frontend.yml'),/Required frontend bucket unavailable/);
});
