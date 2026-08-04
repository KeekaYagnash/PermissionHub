import {afterEach,describe,expect,it,vi} from 'vitest';
import request from 'supertest';
import {app} from '../app.js';
import {env} from '../config/env.js';
import {requests} from '../services/mock.service.js';
import {awsAccountRepository} from '../services/aws-account.repository.js';
import {developmentUsers,identityDomain} from '../services/identity-domain.service.js';
import {IamProvisioningService} from '../services/aws/aws-services.js';
import type {AwsAccountContext,PermissionRequest} from '../types.js';

const accountRecordId='00000000-0000-4000-8000-000000000008';
const account:AwsAccountContext={id:accountRecordId,accountRecordId,tenantId:'tenant_disraptor_dev',accountId:'143671530412',awsAccountNumber:'143671530412',accountName:'Disraptor',accountType:'PRODUCTION',environment:'production',riskTier:'HIGH',region:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',connectionStatus:'CONNECTED',sourceType:'MANUAL',connectionSource:'MANUAL',hasConnection:true,provisioningStatus:'DISABLED',provisioningEnabled:false};
const originalMode=env.AWS_PROVISIONING_MODE;
const addedIds:string[]=[];
const temporaryScopeId=accountRecordId;

afterEach(()=>{
 (env as {AWS_PROVISIONING_MODE:'disabled'|'dry-run'|'live'}).AWS_PROVISIONING_MODE=originalMode;
 for(const id of addedIds.splice(0)){const index=requests.findIndex(item=>item.id===id);if(index>=0)requests.splice(index,1)}
 identityDomain.removeManualAccount(account.tenantId,account.id);
 const approver=developmentUsers.find(item=>item.id==='user_approver_dev');if(approver)approver.memberships[0]!.scopes=approver.memberships[0]!.scopes.filter(scope=>scope.scopeId!==temporaryScopeId);
 vi.restoreAllMocks();
});

function pending(id:string,items:PermissionRequest['items']=[{mode:'SPECIFIC_ACTIONS',generatedPolicyName:`PH-${id}-1`,actions:['s3:ListBucket'],generatedPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['s3:ListBucket'],Resource:'*'}]}}]):PermissionRequest{
 addedIds.push(id);
 return {id,tenantId:account.tenantId,awsAccountId:account.id,requesterUserId:'user_requester_dev',requester:'Permission Requester',approver:'Organisation Admin',title:'List finance bucket',targetType:'USER',targetName:'maya.chen',targetArn:'arn:aws:iam::143671530412:user/maya.chen',items,scope:{type:'ALL',resources:[]},duration:'8 hours',startDate:new Date().toISOString(),expiryDate:new Date(Date.now()+28_800_000).toISOString(),priority:'Normal',justification:'Inspect finance bucket contents for the approved support task.',requiredApprovalStages:['ACCOUNT_APPROVER'],completedApprovalStages:[],status:'Pending approval',submittedAt:new Date().toISOString(),createdAt:new Date().toISOString(),timeline:[]};
}

async function authenticatedAgent(userId='user_org_admin_dev'){
 identityDomain.addManualAccount(account);
 vi.spyOn(awsAccountRepository,'refreshManualAccounts').mockResolvedValue([account]);
 vi.spyOn(awsAccountRepository,'getByRecordId').mockImplementation(async(_tenant,id)=>id===account.id?account:undefined);
 const agent=request.agent(app),session=await agent.get('/api/auth/session').expect(200),login=await agent.post('/api/auth/development-login').set('x-csrf-token',session.body.data.csrfToken).send({userId}).expect(200),csrf=login.body.data.csrfToken;
 await agent.post('/api/aws/active-account').set('x-csrf-token',csrf).send({accountRecordId}).expect(200);
 return {agent,csrf};
}

describe('safe request review HTTP workflow',()=>{
 it('approves with a blank optional comment while provisioning is disabled',async()=>{
  (env as {AWS_PROVISIONING_MODE:'disabled'}).AWS_PROVISIONING_MODE='disabled';
  const item=pending('PR-TEST-DISABLED');requests.unshift(item);
  const attach=vi.spyOn(IamProvisioningService.prototype,'attach'),create=vi.spyOn(IamProvisioningService.prototype,'createCustomerPolicy');
  const {agent,csrf}=await authenticatedAgent();
  const response=await agent.post(`/api/requests/${item.id}/review`).set('x-csrf-token',csrf).send({action:'APPROVE',comment:''}).expect(200);
  expect(response.body.data.request).toMatchObject({status:'Approved'});
  expect(response.body.data.request.approvalComment).toBeUndefined();
  expect(attach).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
 });

 it('approves safely when approve-and-provision is requested in disabled mode',async()=>{
  (env as {AWS_PROVISIONING_MODE:'disabled'}).AWS_PROVISIONING_MODE='disabled';
  const item=pending('PR-TEST-DISABLED-COMBINED');requests.unshift(item);
  const attach=vi.spyOn(IamProvisioningService.prototype,'attach'),create=vi.spyOn(IamProvisioningService.prototype,'createCustomerPolicy');
  const {agent,csrf}=await authenticatedAgent();
  const response=await agent.post(`/api/requests/${item.id}/review`).set('x-csrf-token',csrf).send({action:'APPROVE_AND_PROVISION'}).expect(200);
  expect(response.body.data).toMatchObject({request:{status:'Approved'},provisioning:{mode:'disabled',executed:false,safe:true}});
  expect(attach).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
 });

 it('requires separate provisioning permission for the combined action',async()=>{
  (env as {AWS_PROVISIONING_MODE:'dry-run'}).AWS_PROVISIONING_MODE='dry-run';
  const approver=developmentUsers.find(item=>item.id==='user_approver_dev')!;approver.memberships[0]!.scopes.push({scopeType:'AWS_ACCOUNT',scopeId:temporaryScopeId,includeDescendants:false,canView:true,canRequest:false,canApprove:true,canProvision:false,canRevoke:false,canManageConfiguration:false});
  const item=pending('PR-TEST-NO-PROVISION');requests.unshift(item);
  const {agent,csrf}=await authenticatedAgent('user_approver_dev');
  await agent.post(`/api/requests/${item.id}/review`).set('x-csrf-token',csrf).send({action:'APPROVE_AND_PROVISION'}).expect(403).expect(response=>expect(response.body.error).toMatchObject({code:'PROVISIONING_FORBIDDEN'}));
  expect(item.status).toBe('Pending approval');
 });

 it('approves and produces a non-mutating dry-run plan idempotently',async()=>{
  (env as {AWS_PROVISIONING_MODE:'dry-run'}).AWS_PROVISIONING_MODE='dry-run';
  const item=pending('PR-1008-TEST');requests.unshift(item);
  const attach=vi.spyOn(IamProvisioningService.prototype,'attach'),create=vi.spyOn(IamProvisioningService.prototype,'createCustomerPolicy');
  const {agent,csrf}=await authenticatedAgent(),key='review-operation-1008';
  const first=await agent.post(`/api/requests/${item.id}/review`).set('x-csrf-token',csrf).set('idempotency-key',key).send({action:'APPROVE_AND_PROVISION',comment:'   '}).expect(200);
  expect(first.body.data.request.status).toBe('Approved');
  expect(first.body.data.provisioning).toMatchObject({mode:'dry-run',executed:false,safe:true,targetAccount:'143671530412',plannedOperations:[{operation:'CreatePolicy',executed:false},{operation:'AttachUserPolicy',executed:false}]});
  expect(first.body.data.provisioning.message).toContain('no AWS changes were made');
  const repeated=await agent.post(`/api/requests/${item.id}/review`).set('x-csrf-token',csrf).set('idempotency-key',key).send({action:'APPROVE_AND_PROVISION'}).expect(200);
  expect(repeated.body.idempotent).toBe(true);
  expect(attach).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
 });

 it('returns action-specific comment errors and blocks incomplete plans',async()=>{
  (env as {AWS_PROVISIONING_MODE:'dry-run'}).AWS_PROVISIONING_MODE='dry-run';
  const reject=pending('PR-TEST-REJECT'),information=pending('PR-TEST-INFO'),incomplete=pending('PR-TEST-INCOMPLETE',[{mode:'SPECIFIC_ACTIONS',actions:['s3:ListBucket']}]);requests.unshift(reject,information,incomplete);
  const {agent,csrf}=await authenticatedAgent();
  await agent.post(`/api/requests/${reject.id}/review`).set('x-csrf-token',csrf).send({action:'REJECT',comment:' '}).expect(422).expect(response=>expect(response.body.error).toMatchObject({code:'REVIEW_VALIDATION_ERROR',message:'Provide a reason for rejecting this request.'}));
  await agent.post(`/api/requests/${information.id}/review`).set('x-csrf-token',csrf).send({action:'REQUEST_INFORMATION'}).expect(422).expect(response=>expect(response.body.error).toMatchObject({code:'REVIEW_VALIDATION_ERROR',message:'Explain what additional information is required.'}));
  await agent.post(`/api/requests/${incomplete.id}/review`).set('x-csrf-token',csrf).send({action:'APPROVE_AND_PROVISION'}).expect(422).expect(response=>expect(response.body.error).toMatchObject({code:'INCOMPLETE_PROVISIONING_PLAN'}));
 });
});
