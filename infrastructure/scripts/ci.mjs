import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {changes,guardPlan,artifactReferences,sealPlan,openPlan,publicFrontendConfig,deploymentEnvironment,validateIdentity,requireProtection,guardDestroy,assertDestroyPrepared,resources,controlledMigrations,validateBackendConfig,resolveFreshDeployment} from './ci-lib.mjs';
const [command,...args]=process.argv.slice(2);
function run(tool,argv,options={}){const result=spawnSync(tool,argv,{encoding:'utf8',maxBuffer:40*1024*1024,...options});if(result.status!==0)throw Error(`${tool} failed: ${result.stderr}`);return result.stdout}
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const output=async(key,value)=>{if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`${key}=${value}\n`);else console.log(`${key}=${value}`)};
if(command==='prepare-check'){
 validateBackendConfig(process.env);
 const directory=resolve(process.env.GITHUB_WORKSPACE??'.','artifacts');
 const manifest=await json(resolve(directory,'lambda-manifest.json'));
 artifactReferences({},manifest,process.env.LAMBDA_ARTIFACT_BUCKET,true);
 for(const name of ['api','provisioning','expiry','migration']){
  const item=manifest[name];
  if(!item.file||item.file.includes('/')||item.file.includes('\\')||!item.file.endsWith('.zip'))throw Error(`Invalid ${name} artifact filename`);
  const bytes=await readFile(resolve(directory,item.file));
  const digest=createHash('sha256').update(bytes).digest();
  if(bytes.length!==item.zipBytes||digest.toString('base64')!==item.sourceHash||digest.toString('hex')!==item.sha256)throw Error(`Artifact integrity check failed: ${name}`);
  if(item.handler!==`dist/lambda/${name}.handler`||!Number.isFinite(item.uncompressedBytes)||item.uncompressedBytes<=0||item.uncompressedBytes>=250*1024*1024)throw Error(`Invalid handler/size: ${name}`);
 }
 if(process.env.CI_TF_VARS_JSON){
  const config=JSON.parse(process.env.CI_TF_VARS_JSON);
  if(config.environment!==process.env.DEPLOY_ENV||config.aws_region!==process.env.AWS_REGION||config.lambda_artifact_bucket!==process.env.LAMBDA_ARTIFACT_BUCKET||!config.vpc_cidr)throw Error('Repository CI_TF_VARS_JSON does not match preparation environment.');
 }
 console.log('Backend preparation passed: backend settings, four ZIP hashes, sizes, handlers, and initial artifact references. No AWS access/upload/apply. Deployment-environment variables, secrets, live IAM and remote state are checked only in deployment.');
}else if(command==='backend-config'){
 const config=validateBackendConfig(process.env);
 console.log(`Terraform backend configuration verified: ${config.STATE_BUCKET}/${config.STATE_KEY}, lock table ${config.LOCK_TABLE}, region ${config.AWS_REGION}`);
}else if(command==='identity'){
 const who=JSON.parse(run('aws',['sts','get-caller-identity']));
 validateIdentity({environment:process.env.DEPLOY_ENV,account:who.Account,expectedAccount:process.env.AWS_ACCOUNT_ID,region:process.env.AWS_REGION,expectedRegion:process.env.AWS_REGION,stateKey:process.env.STATE_KEY,bucket:process.env.STATE_BUCKET,artifactBucket:process.env.LAMBDA_ARTIFACT_BUCKET,workspace:run('terraform',['workspace','show']).trim()});
 const backend=await json('.terraform/terraform.tfstate');
 const config=backend.backend?.config;
 if(config?.bucket!==process.env.STATE_BUCKET||config?.key!==process.env.STATE_KEY||config?.region!==process.env.AWS_REGION)throw Error('Initialized Terraform backend does not match selected environment.');
 console.log(`Verified ${process.env.DEPLOY_ENV}: account ${who.Account}, region ${process.env.AWS_REGION}, state ${process.env.STATE_BUCKET}/${process.env.STATE_KEY}, workspace default`);
}else if(command==='environment'){
 await output('environment',deploymentEnvironment(process.env.GITHUB_REF,process.env.REQUESTED_ENVIRONMENT));
}else if(command==='protection'){
 const value=JSON.parse(run('gh',['api',`repos/${process.env.GITHUB_REPOSITORY}/environments/${args[0]}`]));requireProtection(value,args[1]==='strict');
}else if(command==='destroy-guard'){
 const plan=await json(args[0]);
 const selected=guardDestroy(plan,process.env.DEPLOY_ENV,process.env.AWS_ACCOUNT_ID,process.env.AWS_REGION);
 console.log(JSON.stringify(selected,null,2));
 if(process.env.DESTROY_APPLY==='true')assertDestroyPrepared(plan);
 if(process.env.DESTROY_APPLY==='true')for(const r of plan.resource_changes??[]){
  if(r.type==='aws_s3_bucket'&&r.change?.actions?.includes('delete')){
   const bucket=r.change.before.bucket;
   const objects=JSON.parse(run('aws',['s3api','list-objects-v2','--bucket',bucket,'--max-keys','1','--expected-bucket-owner',process.env.AWS_ACCOUNT_ID]));
   if(objects.KeyCount>0)throw Error('Frontend bucket is nonempty. Archive and explicitly empty it before a new reviewed destroy run; nothing is automatically purged.');
   const versioning=JSON.parse(run('aws',['s3api','get-bucket-versioning','--bucket',bucket,'--expected-bucket-owner',process.env.AWS_ACCOUNT_ID]));
   if(versioning.Status){
    const versions=JSON.parse(run('aws',['s3api','list-object-versions','--bucket',bucket,'--max-keys','1','--expected-bucket-owner',process.env.AWS_ACCOUNT_ID]));
    if(versions.Versions?.length||versions.DeleteMarkers?.length)throw Error('Versioned frontend bucket retains objects/delete markers. Explicit archival/cleanup is required before destroy.');
   }
  }
 }
}else if(command==='destroy-vars'){
 const state=JSON.parse(run('terraform',['show','-json'])),all=resources(state.values?.root_module);
 if(!all.some(r=>r.mode==='managed'))throw Error('Application state is empty: no Terraform-owned application resources to destroy.');
 const refs={lambda_artifact_bucket:process.env.LAMBDA_ARTIFACT_BUCKET};
 for(const [name,module] of Object.entries({api:'api_lambda',provisioning:'provisioning_lambda',expiry:'expiry_lambda',migration:'migration_lambda'})){
  const lambda=all.find(r=>r.address===`module.${module}.aws_lambda_function.this`)?.values;
  if(lambda&&lambda.s3_bucket!==refs.lambda_artifact_bucket)throw Error('Destroy artifact bucket does not match application state');
  refs[`${name}_lambda_artifact_key`]=lambda?.s3_key??'not-used-by-destroy.zip';
  refs[`${name}_lambda_artifact_hash`]=lambda?.source_code_hash??null;
 }
 await writeFile(args[0],JSON.stringify(refs));
}else if(command==='seal-plan'||command==='open-plan'){
 const context=[process.env.GITHUB_REPOSITORY,process.env.DEPLOY_ENV,process.env.GITHUB_SHA,process.env.PLAN_PURPOSE??'deploy',process.env.GITHUB_RUN_ID,process.env.GITHUB_RUN_ATTEMPT,process.env.AWS_ACCOUNT_ID,process.env.AWS_REGION,process.env.STATE_BUCKET,process.env.STATE_KEY].join(':');
 const source=await readFile(args[0]);
 await writeFile(args[1],command==='seal-plan'?sealPlan(source,process.env.PLAN_ENCRYPTION_KEY,context):openPlan(source.toString(),process.env.PLAN_ENCRYPTION_KEY,context));
}else if(command==='changes'){
 const paths=run('git',['diff','--name-only',args[0],args[1]]).trim().split(/\r?\n/);for(const [key,value] of Object.entries(changes(paths)))await output(key,String(value));
}else if(command==='config'){
 const value=JSON.parse(process.env.CI_TF_VARS_JSON??'{}');
 if(!value.vpc_cidr||value.environment!==process.env.DEPLOY_ENV||value.aws_region!==process.env.AWS_REGION||value.lambda_artifact_bucket!==process.env.LAMBDA_ARTIFACT_BUCKET||value.aws_account_id&&value.aws_account_id!==process.env.AWS_ACCOUNT_ID)throw Error('CI_TF_VARS_JSON must contain reviewed configuration matching selected environment/account/region/artifact bucket. Do not use example defaults.');
 await writeFile(args[0],JSON.stringify(value));
}else if(command==='refs'){
 const state=JSON.parse(run('terraform',['show','-json']));
 const prFreshPlan=process.env.GITHUB_EVENT_NAME==='pull_request'&&!resources(state.values?.root_module).some(r=>r.mode!=='data');
 const fresh=resolveFreshDeployment(state,{environment:process.env.DEPLOY_ENV,requestedFresh:process.env.ALLOW_FRESH_DEPLOYMENT==='true'||prFreshPlan,autoBootstrapDev:process.env.AUTO_BOOTSTRAP_DEV==='true'});
 if(fresh&&process.env.DEPLOY_APPLY==='true'&&process.env.CI_MIGRATIONS_READY!=='true')throw Error('Initial deployment needs CI_MIGRATIONS_READY=true in the selected GitHub Environment after reviewing migrations. No artifacts uploaded or infrastructure applied.');
 const manifest=args[1]==='built'||fresh?await json(resolve(process.env.GITHUB_WORKSPACE??'.','artifacts/lambda-manifest.json')):undefined;
 await writeFile(args[0],JSON.stringify(artifactReferences(state,manifest,process.env.LAMBDA_ARTIFACT_BUCKET,fresh),null,2));
 await output('fresh_deployment',String(fresh));
 console.log(fresh?'Initial deployment: empty verified application state; create infrastructure before running database migrations.':'Existing environment: preserving normal deployment safeguards.');
}else if(command==='upload'){
 const refs=await json(args[0]),manifest=await json('artifacts/lambda-manifest.json'),bucket=refs.lambda_artifact_bucket;
 const versioning=JSON.parse(run('aws',['s3api','get-bucket-versioning','--bucket',bucket]));if(versioning.Status!=='Enabled')throw Error('Enable versioning on the existing artifact bucket before deploying.');
 for(const [name,item] of Object.entries(manifest)){
  if(refs[`${name}_lambda_artifact_key`]!==item.key)continue;
  const head=spawnSync('aws',['s3api','head-object','--bucket',bucket,'--key',item.key],{encoding:'utf8'});
  if(head.status!==0){
   if(!/404|Not Found|NoSuchKey/.test(head.stderr))throw Error(`Cannot inspect ${name} artifact`);
   run('aws',['s3api','put-object','--bucket',bucket,'--key',item.key,'--body',`artifacts/${item.file}`,'--if-none-match','*','--checksum-algorithm','SHA256','--checksum-sha256',item.sourceHash,'--metadata',`sha256=${item.sha256}`]);
  }
  const saved=JSON.parse(run('aws',['s3api','head-object','--bucket',bucket,'--key',item.key]));
  if(saved.ContentLength!==item.zipBytes||saved.Metadata?.sha256!==item.sha256)throw Error(`Artifact integrity mismatch: ${name}`);
  console.log(`Verified immutable artifact: ${name}`);
 }
}else if(command==='guard'){
 const count=guardPlan(await json(args[0]),args[1]);console.log(`Plan safety check passed: ${count} non-destructive changes (${args[1]}).`);
}else if(command==='migrate'){
 const name=run('terraform',['output','-raw','migration_lambda_name']).trim(),response=resolve(process.env.RUNNER_TEMP??'.','migration-response.json');
 const invoke=async action=>{
  const meta=JSON.parse(run('aws',['lambda','invoke','--function-name',name,'--cli-read-timeout','360','--cli-binary-format','raw-in-base64-out','--payload',JSON.stringify({action}),response]));
  const result=await json(response);if(meta.FunctionError)throw Error('Migration Lambda failed. Application deployment blocked; inspect restricted logs.');return result;
 };
 const result=await controlledMigrations(invoke,{enabled:process.env.RUN_MIGRATIONS==='true',ready:process.env.CI_MIGRATIONS_READY==='true'});
 console.log(result.executed?`Migrations completed and verified in ${result.durationMs}ms`:'Database migration history is up to date. No migration executed.');
}else if(command==='frontend'){
 if(process.env.DEFER_FRONTEND==='true'){await output('public_config','');console.log('Frontend explicitly deferred; no frontend deployment claimed.');process.exit(0);}
 const values=JSON.parse(run('terraform',['output','-json'])),get=key=>{const value=values[key]?.value;if(!value)throw Error(`Missing Terraform output: ${key}`);return value};
 for(const key of ['api_gateway_endpoint','frontend_url','frontend_bucket_name','frontend_cloudfront_distribution_id','cognito_app_client_id','cognito_domain'])await output(key,get(key));
 await output('public_config',JSON.stringify(publicFrontendConfig(values)));
}else if(command==='health'){
 const endpoint=run('terraform',['output','-raw','api_gateway_endpoint']).trim();
 const response=await fetch(`${endpoint}/health`,{signal:AbortSignal.timeout(30000)});const payload=await response.json();if(!response.ok||payload.status!=='ok')throw Error('API health check failed');console.log('API health check passed (does not prove IAM provisioning).');
}else throw Error(`Unknown CI command: ${command}`);
