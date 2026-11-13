import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../../.github/workflows/${name}`,import.meta.url),'utf8');

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
 assert.match(deploy,/frontend:\s*\n\s*needs: \[changes, validation, backend\]/);
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
