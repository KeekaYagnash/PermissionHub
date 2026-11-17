import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCredentials,inspectZone,checkOwnership,domain,secretArn} from './dev-domain.mjs';
const credentials={API_TOKEN:'mock-token-not-a-real-credential',ACCOUNT_ID:'a'.repeat(32)};
const response=result=>({ok:true,json:async()=>({success:true,result})});
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
