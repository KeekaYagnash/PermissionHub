import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCredentials,inspectZone,checkOwnership,describeAwsFailure,domain,secretArn} from './dev-domain.mjs';
const credentials={API_TOKEN:'mock-token-not-a-real-credential',ACCOUNT_ID:'a'.repeat(32)};
const response=result=>({ok:true,json:async()=>({success:true,result})});
test('secret permission failures identify the bootstrap fix without exposing stderr or credentials',()=>{
 const message=describeAwsFailure(['secretsmanager','get-secret-value'],{stderr:`An error occurred (AccessDeniedException) when calling the GetSecretValue operation: ${credentials.API_TOKEN} ${credentials.ACCOUNT_ID}`});
 assert.match(message,/AWS_ACCESS_DENIED/);assert.match(message,/permissionhub-github-terraform-domain-dev/);assert.match(message,/attachment/);
 assert.ok(!message.includes(credentials.API_TOKEN));assert.ok(!message.includes(credentials.ACCOUNT_ID));
});
test('missing secrets, expired credentials and unknown subprocess failures are sanitized',()=>{
 assert.match(describeAwsFailure(['secretsmanager','get-secret-value'],{stderr:'An error occurred (ResourceNotFoundException) when calling the GetSecretValue operation:'}),/AWS_SECRET_NOT_FOUND/);
 assert.match(describeAwsFailure([],{stderr:'An error occurred (ExpiredToken) when calling the ListCertificates operation:'}),/AWS_CREDENTIALS_EXPIRED/);
 assert.match(describeAwsFailure([],{error:{code:'ENOENT'}}),/AWS_CLI_MISSING/);
 assert.equal(describeAwsFailure([],{stderr:credentials.API_TOKEN}).includes(credentials.API_TOKEN),false);
});
test('repeatable bootstrap discovery recognizes the dev domain policy without detaching it',()=>{
 const script=readFileSync(new URL('./prepare-oidc-bootstrap.ps1',import.meta.url),'utf8');
 assert.match(script,/'discovery','logging','domain'/);
 assert.match(script,/'terraform-logging','terraform-domain','backend'/);
 assert.doesNotMatch(script,/detach-role-policy/);
});
test('requires valid secret fields without echoing malformed secret contents',()=>{
 assert.deepEqual(parseCredentials(JSON.stringify(credentials)),credentials);
 assert.throws(()=>parseCredentials('sensitive-invalid-value'),error=>!error.message.includes('sensitive-invalid-value'));
 assert.throws(()=>parseCredentials(JSON.stringify({...credentials,API_TOKEN:'bad\nvalue'})));
 assert.match(secretArn,/IAMOps-OHd0cA$/);
});
test('checks the exact active zone in the secret account and DNS edit permission using GET only',async()=>{
 const urls=[];
 const result=await inspectZone(credentials,async(url,options)=>{urls.push(url);assert.equal(options.method,undefined);assert.equal(options.headers.Authorization,`Bearer ${credentials.API_TOKEN}`);return urls.length===1?response([{id:'zone',name:'disraptor.co.za',status:'active',permissions:['#dns_records:edit']}]):response([])});
 assert.equal(result.zoneId,'zone');assert.match(urls[0],/account.id=a{32}$/);assert.ok(urls[1].endsWith(domain));
});
test('fails safely for missing, inactive, unauthorized or ambiguous zones',async()=>{
 for(const zones of [[],[{name:'another.example',status:'active'}],[{name:'disraptor.co.za',status:'pending'}],[{name:'disraptor.co.za',status:'active',permissions:[]}]])await assert.rejects(inspectZone(credentials,async()=>response(zones)));
 await assert.rejects(inspectZone(credentials,async()=>({ok:false,json:async()=>({success:false,errors:[credentials]})})),error=>!error.message.includes(credentials.API_TOKEN)&&!error.message.includes(credentials.ACCOUNT_ID));
});
test('unowned existing DNS and certificates require review/import, not overwrite',()=>{
 assert.throws(()=>checkOwnership({},[],[{id:'record'}]),/import/);
 assert.throws(()=>checkOwnership({},[{CertificateArn:'certificate'}],[]),/import/);
 const state={values:{root_module:{resources:[{address:'cloudflare_dns_record.frontend',values:{id:'record'}},{address:'aws_acm_certificate.frontend',values:{arn:'certificate'}}]}}};
 assert.doesNotThrow(()=>checkOwnership(state,[{CertificateArn:'certificate'}],[{id:'record'}]));
 assert.doesNotThrow(()=>checkOwnership({},[],[]));
});
test('credentials never enter Terraform configuration or frontend environment',()=>{
 const root=new URL('../terraform/environments/dev/',import.meta.url);
 for(const path of ['frontend-domain.tf','providers.tf']){
  const code=readFileSync(new URL(path,root),'utf8');
  assert.doesNotMatch(code,/data\s+"aws_secretsmanager_secret_version"|TF_VAR_.*(TOKEN|ACCOUNT_ID)|api_token\s*=/);
 }
 const workflow=readFileSync(new URL('../../.github/workflows/deploy-dev-staged.yml',import.meta.url),'utf8');
 assert.equal((workflow.match(/dev-domain.mjs --github-env/g)??[]).length,2);
 assert.match(workflow,/dev-domain.mjs --check-ownership/);
 assert.match(workflow,/-target=cloudflare_dns_record.frontend/);
 const frontend=readFileSync(new URL('../../.github/workflows/deploy-dev-frontend.yml',import.meta.url),'utf8');
 assert.doesNotMatch(frontend,/CLOUDFLARE|Cloudflare/);
 assert.match(frontend,/VITE_COGNITO_REDIRECT_URI:.*inputs.environment != 'dev'/);
 assert.match(frontend,/VITE_COGNITO_LOGOUT_URI:.*inputs.environment != 'dev'/);
});
