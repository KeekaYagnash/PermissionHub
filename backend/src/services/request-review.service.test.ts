import {afterEach,describe,expect,it} from 'vitest';
import {env} from '../config/env.js';
import type {AwsAccountContext,PermissionRequest} from '../types.js';
import {buildProvisioningPlan,parseReviewInput,provisioningMode,reviewCapabilities} from './request-review.service.js';

const originalMode=env.AWS_PROVISIONING_MODE,originalNodeEnv=env.NODE_ENV,originalLocal=env.ALLOW_LOCAL_PROVISIONING;
afterEach(()=>{(env as {AWS_PROVISIONING_MODE:'disabled'|'dry-run'|'live'}).AWS_PROVISIONING_MODE=originalMode;(env as {NODE_ENV:'development'|'test'|'production'}).NODE_ENV=originalNodeEnv;(env as {ALLOW_LOCAL_PROVISIONING:boolean}).ALLOW_LOCAL_PROVISIONING=originalLocal});

const account:AwsAccountContext={id:'00000000-0000-4000-8000-000000000008',tenantId:'tenant_disraptor_dev',accountId:'143671530412',accountName:'Disraptor',accountType:'PRODUCTION',environment:'production',riskTier:'HIGH',region:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',connectionStatus:'CONNECTED',provisioningStatus:'DISABLED',provisioningEnabled:false};
const request=(overrides:Partial<PermissionRequest>={}):PermissionRequest=>({id:'PR-1008',tenantId:account.tenantId,awsAccountId:account.id,requesterUserId:'user_requester_dev',requester:'Permission Requester',approver:'Organisation Admin',title:'List finance bucket',targetType:'USER',targetName:'maya.chen',targetArn:'arn:aws:iam::143671530412:user/maya.chen',items:[{mode:'SPECIFIC_ACTIONS',generatedPolicyName:'PH-PR-1008-1',actions:['s3:ListBucket'],generatedPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['s3:ListBucket'],Resource:'*'}]}}],scope:{type:'ALL',resources:[]},duration:'8 hours',startDate:new Date().toISOString(),expiryDate:new Date(Date.now()+28_800_000).toISOString(),priority:'Normal',justification:'Inspect finance bucket contents for the approved support task.',status:'Pending approval',createdAt:new Date().toISOString(),timeline:[],...overrides});

describe('review action comment validation',()=>{
 it.each(['APPROVE','APPROVE_AND_PROVISION'] as const)('%s accepts an omitted or blank comment',action=>{
  expect(parseReviewInput({action})).not.toHaveProperty('comment');
  expect(parseReviewInput({action,comment:'   '})).not.toHaveProperty('comment');
 });
 it('trims an optional supplied approval comment',()=>expect(parseReviewInput({action:'APPROVE',comment:'  ok  '})).toMatchObject({comment:'ok'}));
 it('reject requires a meaningful reason',()=>expect(()=>parseReviewInput({action:'REJECT',comment:'  '})).toThrow('Provide a reason for rejecting this request.'));
 it('request information requires an explanation',()=>expect(()=>parseReviewInput({action:'REQUEST_INFORMATION'})).toThrow('Explain what additional information is required.'));
});

describe('safe provisioning plan',()=>{
 it('defaults to disabled and does not advertise provisioning',()=>{
  expect(provisioningMode()).toBe('disabled');
  expect(reviewCapabilities({request:request(),account,approvalAllowed:true,provisionPermission:true})).toMatchObject({provisioningAllowed:false,provisioningMode:'disabled'});
 });
 it('describes CreatePolicy before AttachUserPolicy for a specific-action request',()=>{
  const plan=buildProvisioningPlan(request(),account);
  expect(plan.valid).toBe(true);
  expect(plan.policyMode).toBe('GENERATED_CUSTOMER_POLICY');
 expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreatePolicy','AttachUserPolicy']);
  expect(plan.plannedOperations[0]).toMatchObject({policyName:'PH-PR-1008-1',policyPath:'/permissionhub/',policyDocument:expect.any(Object)});
  expect(plan.plannedOperations[1]).toMatchObject({targetName:'maya.chen',targetArn:'arn:aws:iam::143671530412:user/maya.chen'});
  expect(plan.plannedOperations.every(item=>item.executed===false)).toBe(true);
 });
 it('blocks an incomplete generated policy plan',()=>expect(buildProvisioningPlan(request({items:[{mode:'SPECIFIC_ACTIONS',actions:['s3:ListBucket']}]}),account)).toMatchObject({valid:false,errors:expect.arrayContaining([expect.objectContaining({field:'items.0.generatedPolicyDocument'})])}));
 it('reports concrete live-readiness blockers',()=>expect(reviewCapabilities({request:request(),account,approvalAllowed:false,provisionPermission:false,currentUserRoles:['ORGANISATION_ADMIN'],assignedApproverMatch:false})).toMatchObject({requestId:'PR-1008',blockingReasons:expect.arrayContaining(['CURRENT_USER_NOT_ASSIGNED_APPROVER','ACCOUNT_SCOPED_PROVISIONER_REQUIRED','PROVISIONING_DISABLED','PROVISION_ROLE_NOT_CONFIGURED']),requiredApproverRoles:['ACCOUNT_APPROVER'],currentUserRoles:['ORGANISATION_ADMIN'],checklist:expect.arrayContaining([expect.objectContaining({key:'approvalEligibility',passed:false}),expect.objectContaining({key:'planValidation',passed:true})])}));
 it('enables only the Security Reviewer local path in development',()=>{
  (env as {NODE_ENV:'development'}).NODE_ENV='development';(env as {ALLOW_LOCAL_PROVISIONING:boolean}).ALLOW_LOCAL_PROVISIONING=true;
  expect(reviewCapabilities({request:request(),account,approvalAllowed:true,provisionPermission:false,currentUserRoles:['SECURITY_REVIEWER'],assignedApproverMatch:false})).toMatchObject({provisioningMode:'local',localProvisioningEnabled:true,provisioningAllowed:true,canProvision:true,requiredApproverRoles:['SECURITY_REVIEWER'],blockingReasons:expect.not.arrayContaining(['ACCOUNT_SCOPED_PROVISIONER_REQUIRED','PROVISION_ROLE_NOT_CONFIGURED','EXPIRY_REVOCATION_NOT_CONFIGURED'])});
 });
 it('never enables local provisioning in production',()=>{
  (env as {NODE_ENV:'production'}).NODE_ENV='production';(env as {ALLOW_LOCAL_PROVISIONING:boolean}).ALLOW_LOCAL_PROVISIONING=true;
  expect(provisioningMode()).toBe(originalMode);
 });
});
