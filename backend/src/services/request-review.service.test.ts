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
 it('plans AttachUserPolicy once per selected IAM user for direct multi-user access',()=>{
  const plan=buildProvisioningPlan(request({members:[{userName:'maya.chen',userArn:'arn:aws:iam::143671530412:user/maya.chen'},{userName:'yagnash.dev',userArn:'arn:aws:iam::143671530412:user/yagnash.dev'}],items:[{mode:'MANAGED_POLICY',policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['AttachUserPolicy','AttachUserPolicy']);
  expect(plan.plannedOperations.map(item=>item.targetName)).toEqual(['maya.chen','yagnash.dev']);
 });
 it('plans CreateUser before direct policy attachment for new IAM users',()=>{
  const plan=buildProvisioningPlan(request({targetName:'yagi.demo',targetArn:'arn:aws:iam::143671530412:user/permissionhub/yagi.demo',members:[{userName:'yagi.demo',userArn:'arn:aws:iam::143671530412:user/permissionhub/yagi.demo',createUser:true}],items:[{mode:'MANAGED_POLICY',policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateUser','AttachUserPolicy']);
  expect(plan.plannedOperations[0]).toMatchObject({userName:'yagi.demo'});
 });
 it('allows a create-users-only request without policy items',()=>{
  const plan=buildProvisioningPlan(request({targetName:'new.one',targetArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',members:[{userName:'new.one',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',createUser:true}],items:[]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateUser']);
 });
 it('plans one CreateUser per username for create-multiple-users-only requests',()=>{
  const plan=buildProvisioningPlan(request({targetName:'new.one',targetArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',members:[{userName:'new.one',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',createUser:true},{userName:'new.two',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.two',createUser:true}],items:[]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateUser','CreateUser']);
 });
 it('plans CreateUser and AttachUserPolicy for each new user in a direct managed-policy request',()=>{
  const plan=buildProvisioningPlan(request({targetName:'new.one',targetArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',members:[{userName:'new.one',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',createUser:true},{userName:'new.two',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.two',createUser:true}],items:[{mode:'MANAGED_POLICY',policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateUser','CreateUser','AttachUserPolicy','AttachUserPolicy']);
 });
 it('plans CreateUser, CreatePolicy and AttachUserPolicy for a new user with custom policy',()=>{
  const plan=buildProvisioningPlan(request({targetName:'new.one',targetArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',members:[{userName:'new.one',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',createUser:true}],items:[{mode:'SPECIFIC_ACTIONS',generatedPolicyName:'PH-PR-1008-1',actions:['lambda:InvokeFunction'],generatedPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['lambda:InvokeFunction'],Resource:'*'}]}}]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateUser','CreatePolicy','AttachUserPolicy']);
 });
 it('plans CreateRole then AttachRolePolicy for a new role with a managed policy',()=>{
  const plan=buildProvisioningPlan(request({targetType:'ROLE',targetName:'FinanceReportingRole',targetArn:'arn:aws:iam::143671530412:role/permissionhub/FinanceReportingRole',role:{mode:'CREATE',name:'FinanceReportingRole',path:'/permissionhub/',trustedPrincipalType:'SERVICE',trustedPrincipal:'lambda.amazonaws.com',trustPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]}},items:[{mode:'MANAGED_POLICY',policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],duration:'Permanent',expiryDate:undefined}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateRole','AttachRolePolicy']);
 });
 it('plans CreateRole, CreatePolicy and AttachRolePolicy for a new role with custom policy',()=>{
  const plan=buildProvisioningPlan(request({targetType:'ROLE',targetName:'FinanceReportingRole',targetArn:'arn:aws:iam::143671530412:role/permissionhub/FinanceReportingRole',role:{mode:'CREATE',name:'FinanceReportingRole',path:'/permissionhub/',trustedPrincipalType:'AWS',trustedPrincipal:'arn:aws:iam::143671530412:root',trustPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{AWS:'arn:aws:iam::143671530412:root'},Action:'sts:AssumeRole'}]}},items:[{mode:'SPECIFIC_ACTIONS',generatedPolicyName:'PH-PR-1008-1',actions:['s3:ListBucket'],generatedPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['s3:ListBucket'],Resource:'*'}]}}],duration:'Permanent',expiryDate:undefined}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateRole','CreatePolicy','AttachRolePolicy']);
 });
 it('plans AttachRolePolicy for an existing role add-permission update',()=>{
  const plan=buildProvisioningPlan(request({targetType:'ROLE',targetName:'DeploymentRole',targetArn:'arn:aws:iam::143671530412:role/DeploymentRole',role:{mode:'UPDATE',name:'DeploymentRole',updateAction:'ADD_PERMISSIONS'},items:[{mode:'MANAGED_POLICY',policyName:'AWSCloudHSMReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AWSCloudHSMReadOnlyAccess'}],duration:'Permanent',expiryDate:undefined}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['AttachRolePolicy']);
 });
 it('plans DetachRolePolicy for an existing role remove-permission update',()=>{
  const plan=buildProvisioningPlan(request({targetType:'ROLE',targetName:'DeploymentRole',targetArn:'arn:aws:iam::143671530412:role/DeploymentRole',role:{mode:'UPDATE',name:'DeploymentRole',updateAction:'REMOVE_PERMISSIONS'},items:[{mode:'MANAGED_POLICY',operation:'DETACH',policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],duration:'Permanent',expiryDate:undefined}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['DetachRolePolicy']);
 });
 it('plans UpdateAssumeRolePolicy for a trust relationship update',()=>{
  const plan=buildProvisioningPlan(request({targetType:'ROLE',targetName:'DeploymentRole',targetArn:'arn:aws:iam::143671530412:role/DeploymentRole',role:{mode:'UPDATE',name:'DeploymentRole',updateAction:'UPDATE_TRUST',trustedPrincipalType:'SERVICE',trustedPrincipal:'ecs-tasks.amazonaws.com',trustPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'ecs-tasks.amazonaws.com'},Action:'sts:AssumeRole'}]}},items:[],duration:'Permanent',expiryDate:undefined}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['UpdateAssumeRolePolicy']);
 });
 it('allows an existing-group membership-only plan without policy items',()=>{
  const plan=buildProvisioningPlan(request({targetType:'GROUP',targetName:'Finance-ReadOnly',targetArn:'arn:aws:iam::143671530412:group/Finance-ReadOnly',group:{mode:'EXISTING',name:'Finance-ReadOnly'},members:[{userName:'maya.chen',userArn:'arn:aws:iam::143671530412:user/maya.chen'}],items:[]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['AddUserToGroup']);
  expect(plan.plannedOperations[0]).toMatchObject({groupName:'Finance-ReadOnly',userName:'maya.chen'});
 });
 it('plans CreateUser before existing group membership for a new IAM user',()=>{
  const plan=buildProvisioningPlan(request({targetType:'GROUP',targetName:'Finance-ReadOnly',targetArn:'arn:aws:iam::143671530412:group/Finance-ReadOnly',group:{mode:'EXISTING',name:'Finance-ReadOnly'},members:[{userName:'new.reader',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.reader',createUser:true}],items:[]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateUser','AddUserToGroup']);
 });
 it('plans multiple CreateUser operations before existing group membership additions',()=>{
  const plan=buildProvisioningPlan(request({targetType:'GROUP',targetName:'YagiPermsTest',targetArn:'arn:aws:iam::143671530412:group/YagiPermsTest',group:{mode:'EXISTING',name:'YagiPermsTest'},members:[{userName:'new.one',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.one',createUser:true},{userName:'new.two',userArn:'arn:aws:iam::143671530412:user/permissionhub/new.two',createUser:true}],items:[]}),account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateUser','CreateUser','AddUserToGroup','AddUserToGroup']);
 });
 it('describes CreateGroup, CreatePolicy, AttachGroupPolicy and AddUserToGroup for group creation',()=>{
  const groupRequest=request({
   targetType:'GROUP',
   targetName:'DR_DevOps_Test',
   targetArn:'arn:aws:iam::143671530412:group/DR_DevOps_Test',
   group:{mode:'CREATE',name:'DR_DevOps_Test'},
   members:[{userName:'maya.chen',userArn:'arn:aws:iam::143671530412:user/maya.chen',operation:'ADD'}],
   items:[{mode:'SPECIFIC_ACTIONS',generatedPolicyName:'PH-PR-1008-1',actions:['lambda:InvokeFunction'],generatedPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['lambda:InvokeFunction'],Resource:'*'}]}}]
  });
  const plan=buildProvisioningPlan(groupRequest,account);
  expect(plan.valid).toBe(true);
  expect(plan.targetPrincipalType).toBe('GROUP');
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateGroup','CreatePolicy','AttachGroupPolicy','AddUserToGroup']);
  expect(plan.plannedOperations[0]).toMatchObject({targetName:'DR_DevOps_Test',targetArn:'arn:aws:iam::143671530412:group/DR_DevOps_Test'});
  expect(plan.plannedOperations[2]).toMatchObject({targetName:'DR_DevOps_Test',targetArn:'arn:aws:iam::143671530412:group/DR_DevOps_Test'});
 expect(plan.plannedOperations[3]).toMatchObject({groupName:'DR_DevOps_Test',userName:'maya.chen'});
 });
 it('plans CreateGroup, AttachGroupPolicy, CreateUser and AddUserToGroup for new groups with new users and managed policy',()=>{
  const groupRequest=request({targetType:'GROUP',targetName:'Finance-Testers',targetArn:'arn:aws:iam::143671530412:group/permissionhub/Finance-Testers',group:{mode:'CREATE',name:'Finance-Testers'},members:[{userName:'demo.one',userArn:'arn:aws:iam::143671530412:user/permissionhub/demo.one',createUser:true,operation:'ADD'}],items:[{mode:'MANAGED_POLICY',policyName:'AWSCloudHSMReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AWSCloudHSMReadOnlyAccess'}]});
  const plan=buildProvisioningPlan(groupRequest,account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateGroup','AttachGroupPolicy','CreateUser','AddUserToGroup']);
 });
 it('plans CreateGroup, CreatePolicy, AttachGroupPolicy, CreateUser and AddUserToGroup for new groups with new users and custom policy',()=>{
  const groupRequest=request({targetType:'GROUP',targetName:'Finance-Testers',targetArn:'arn:aws:iam::143671530412:group/permissionhub/Finance-Testers',group:{mode:'CREATE',name:'Finance-Testers'},members:[{userName:'demo.one',userArn:'arn:aws:iam::143671530412:user/permissionhub/demo.one',createUser:true,operation:'ADD'}],items:[{mode:'SPECIFIC_ACTIONS',generatedPolicyName:'PH-PR-1008-1',actions:['s3:GetObject'],generatedPolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['s3:GetObject'],Resource:'*'}]}}]});
  const plan=buildProvisioningPlan(groupRequest,account);
  expect(plan.valid).toBe(true);
  expect(plan.plannedOperations.map(item=>item.operation)).toEqual(['CreateGroup','CreatePolicy','AttachGroupPolicy','CreateUser','AddUserToGroup']);
 });
 it('rejects duplicate new IAM users in a single plan',()=>expect(buildProvisioningPlan(request({members:[{userName:'dupe.user',createUser:true},{userName:'Dupe.User',createUser:true}]}),account)).toMatchObject({valid:false,errors:expect.arrayContaining([expect.objectContaining({field:'members'})])}));
 it('requires group metadata and at least one requested group member',()=>{
  expect(buildProvisioningPlan(request({targetType:'GROUP',targetName:'DR_DevOps_Test',targetArn:'arn:aws:iam::143671530412:group/DR_DevOps_Test'}),account)).toMatchObject({valid:false,errors:expect.arrayContaining([expect.objectContaining({field:'group'}),expect.objectContaining({field:'members'})])});
 });
 it('blocks an incomplete generated policy plan',()=>expect(buildProvisioningPlan(request({items:[{mode:'SPECIFIC_ACTIONS',actions:['s3:ListBucket']}]}),account)).toMatchObject({valid:false,errors:expect.arrayContaining([expect.objectContaining({field:'items.0.generatedPolicyDocument'})])}));
 it('reports concrete live-readiness blockers',()=>expect(reviewCapabilities({request:request(),account,approvalAllowed:false,provisionPermission:false,currentUserRoles:['ORGANISATION_ADMIN'],assignedApproverMatch:false})).toMatchObject({requestId:'PR-1008',blockingReasons:expect.arrayContaining(['CURRENT_USER_NOT_ASSIGNED_APPROVER','ACCOUNT_SCOPED_PROVISIONER_REQUIRED','PROVISIONING_DISABLED','PROVISION_ROLE_NOT_CONFIGURED']),requiredApproverRoles:['ACCOUNT_APPROVER'],currentUserRoles:['ORGANISATION_ADMIN'],checklist:expect.arrayContaining([expect.objectContaining({key:'approvalEligibility',passed:false}),expect.objectContaining({key:'planValidation',passed:true})])}));
 it('does not require a provision role for stored access-key accounts',()=>{
  const accessKeyAccount={...account,connectionType:'ACCESS_KEYS' as const,provisioningEnabled:true};
  expect(reviewCapabilities({request:request(),account:accessKeyAccount,approvalAllowed:true,provisionPermission:true}).blockingReasons).not.toContain('PROVISION_ROLE_NOT_CONFIGURED');
 });
 it('bypasses only enterprise authorization blockers in development local mode',()=>{
  (env as {NODE_ENV:'development'}).NODE_ENV='development';(env as {ALLOW_LOCAL_PROVISIONING:boolean}).ALLOW_LOCAL_PROVISIONING=true;
  expect(reviewCapabilities({request:request(),account,approvalAllowed:false,provisionPermission:false,canReview:true,currentUserRoles:['REQUESTER'],selfApprovalBlocked:true,assignedApproverMatch:false})).toMatchObject({provisioningMode:'local',localProvisioningEnabled:true,approvalAllowed:true,provisioningAllowed:true,canApprove:true,canProvision:true,requiredApproverRoles:['DEVELOPMENT_REVIEW'],blockingReasons:expect.not.arrayContaining(['CURRENT_USER_NOT_ELIGIBLE_APPROVER','CURRENT_USER_NOT_ASSIGNED_APPROVER','ACCOUNT_SCOPED_PROVISIONER_REQUIRED','PROVISIONING_MODE_DRY_RUN','PROVISION_ROLE_NOT_CONFIGURED','EXPIRY_REVOCATION_NOT_CONFIGURED','SELF_APPROVAL_BLOCKED'])});
 });
 it('never enables local provisioning in production',()=>{
  (env as {NODE_ENV:'production'}).NODE_ENV='production';(env as {ALLOW_LOCAL_PROVISIONING:boolean}).ALLOW_LOCAL_PROVISIONING=true;
  expect(provisioningMode()).toBe(originalMode);
 });
});
