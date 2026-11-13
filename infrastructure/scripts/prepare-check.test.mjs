import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

test('credential-free prepare catches damaged artifacts and invalid config before deployment',()=>{
 const directory=mkdtempSync(join(tmpdir(),'permissionhub-prepare-'));
 try{
  mkdirSync(join(directory,'artifacts'));
  const manifest={};
  for(const name of ['api','provisioning','expiry','migration']){
   const bytes=Buffer.from(`mocked-${name}-artifact`),hash=createHash('sha256').update(bytes).digest();
   const file=`${name}.zip`;
   writeFileSync(join(directory,'artifacts',file),bytes);
   manifest[name]={file,sourceHash:hash.toString('base64'),sha256:hash.toString('hex'),handler:`dist/lambda/${name}.handler`,key:`lambda/${name}/digest.zip`,zipBytes:bytes.length,uncompressedBytes:100};
  }
  writeFileSync(join(directory,'artifacts','lambda-manifest.json'),JSON.stringify(manifest));
  const env={...process.env,GITHUB_WORKSPACE:directory,DEPLOY_ENV:'dev',AWS_REGION:'af-south-1',AWS_ACCOUNT_ID:'143671530412',STATE_BUCKET:'permissionhub-dev-bucket',STATE_KEY:'permisionhub/dev/backend',LOCK_TABLE:'permissionhub-state-lock',LAMBDA_ARTIFACT_BUCKET:'permissionhub-dev-lambda-artifacts',CI_TF_VARS_JSON:''};
  const run=patch=>spawnSync(process.execPath,[fileURLToPath(new URL('./ci.mjs',import.meta.url)),'prepare-check'],{env:{...env,...patch},encoding:'utf8'});
  assert.equal(run({}).status,0);
  const missing=run({LOCK_TABLE:''});assert.notEqual(missing.status,0);assert.match(missing.stderr,/LOCK_TABLE/);
  assert.notEqual(run({CI_TF_VARS_JSON:'{"environment":"prod"}'}).status,0);
  writeFileSync(join(directory,'artifacts','api.zip'),'corrupt');
  const damaged=run({});assert.notEqual(damaged.status,0);assert.match(damaged.stderr,/integrity check failed: api/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
