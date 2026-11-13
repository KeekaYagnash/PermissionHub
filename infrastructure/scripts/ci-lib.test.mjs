import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBackendConfig} from './ci-lib.mjs';
import {resolveFreshDeployment} from './ci-lib.mjs';
import {parseDeploymentConfig} from './ci-lib.mjs';
import {readFileSync} from 'node:fs';
import {validatePlanEncryptionKey} from './ci-lib.mjs';
import {guardFoundationPlan,stagedArtifactReferences} from './ci-lib.mjs';

test('infrastructure-first plans exclude code and reject replacement or unrelated resources',()=>{
 const change=(address,actions=['create'])=>({resource_changes:[{mode:'managed',address,change:{actions}}]});
 guardFoundationPlan(change('module.networking.aws_vpc.this'));
 guardFoundationPlan(change('module.rds.aws_db_instance.this'));
 guardFoundationPlan(change('aws_vpc_endpoint.interface["sts"]'));
 for(const address of ['module.api_lambda.aws_lambda_function.this','module.migration_lambda.aws_lambda_function.this','aws_vpc_endpoint.unrelated','module.unrelated.aws_s3_bucket.this'])assert.throws(()=>guardFoundationPlan(change(address)));
 assert.throws(()=>guardFoundationPlan(change('module.rds.aws_db_instance.this',['delete','create'])));
});

test('backend artifacts support first deployment and partial retry without assuming missing Lambdas exist',()=>{
 const manifest=Object.fromEntries(['api','provisioning','expiry','migration'].map(name=>[name,{key:`lambda/${name}/real.zip`,sourceHash:'digest'}]));
 const state={values:{root_module:{resources:[{mode:'managed',address:'module.rds.aws_db_instance.this'}]}}};
 assert.equal(stagedArtifactReferences(state,manifest,'bucket').api_lambda_artifact_key,'lambda/api/real.zip');
 state.values.root_module.resources.push({address:'module.migration_lambda.aws_lambda_function.this',values:{s3_bucket:'bucket'}});
 assert.equal(stagedArtifactReferences(state,manifest,'bucket').migration_lambda_artifact_key,'lambda/migration/real.zip');
 assert.throws(()=>stagedArtifactReferences(state,manifest,'other-bucket'));
 assert.throws(()=>stagedArtifactReferences(state,{api:manifest.api},'bucket'));
});

test('plan encryption requires canonical base64 for 32 bytes without echoing secret input',()=>{
 const key=Buffer.alloc(32,7).toString('base64');
 assert.equal(validatePlanEncryptionKey(key).length,32);
 assert.equal(validatePlanEncryptionKey(` ${key}\n`).length,32);
 for(const value of [undefined,'','invalid-secret',Buffer.alloc(31).toString('base64'),Buffer.alloc(33).toString('base64'),key+'!']){
  assert.throws(()=>validatePlanEncryptionKey(value),error=>error.message.includes('TF_PLAN_ENCRYPTION_KEY')&&(!value||!error.message.includes(value)));
 }
});

test('deployment config handles empty GitHub variables with reviewed dev fallback only',()=>{
 const fallback=JSON.parse(readFileSync(new URL('../terraform/environments/dev/ci.tfvars.json',import.meta.url),'utf8'));
 const env={DEPLOY_ENV:'dev',AWS_REGION:'af-south-1',AWS_ACCOUNT_ID:'143671530412',LAMBDA_ARTIFACT_BUCKET:'permissionhub-dev-lambda-artifacts'};
 for(const raw of [undefined,'','  ','\n'])assert.deepEqual(parseDeploymentConfig(raw,fallback,env),fallback);
 const override={...fallback,cognito_domain_prefix:'permissionhub-reviewed-override'};
 assert.equal(parseDeploymentConfig(JSON.stringify(override),fallback,env).cognito_domain_prefix,override.cognito_domain_prefix);
 for(const raw of ['{','not-json','[]','null','true','"some-file.json"'])assert.throws(()=>parseDeploymentConfig(raw,fallback,env));
 for(const patch of [{environment:'prod'},{aws_region:'us-east-1'},{lambda_artifact_bucket:'other'},{aws_account_id:'000000000000'},{availability_zones:[]},{private_db_subnet_cidrs:['10.0.0.0/24']}])assert.throws(()=>parseDeploymentConfig(JSON.stringify({...fallback,...patch}),fallback,env));
 assert.throws(()=>parseDeploymentConfig('',fallback,{...env,DEPLOY_ENV:'prod'}),/required for production/);
 const prod={...fallback,environment:'prod',lambda_artifact_bucket:'permissionhub-prod-lambda-artifacts'};
 assert.equal(parseDeploymentConfig(JSON.stringify(prod),undefined,{...env,DEPLOY_ENV:'prod',LAMBDA_ARTIFACT_BUCKET:prod.lambda_artifact_bucket}).environment,'prod');
});

test('empty dev state bootstraps automatically; production and nonempty state keep existing safeguards',()=>{
 const empty={values:{root_module:{}}};
 const partial={values:{root_module:{child_modules:[{resources:[{mode:'managed',address:'module.networking.aws_vpc.this'}]}]}}};
 assert.equal(resolveFreshDeployment(empty,{environment:'dev',autoBootstrapDev:true}),true);
 assert.equal(resolveFreshDeployment(empty,{environment:'prod',autoBootstrapDev:true}),false);
 assert.equal(resolveFreshDeployment(empty,{environment:'prod',requestedFresh:true}),true);
 assert.equal(resolveFreshDeployment(empty,{environment:'dev'}),false);
 assert.equal(resolveFreshDeployment(partial,{environment:'dev',autoBootstrapDev:true}),false);
 assert.throws(()=>resolveFreshDeployment(partial,{environment:'dev',requestedFresh:true}),/empty application state/);
 const manifest=Object.fromEntries(['api','provisioning','expiry','migration'].map(name=>[name,{key:`lambda/${name}/built.zip`,sourceHash:'digest'}]));
 const fresh=resolveFreshDeployment(empty,{environment:'dev',autoBootstrapDev:true});
 const refs=artifactReferences(empty,manifest,'permissionhub-dev-lambda-artifacts',fresh);
 assert.equal(refs.api_lambda_artifact_key,'lambda/api/built.zip');
 assert.throws(()=>artifactReferences(partial,manifest,'permissionhub-dev-lambda-artifacts'),/missing from state/);
});

test('Terraform backend preflight rejects blank/whitespace values with exact missing field names',()=>{
 const env={STATE_BUCKET:'permissionhub-dev-bucket',STATE_KEY:'permisionhub/dev/backend',LOCK_TABLE:'permissionhub-state-lock',AWS_REGION:'af-south-1',AWS_ACCOUNT_ID:'143671530412',LAMBDA_ARTIFACT_BUCKET:'permissionhub-dev-lambda-artifacts'};
 assert.deepEqual(validateBackendConfig(env),env);
 assert.deepEqual(validateBackendConfig({...env,DEPLOY_ENV:'dev'}),env);
 assert.throws(()=>validateBackendConfig({...env,DEPLOY_ENV:'prod'}),/permisionhub\/prod\/backend/);
 assert.throws(()=>validateBackendConfig({...env,DEPLOY_ENV:'dev',STATE_KEY:'permissionhub/dev/terraform.tfstate'}),/TF_STATE_KEY/);
 for(const key of Object.keys(env))for(const value of [undefined,'','   ',' padded ']){
  assert.throws(()=>validateBackendConfig({...env,[key]:value}),new RegExp(key));
 }
});
import {changes,guardPlan,artifactReferences,sealPlan,openPlan,publicFrontendConfig,deploymentEnvironment,validateIdentity,requireProtection,guardDestroy,assertDestroyPrepared,controlledMigrations} from './ci-lib.mjs';
test('approved destroy cannot disable RDS or Cognito deletion protection itself',()=>{
 for(const protection of [true,'ACTIVE'])assert.throws(()=>assertDestroyPrepared({resource_changes:[{address:'protected',change:{actions:['delete'],before:{deletion_protection:protection}}}]}));
 for(const protection of [false,'INACTIVE',undefined])assertDestroyPrepared({resource_changes:[{address:'prepared',change:{actions:['delete'],before:{deletion_protection:protection}}}]});
});
test('fresh controlled migration sequence is status/deploy/status only with reviewed flags',async()=>{
 const calls=[];
 const result=await controlledMigrations(async action=>{calls.push(action);return calls.length===1?{ok:false}:action==='migrate'?{ok:true,mode:'migrate',durationMs:1}:{ok:true,upToDate:true}},{enabled:true,ready:true});
 assert.equal(result.executed,true);assert.deepEqual(calls,['status','migrate','status']);
 for(const flags of [{enabled:false,ready:true},{enabled:true,ready:false}]){
  const attempts=[];await assert.rejects(controlledMigrations(async action=>{attempts.push(action);return {ok:false}},flags));assert.deepEqual(attempts,['status']);
 }
});
test('migration failure and failed postcheck block application release; up-to-date is a no-op',async()=>{
 const ready={enabled:true,ready:true};
 await assert.rejects(controlledMigrations(async()=>({ok:false}),ready));
 await assert.rejects(controlledMigrations(async action=>action==='migrate'?{ok:true,mode:'migrate'}:{ok:false},ready));
 const calls=[];const result=await controlledMigrations(async action=>{calls.push(action);return {ok:true,upToDate:true}},ready);
 assert.equal(result.executed,false);assert.deepEqual(calls,['status']);
});
test('merges/manual deployment cannot cross branch/environment boundaries',()=>{
 assert.equal(deploymentEnvironment('refs/heads/dev'),'dev');
 assert.equal(deploymentEnvironment('refs/heads/main'),'prod');
 assert.equal(deploymentEnvironment('refs/heads/main','prod'),'prod');
 assert.throws(()=>deploymentEnvironment('refs/heads/main','dev'));
 assert.throws(()=>deploymentEnvironment('refs/pull/1/merge','prod'));
 assert.throws(()=>deploymentEnvironment('refs/heads/demo_ready_2','dev'));
});
test('backend identity rejects wrong accounts, state keys, workspaces and artifact environments',()=>{
 const value={environment:'prod',account:'123456789012',expectedAccount:'123456789012',region:'af-south-1',expectedRegion:'af-south-1',stateKey:'permisionhub/prod/backend',bucket:'permissionhub-prod-state',artifactBucket:'permissionhub-prod-lambda-artifacts'};
 assert.equal(validateIdentity(value),true);
 assert.throws(()=>validateIdentity({...value,stateKey:'permissionhub/prod/terraform.tfstate'}));
 for(const patch of [{account:'111111111111'},{expectedAccount:''},{workspace:'dev'},{stateKey:'permisionhub/dev/backend'},{bucket:'permissionhub-dev-state'},{artifactBucket:'permissionhub-dev-lambda-artifacts'},{region:'us-east-1'}])assert.throws(()=>validateIdentity({...value,...patch}));
});
test('destroy requires human review; production also forbids self-review and admin bypass',()=>{
 assert.throws(()=>requireProtection({}));
 const protection={can_admins_bypass:false,protection_rules:[{type:'required_reviewers',prevent_self_review:true,reviewers:[{id:1}]}]};
 requireProtection(protection,true);
 assert.throws(()=>requireProtection({...protection,can_admins_bypass:true},true));
 assert.throws(()=>requireProtection({protection_rules:[{type:'required_reviewers',reviewers:[{}]}]},true));
});
const destruction=(type,address,before,actions=['delete'])=>({resource_changes:[{mode:'managed',type,address,change:{before,after:null,actions}}]});
test('dev/prod destroy plans only allow matching application resources',()=>{
 for(const env of ['dev','prod'])assert.equal(guardDestroy(destruction('aws_iam_role','module.api_lambda.aws_iam_role.this',{name:`permissionhub-${env}-api-role`,tags:{Environment:env}}),env).length,1);
 assert.throws(()=>guardDestroy(destruction('aws_iam_role','module.api_lambda.aws_iam_role.this',{name:'permissionhub-dev-api-role'}),'prod'));
 assert.throws(()=>guardDestroy(destruction('aws_lambda_function','module.api_lambda.aws_lambda_function.this',{arn:'arn:aws:lambda:af-south-1:111111111111:function:permissionhub-prod-api'}),'prod','123456789012'));
 assert.throws(()=>guardDestroy(destruction('aws_lambda_function','module.api_lambda.aws_lambda_function.this',{arn:'arn:aws:lambda:us-east-1:123456789012:function:permissionhub-prod-api'}),'prod','123456789012','af-south-1'));
});
test('destroy refuses OIDC, CI roles/policies, lock tables, shared buckets and any creates',()=>{
 for(const [type,address,before] of [
  ['aws_iam_openid_connect_provider','aws_iam_openid_connect_provider.github',{}],
  ['aws_dynamodb_table','module.networking.aws_dynamodb_table.lock',{}],
  ['aws_iam_role','module.api_lambda.aws_iam_role.this',{name:'permissionhub-github-terraform-dev'}],
  ['aws_iam_policy','module.api_lambda.aws_iam_policy.this',{name:'permissionhub-github-terraform-dev'}],
  ['aws_s3_bucket','module.frontend_hosting.aws_s3_bucket.frontend',{bucket:'permissionhub-dev-bucket'}],
  ['aws_s3_bucket','module.frontend_hosting.aws_s3_bucket.frontend',{bucket:'permissionhub-dev-frontend-example',force_destroy:true}]
 ])assert.throws(()=>guardDestroy(destruction(type,address,before),'dev'));
 assert.throws(()=>guardDestroy(destruction('aws_vpc','module.networking.aws_vpc.this',{},['create']),'dev'));
 assert.throws(()=>guardDestroy(destruction('aws_secretsmanager_secret','module.secrets.aws_secretsmanager_secret.app',{recovery_window_in_days:0}),'dev'));
});
test('production RDS destroy must retain final snapshots and automated backups',()=>{
 const data={skip_final_snapshot:false,final_snapshot_identifier:'permissionhub-prod-final-a1',delete_automated_backups:false,deletion_protection:true};
 guardDestroy(destruction('aws_db_instance','module.rds.aws_db_instance.this',data),'prod');
 for(const patch of [{skip_final_snapshot:true},{final_snapshot_identifier:null},{delete_automated_backups:true}])assert.throws(()=>guardDestroy(destruction('aws_db_instance','module.rds.aws_db_instance.this',{...data,...patch}),'prod'));
});
test('fresh public frontend outputs are allowlisted; no credentials or state forwarded',()=>{
 const names=['api_gateway_endpoint','frontend_url','frontend_bucket_name','frontend_cloudfront_distribution_id','cognito_app_client_id','cognito_domain'];
 const outputs=Object.fromEntries(names.map(name=>[name,{value:name}]));
 outputs.database_secret_arn={value:'not public'}; outputs.password={value:'not public'};
 outputs.cognito_providers={value:[{name:'Google',label:'Google',client_secret:'not public'}]};
 const config=publicFrontendConfig(outputs);
 assert.equal(Object.keys(config).length,7);assert.equal(config.FRONTEND_URL,'frontend_url');
 assert.equal(JSON.stringify(config).includes('not public'),false);
 assert.throws(()=>publicFrontendConfig({}));
 assert.throws(()=>publicFrontendConfig({...outputs,frontend_url:{value:'invalid\nvalue'}}));
});
test('saved plans are encrypted, authenticated and commit/environment-bound',()=>{
 const key=Buffer.alloc(32,7).toString('base64'),plain=Buffer.from('sensitive Terraform plan');
 const encrypted=sealPlan(plain,key,'repo:dev:commit');assert.equal(encrypted.includes('sensitive'),false);
 assert.deepEqual(openPlan(encrypted,key,'repo:dev:commit'),plain);
 assert.throws(()=>openPlan(encrypted,key,'repo:prod:commit'));assert.throws(()=>sealPlan(plain,'','repo:dev:commit'));
});
test('shared lockfile and deployment changes affect both applications',()=>{assert.equal(changes(['package-lock.json']).backend,true);assert.equal(changes(['package-lock.json']).frontend,true);assert.equal(changes(['frontend/src/page.tsx']).backend,false);assert.equal(changes(['backend/prisma/schema.prisma']).migrations,true)});
const plan=(actions,address='module.api_lambda.aws_lambda_function.this',before={s3_key:'old'},after={s3_key:'new'})=>({resource_changes:[{address,type:'aws_lambda_function',change:{actions,before,after}}]});
test('code plans cannot replace or delete resources',()=>{assert.throws(()=>guardPlan(plan(['delete','create']),'backend'));assert.throws(()=>guardPlan(plan(['delete']),'infrastructure'))});
test('routine backend plans cannot change networking or configuration',()=>{assert.throws(()=>guardPlan(plan(['update'],'module.networking.aws_vpc.this'),'backend'));assert.throws(()=>guardPlan(plan(['update'],undefined,{role:'old'},{role:'new'}),'backend'));assert.equal(guardPlan(plan(['update']),'backend'),1)});
test('migration plans cannot change another function',()=>assert.throws(()=>guardPlan(plan(['update']),'migration')));
test('missing state cannot accidentally bootstrap a new environment',()=>assert.throws(()=>artifactReferences({values:{root_module:{}}},undefined,'bucket')));
test('fresh dev artifacts require an explicit flag, full manifest, and empty state',()=>{
 const manifest=Object.fromEntries(['api','provisioning','expiry','migration'].map(name=>[name,{key:`lambda/${name}/digest.zip`,sourceHash:'digest'}]));
 assert.equal(artifactReferences({values:{root_module:{}}},manifest,'bucket',true).api_lambda_artifact_key,'lambda/api/digest.zip');
 assert.throws(()=>artifactReferences({values:{root_module:{resources:[{mode:'managed',address:'existing'}]}}},manifest,'bucket',true));
 assert.throws(()=>artifactReferences({},undefined,'bucket',true));
});
test('artifact references preserve unchanged code and select new digest keys only for changed code',()=>{
 const modules={api:'api_lambda',provisioning:'provisioning_lambda',expiry:'expiry_lambda',migration:'migration_lambda'};
 const state={values:{root_module:{child_modules:Object.entries(modules).map(([name,module])=>({resources:[{address:`module.${module}.aws_lambda_function.this`,values:{s3_bucket:'bucket',s3_key:`legacy/${name}.zip`,source_code_hash:'same'}}]}))}}};
 const manifest=Object.fromEntries(Object.keys(modules).map(name=>[name,{sourceHash:name==='api'?'changed':'same',key:`lambda/${name}/digest.zip`}]));
 const refs=artifactReferences(state,manifest,'bucket');assert.equal(refs.api_lambda_artifact_key,'lambda/api/digest.zip');assert.equal(refs.expiry_lambda_artifact_key,'legacy/expiry.zip');assert.throws(()=>artifactReferences(state,manifest,'different-bucket'));
});
