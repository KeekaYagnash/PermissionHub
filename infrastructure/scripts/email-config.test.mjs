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
test('shared runtime boundary permits only the exact internal-domain no-reply sender',()=>{
 const source=read('../terraform/bootstrap/github-dev/main.tf');
 const boundary=JSON.parse(read('../terraform/bootstrap/github-dev/policies/runtime-boundary.json.tftpl').replaceAll('${account_id}','143671530412'));
 const statements=boundary.Statement.filter(statement=>[statement.Action].flat().some(action=>action.startsWith('ses:')));
 assert.deepEqual(statements,[{
  Sid:'TransactionalEmailFromExistingIdentities',Effect:'Allow',Action:'ses:SendEmail',
  Resource:'arn:aws:ses:us-east-1:143671530412:identity/disraptor-internal.net',
  Condition:{StringEquals:{'ses:FromAddress':'no-reply@disraptor-internal.net'}}
 }]);
 assert.doesNotMatch(source,/allow_existing_disraptor_co_za_ses_domain/);
 assert.equal(boundary.Statement.find(statement=>statement.Sid==='ProtectCiIdentities').Effect,'Deny');
 assert.equal(boundary.Statement.find(statement=>statement.Sid==='ProtectRuntimeRolePermissions').Effect,'Deny');
});
test('Lambda rule ownership remains standalone without inline or duplicate HTTPS egress',()=>{
 const security=read('../terraform/modules/security/main.tf');
 // Strip comments so documentation about forbidden configurations is not treated as configuration.
 const code=security.replace(/#.*$/gm,'');
 const group=code.split('resource "aws_security_group" "lambda" {')[1].split('resource ')[0];
 assert.doesNotMatch(group,/\begress\s*(?:=|\{)/);
 assert.equal((code.match(/resource "aws_security_group_rule" "lambda_egress/g)??[]).length,1);
 assert.match(code,/resource "aws_security_group_rule" "lambda_egress_all"\s*\{[^}]*protocol\s*=\s*"-1"[^}]*cidr_blocks\s*=\s*\["0\.0\.0\.0\/0"\]/);
});
