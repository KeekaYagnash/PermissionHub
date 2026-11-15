import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('reviewed dev deployment enables the existing us-east-1 sender, without changing application region',()=>{
 const config=JSON.parse(read('../terraform/environments/dev/ci.tfvars.json'));
 assert.equal(config.aws_region,'af-south-1');
 assert.equal(config.invitation_sender_email,'info@disraptor.co.za');
 assert.equal(config.invitation_ses_identity_arn,'arn:aws:ses:us-east-1:143671530412:identity/info@disraptor.co.za');
});
test('independent runtime boundary permits only SES SendEmail on the two existing identities',()=>{
 const boundary=JSON.parse(read('../terraform/bootstrap/github-dev/policies/runtime-boundary.json.tftpl').replaceAll('${account_id}','143671530412'));
 const statements=boundary.Statement.filter(statement=>statement.Sid==='TransactionalEmailFromExistingIdentities');
 assert.equal(statements.length,1);const statement=statements[0];assert.equal(statement.Effect,'Allow');assert.equal(statement.Action,'ses:SendEmail');
 assert.deepEqual(statement.Resource,['arn:aws:ses:us-east-1:143671530412:identity/info@disraptor.co.za','arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net']);
 assert.deepEqual(statement.Condition.StringLike['ses:FromAddress'],['info@disraptor.co.za','*@disraptor-internal.net']);
 assert.equal(boundary.Statement.find(statement=>statement.Sid==='ProtectCiIdentities').Effect,'Deny');
 assert.equal(boundary.Statement.find(statement=>statement.Sid==='ProtectRuntimeRolePermissions').Effect,'Deny');
});
