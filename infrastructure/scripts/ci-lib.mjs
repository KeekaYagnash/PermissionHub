import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export function sealPlan(bytes,key,context){
 const secret=Buffer.from(key??'','base64');if(secret.length!==32)throw Error('TF_PLAN_ENCRYPTION_KEY must be a base64-encoded 32-byte environment secret');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(Buffer.from(context));
 const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);return JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')});
}
export function openPlan(value,key,context){
 const envelope=JSON.parse(value),decipher=createDecipheriv('aes-256-gcm',Buffer.from(key??'','base64'),Buffer.from(envelope.iv,'base64'));decipher.setAAD(Buffer.from(context));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]);
}
export const lambdaModules={api:'api_lambda',provisioning:'provisioning_lambda',expiry:'expiry_lambda',migration:'migration_lambda'};
export function validateBackendConfig(env){
 const required=['STATE_BUCKET','STATE_KEY','LOCK_TABLE','AWS_REGION','AWS_ACCOUNT_ID','LAMBDA_ARTIFACT_BUCKET'];
 const invalid=required.filter(key=>typeof env[key]!=='string'||!env[key].trim()||env[key]!==env[key].trim());
 if(invalid.length)throw Error(`Missing or whitespace-padded workflow configuration: ${invalid.join(', ')}. Configure the selected GitHub Environment variables; Terraform init was not started.`);
 if(env.DEPLOY_ENV){
  if(!['dev','prod'].includes(env.DEPLOY_ENV))throw Error('Invalid DEPLOY_ENV; expected dev or prod.');
  const expected=`permisionhub/${env.DEPLOY_ENV}/backend`;
  if(env.STATE_KEY!==expected)throw Error(`TF_STATE_KEY must be ${expected}. Review any existing state migration before changing the GitHub Variable; Terraform init was not started.`);
 }
 return Object.fromEntries(required.map(key=>[key,env[key]]));
}
export function deploymentEnvironment(ref,requested){
 const environment=requested || (ref==='refs/heads/dev'?'dev':ref==='refs/heads/main'?'prod':undefined);
 if(!['dev','prod'].includes(environment)||ref!==`refs/heads/${environment==='dev'?'dev':'main'}`)throw Error('Deployment requires dev branch for dev, main branch for prod.');
 return environment;
}
export function validateIdentity({environment,account,expectedAccount,region,expectedRegion,stateKey,bucket,artifactBucket,workspace='default'}){
 if(!['dev','prod'].includes(environment)||!/^\d{12}$/.test(expectedAccount??'')||account!==expectedAccount||region!==expectedRegion||!region)throw Error('AWS account/region/environment mismatch; configure AWS_ACCOUNT_ID and AWS_REGION.');
 if(workspace!=='default'||stateKey!==`permisionhub/${environment}/backend`||!bucket||!artifactBucket)throw Error('Wrong workspace/backend; use default workspace and the exact environment state key.');
 const other=environment==='dev'?'prod':'dev';
 if(new RegExp(`(^|[-/])${other}($|[-/])`).test(bucket)||!new RegExp(`(^|-)${environment}(-|$)`).test(artifactBucket))throw Error('Cross-environment state/artifact bucket configuration refused.');
 return true;
}
export function requireProtection(value,strict=false){
 const review=value.protection_rules?.find(rule=>rule.type==='required_reviewers');
 if(!review?.reviewers?.length||strict&&(!review.prevent_self_review||value.can_admins_bypass!==false))throw Error('Protected environment must require reviewers; production must also prevent self-review and admin bypass.');
}
export async function controlledMigrations(invoke,{enabled,ready}){
 const status=await invoke('status');
 if(status.ok===true&&status.upToDate===true)return {executed:false};
 if(!enabled||!ready)throw Error('Pending/unverified migration history: review and explicitly enable migrations. Application deployment blocked.');
 const result=await invoke('migrate');
 if(result.ok!==true||result.mode!=='migrate')throw Error('Migration did not succeed. Application deployment blocked.');
 const verified=await invoke('status');
 if(verified.ok!==true||verified.upToDate!==true)throw Error('Post-migration status failed. Application deployment blocked.');
 return {executed:true,durationMs:result.durationMs};
}
export function guardDestroy(plan,environment,account,region){
 if(!['dev','prod'].includes(environment))throw Error('Invalid destroy environment');
 const prefix=`permissionhub-${environment}`,other=environment==='dev'?'prod':'dev';
 const runtimeRoles=new Set(['api-role','provisioning-role','expiry-role','db-migration-role','rds-proxy'].map(suffix=>`${prefix}-${suffix}`));
 const changed=(plan.resource_changes??[]).filter(r=>r.mode!=='data'&&r.change.actions.some(a=>a!=='no-op'&&a!=='read'));
 for(const r of changed){
  if(r.change.actions.join(',')!=='delete')throw Error(`Destroy plan contains a non-delete action: ${r.address}`);
  if(!/^module\.(networking|security|rds|rds_proxy|secrets|cognito|queues|api_lambda|provisioning_lambda|expiry_lambda|migration_lambda|api_gateway|frontend_hosting|monitoring)\./.test(r.address)&&!/^aws_vpc_endpoint\.interface\[/.test(r.address)&&r.address!=='random_id.final_snapshot')throw Error(`Resource outside application root: ${r.address}`);
  if(['aws_iam_openid_connect_provider','aws_dynamodb_table'].includes(r.type))throw Error('Bootstrap infrastructure cannot be destroyed');
  const before=r.change.before??{};
  const arnAccount=before.arn?.split(':')[4];
  if(account&&arnAccount&&arnAccount!==account)throw Error(`Resource belongs to another AWS account: ${r.address}`);
  const arnRegion=before.arn?.split(':')[3];
  if(region&&arnRegion&&arnRegion!==region)throw Error(`Resource belongs to another AWS region: ${r.address}`);
  if(r.type==='aws_s3_bucket'&&(!r.address.startsWith('module.frontend_hosting.')||!before.bucket?.startsWith(`${prefix}-frontend-`)||before.force_destroy))throw Error('Shared/force-deleted buckets cannot be destroyed');
  if(r.type==='aws_iam_role'&&!runtimeRoles.has(before.name))throw Error('Only the five application runtime roles can be destroyed; deployment/shared roles are protected');
  if(r.type.startsWith('aws_s3_')&&before.bucket&&!before.bucket.startsWith(`${prefix}-frontend-`))throw Error('Only application frontend buckets may be destroyed');
  if(r.type==='aws_iam_policy'&&!before.name?.startsWith(`${prefix}-`))throw Error('Shared/CI policies cannot be destroyed');
  if(r.type.startsWith('aws_iam_role_')&&before.role&&!runtimeRoles.has(before.role))throw Error('Shared/CI role bindings cannot be destroyed');
  if(r.type==='aws_secretsmanager_secret'&&!(before.recovery_window_in_days>=7))throw Error('Secrets require a normal recovery window; force deletion is forbidden');
  if(before.tags?.Environment&&before.tags.Environment!==environment||JSON.stringify(before).includes(`permissionhub-${other}-`))throw Error(`Cross-environment resource refused: ${r.address}`);
  if(environment==='prod'&&r.type==='aws_db_instance'&&(before.skip_final_snapshot!==false||!before.final_snapshot_identifier||before.delete_automated_backups!==false))throw Error('Production destroy must retain final snapshot and automated backups');
 }
 return changed.map(r=>({address:r.address,type:r.type}));
}
export function assertDestroyPrepared(plan){
 for(const r of plan.resource_changes??[]){
  const protection=r.change?.before?.deletion_protection;
  if(r.change?.actions?.includes('delete')&&protection&&protection!==false&&protection!=='INACTIVE')throw Error(`Deletion protection requires separate reviewed preparation: ${r.address}`);
 }
}
export function publicFrontendConfig(outputs){
 const mapping={API_GATEWAY_ENDPOINT:'api_gateway_endpoint',FRONTEND_URL:'frontend_url',FRONTEND_BUCKET:'frontend_bucket_name',CLOUDFRONT_DISTRIBUTION_ID:'frontend_cloudfront_distribution_id',COGNITO_CLIENT_ID:'cognito_app_client_id',COGNITO_DOMAIN:'cognito_domain'};
 const configured=outputs.cognito_providers?.value??[];
 if(!Array.isArray(configured))throw Error('Invalid public Cognito provider list');
 const providers=configured.map(provider=>{if(typeof provider.name!=='string'||typeof provider.label!=='string')throw Error('Invalid public Cognito provider label');return {name:provider.name,label:provider.label}});
 return {...Object.fromEntries(Object.entries(mapping).map(([key,source])=>{
  const value=outputs[source]?.value;
  if(typeof value!=='string'||!value||/[\r\n]/.test(value))throw Error(`Missing/invalid public Terraform output: ${source}`);
  return [key,value];
 })),COGNITO_PROVIDERS_JSON:JSON.stringify(providers)};
}
export function resources(module){return [...(module?.resources??[]),...(module?.child_modules??[]).flatMap(resources)]}
export function changes(paths){
 const shared=paths.some(p=>/^(package(-lock)?\.json|\.github\/|infrastructure\/scripts\/|backend\/scripts\/)/.test(p));
 return {backend:shared||paths.some(p=>p.startsWith('backend/')),frontend:shared||paths.some(p=>p.startsWith('frontend/')),infrastructure:paths.some(p=>p.startsWith('infrastructure/terraform/')),migrations:paths.some(p=>p.startsWith('backend/prisma/migrations/')||p==='backend/prisma/schema.prisma')};
}
export function guardPlan(plan,mode){
 if(!['backend','infrastructure','migration'].includes(mode))throw Error('Unknown plan mode');
 const changed=(plan.resource_changes??[]).filter(r=>r.mode!=='data'&&r.change.actions.some(a=>a!=='no-op'&&a!=='read'));
 for(const resource of changed){
  if(resource.change.actions.includes('delete'))throw Error(`Destruction/replacement blocked: ${resource.address}`);
  if(mode==='infrastructure')continue;
  const allowed=Object.values(lambdaModules).some(name=>resource.address===`module.${name}.aws_lambda_function.this`);
  if(!allowed||resource.change.actions.join(',')!=='update')throw Error(`Unexpected ${mode} change: ${resource.address}`);
  if(mode==='migration'&&resource.address!=='module.migration_lambda.aws_lambda_function.this')throw Error('Migration plan changed another function');
  const before=resource.change.before??{},after=resource.change.after??{};
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
   if(['s3_key','s3_object_version','source_code_hash','last_modified','qualified_arn','qualified_invoke_arn','version'].includes(key))continue;
   if(key==='environment'&&resource.address==='module.migration_lambda.aws_lambda_function.this'){
    const old=structuredClone(before[key]),next=structuredClone(after[key]);
    if(next?.[0]?.variables?.DATABASE_MIGRATION_MODE!=='migrate')throw Error('Migration must use migrate deploy');
    if(old?.[0]?.variables)delete old[0].variables.DATABASE_MIGRATION_MODE;
    if(next?.[0]?.variables)delete next[0].variables.DATABASE_MIGRATION_MODE;
    if(JSON.stringify(old)===JSON.stringify(next))continue;
   }
   if(JSON.stringify(before[key])!==JSON.stringify(after[key]))throw Error(`Non-code change blocked: ${resource.address}.${key}`);
  }
 }
 return changed.length;
}
export function artifactReferences(state,manifest,bucket,allowFresh=false){
 const all=resources(state.values?.root_module),result={lambda_artifact_bucket:bucket};
 if(allowFresh){
  if(all.some(resource=>resource.mode!=='data'))throw Error('Fresh deployment requires empty application state, not partially managed infrastructure.');
  if(!manifest||Object.keys(lambdaModules).some(name=>!manifest[name]))throw Error('Fresh deployment requires all four real Lambda artifacts.');
  for(const [name,built] of Object.entries(manifest)){result[`${name}_lambda_artifact_key`]=built.key;result[`${name}_lambda_artifact_hash`]=built.sourceHash;}
  return result;
 }
 for(const [name,module] of Object.entries(lambdaModules)){
  const current=all.find(r=>r.address===`module.${module}.aws_lambda_function.this`)?.values;
  if(!current)throw Error(`Existing ${name} Lambda missing from state. Bootstrap infrastructure must be reviewed separately.`);
  if(current.s3_bucket!==bucket)throw Error('Artifact bucket differs from existing Terraform state');
  const built=manifest?.[name],same=!built||built.sourceHash===current.source_code_hash;
  if(same&&!current.source_code_hash)throw Error(`Existing ${name} artifact has no integrity hash; build artifacts first.`);
  result[`${name}_lambda_artifact_key`]=same?current.s3_key:built.key;
  result[`${name}_lambda_artifact_hash`]=same?current.source_code_hash:built.sourceHash;
 }
 return result;
}
