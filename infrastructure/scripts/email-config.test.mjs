import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('reviewed dev deployment enables the existing us-east-1 sender, without changing application region',()=>{
 const config=JSON.parse(read('../terraform/environments/dev/ci.tfvars.json'));
 assert.equal(config.aws_region,'af-south-1');
 assert.equal(config.invitation_sender_email,'no-reply@disraptor-internal.net');
 assert.equal(config.invitation_ses_identity_arn,'arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net');
});
test('independent runtime boundary permits only SES SendEmail on the two existing identities',()=>{
 const template=read('../terraform/bootstrap/github-dev/policies/runtime-boundary.json.tftpl');
 const boundary=JSON.parse(template.replaceAll('${account_id}','143671530412').replace(/%\{ if allow_existing_disraptor_co_za_ses_domain \}[\s\S]*?%\{ endif \}/g,''));
 const statements=boundary.Statement.filter(statement=>statement.Sid==='TransactionalEmailFromExistingIdentities');
 assert.equal(statements.length,1);const statement=statements[0];assert.equal(statement.Effect,'Allow');assert.equal(statement.Action,'ses:SendEmail');
 assert.deepEqual(statement.Resource,['arn:aws:ses:us-east-1:143671530412:identity/info@disraptor.co.za','arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net']);
 assert.deepEqual(statement.Condition.StringLike['ses:FromAddress'],['info@disraptor.co.za','*@disraptor-internal.net']);
 assert.equal(boundary.Statement.find(statement=>statement.Sid==='ProtectCiIdentities').Effect,'Deny');
 assert.equal(boundary.Statement.find(statement=>statement.Sid==='ProtectRuntimeRolePermissions').Effect,'Deny');
});
test('co.za domain permission is opt-in and never asserted verified by default',()=>{
 const source=read('../terraform/bootstrap/github-dev/main.tf');
 assert.match(source,/variable "allow_existing_disraptor_co_za_ses_domain"\s*\{[\s\S]*?default\s*=\s*false/);
 const template=read('../terraform/bootstrap/github-dev/policies/runtime-boundary.json.tftpl');
 const enabled=JSON.parse(template.replaceAll('${account_id}','143671530412').replace(/%\{ if allow_existing_disraptor_co_za_ses_domain \}([\s\S]*?)%\{ endif \}/g,(_match,fragment)=>fragment));
 const allow=enabled.Statement.find(statement=>statement.Sid==='TransactionalEmailFromExistingIdentities');
 assert.ok(allow.Resource.includes('arn:aws:ses:us-east-1:143671530412:identity/disraptor.co.za'));assert.ok(allow.Condition.StringLike['ses:FromAddress'].includes('no-reply@disraptor.co.za'));
 assert.doesNotMatch(source,/resource\s+"aws_ses/);
});
