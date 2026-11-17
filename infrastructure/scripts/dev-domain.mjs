import {spawnSync} from 'node:child_process';
import {appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const domain='dev.iamops.disraptor.co.za';
export const zoneName='disraptor.co.za';
// Confirmed by Secrets Manager metadata: the suffix starts with capital O, not zero.
export const secretArn='arn:aws:secretsmanager:af-south-1:143671530412:secret:Cloudflare/IAMOps-OHd0cA';
export function parseCredentials(text){
 let value;try{value=JSON.parse(text)}catch{throw Error('Cloudflare secret must contain a JSON object. Values withheld.');}
 if(typeof value.API_TOKEN!=='string'||!value.API_TOKEN||/[\r\n]/.test(value.API_TOKEN)||!(/^[a-f0-9]{32}$/i.test(value.ACCOUNT_ID??'')))throw Error('Cloudflare secret needs valid API_TOKEN and ACCOUNT_ID fields. Values withheld.');
 return value;
}
export async function inspectZone(credentials,request=fetch){
 const get=async path=>{
  let response;try{response=await request(`https://api.cloudflare.com/client/v4${path}`,{headers:{Authorization:`Bearer ${credentials.API_TOKEN}`},signal:AbortSignal.timeout(30000)})}catch{throw Error('Cloudflare read-only API unavailable. Credentials withheld.');}
  let payload;try{payload=await response.json()}catch{throw Error('Cloudflare returned an invalid response. Response withheld.');}
  if(!response.ok||!payload.success)throw Error('Cloudflare read-only verification denied. Check token zone access, Zone:Read and DNS:Edit. Response withheld.');
  return payload.result;
 };
 const zones=await get(`/zones?name=${zoneName}&account.id=${credentials.ACCOUNT_ID}`);
 if(!Array.isArray(zones)||zones.length!==1||zones[0].name!==zoneName||zones[0].status!=='active')throw Error('Exactly one active disraptor.co.za zone is required in the configured Cloudflare account.');
 const zone=zones[0];
 if(!zone.permissions?.includes('#dns_records:edit'))throw Error('Cloudflare token does not advertise DNS edit permission for disraptor.co.za. No writes attempted.');
 const records=await get(`/zones/${zone.id}/dns_records?name=${domain}`);
 return {zoneId:zone.id,records,get};
}
export function describeAwsFailure(args,result){
 // Parse only recognized identifiers, never echo stderr (it may contain secrets).
 const code=/An error occurred \(([A-Za-z0-9]+)\) when calling/.exec(result.stderr??'')?.[1];
 const readingSecret=args[0]==='secretsmanager'&&args[1]==='get-secret-value';
 if(readingSecret&&['AccessDenied','AccessDeniedException','UnauthorizedOperation'].includes(code))return '[AWS_ACCESS_DENIED] Secrets Manager GetSecretValue was denied for the Cloudflare dev secret in af-south-1. Apply the independent github-dev bootstrap policy permissionhub-github-terraform-domain-dev and its attachment to permissionhub-github-terraform-dev, then rerun. A code merge alone cannot grant AWS permissions. Secret values and AWS response withheld.';
 if(readingSecret&&code==='ResourceNotFoundException')return '[AWS_SECRET_NOT_FOUND] The configured Cloudflare dev secret was not found in af-south-1. Verify its ARN (IAMOps-OHd0cA starts with capital O), account and region. Secret values withheld.';
 if(code==='ExpiredToken'||code==='ExpiredTokenException')return '[AWS_CREDENTIALS_EXPIRED] Deployment AWS credentials expired. Renew OIDC authentication and rerun. Response withheld.';
 if(result.error?.code==='ENOENT')return '[AWS_CLI_MISSING] Install AWS CLI v2 before loading the Cloudflare dev secret.';
 return '[AWS_READ_FAILED] AWS read-only operation failed. Verify deployment identity, region and network access. Response withheld.';
}
function run(tool,args,env=process.env){
 const result=spawnSync(tool,args,{env,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true});
 // Never echo secret-bearing subprocess output or errors.
 if(result.status!==0)throw Error(tool==='aws'?describeAwsFailure(args,result):'Terraform inspection failed; inspect access/configuration. Output withheld.');
 return result.stdout;
}
export function checkOwnership(state,certificates,records){
 const flatten=module=>[...(module?.resources??[]),...(module?.child_modules??[]).flatMap(flatten)];
 const resources=flatten(state.values?.root_module);
 for(const record of records){
  if(!resources.some(r=>r.address==='cloudflare_dns_record.frontend'&&r.values.id===record.id))throw Error(`Existing website DNS record ${record.id} is not owned by this dev state. Review and import; no overwrite attempted.`);
 }
 for(const cert of certificates){
  if(!resources.some(r=>r.address==='aws_acm_certificate.frontend'&&r.values.arn===cert.CertificateArn))throw Error(`Existing certificate ${cert.CertificateArn} needs reviewed import/reconciliation before a new certificate is created.`);
 }
}
export async function main(args){
 const credentials=parseCredentials(run('aws',['secretsmanager','get-secret-value','--secret-id',secretArn,'--region','af-south-1','--query','SecretString','--output','text','--no-cli-pager']));
 if(process.env.GITHUB_ACTIONS==='true')for(const value of [credentials.API_TOKEN,credentials.ACCOUNT_ID])console.log(`::add-mask::${value}`);
 const inspection=await inspectZone(credentials);
 const env={...process.env,CLOUDFLARE_API_TOKEN:credentials.API_TOKEN,TF_VAR_cloudflare_zone_id:inspection.zoneId};
 // No debug/trace logging of provider HTTP requests, even if inherited locally.
 for(const key of ['TF_LOG','TF_LOG_PROVIDER','TF_LOG_CORE','TF_LOG_PATH','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL'])delete env[key];
 if(args[0]==='--github-env'){
  if(!process.env.GITHUB_ENV)throw Error('GITHUB_ENV required. For local Terraform use --terraform.');
  await appendFile(process.env.GITHUB_ENV,`CLOUDFLARE_API_TOKEN=${credentials.API_TOKEN}\nTF_VAR_cloudflare_zone_id=${inspection.zoneId}\nTF_LOG=OFF\nTF_LOG_PROVIDER=OFF\n`);
 }else if(args[0]==='--check-ownership'){
  const state=JSON.parse(run(process.env.TERRAFORM_BIN??'terraform',['show','-json']));
  const certs=JSON.parse(run('aws',['acm','list-certificates','--region','us-east-1','--includes','keyTypes=RSA_2048,RSA_3072,RSA_4096,EC_prime256v1,EC_secp384r1,EC_secp521r1','--output','json','--no-cli-pager'])).CertificateSummaryList.filter(c=>c.DomainName===domain||c.SubjectAlternativeNameSummaries?.includes(domain));
  checkOwnership(state,certs,inspection.records);
 }else if(args[0]==='--terraform'){
  // This helper deliberately cannot apply/import/destroy or invoke other commands.
  if(!['plan','init','validate','output','show'].includes(args[1]))throw Error('Only non-applying Terraform commands are supported by this helper.');
  const child=spawnSync(process.env.TERRAFORM_BIN??'terraform',args.slice(1),{env,stdio:'inherit',windowsHide:true});
  if(child.status!==0)throw Error('Terraform command did not succeed.');
 }else if(args[0]!=='--check')throw Error('Use --check, --check-ownership, --github-env or --terraform <non-applying command>.');
 console.log(`Verified active ${zoneName} zone and DNS edit permission (read-only); ${inspection.records.length} website record(s). No credentials printed or passed as Terraform variables.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1});
