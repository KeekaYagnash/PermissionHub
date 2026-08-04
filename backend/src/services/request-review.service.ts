import {z} from 'zod';
import {env,liveProvisioningEnabled,liveTestAllowedPrincipals} from '../config/env.js';
import type {AppRole,AwsAccountContext,PermissionRequest} from '../types.js';
import {ApiError} from '../utils/http.js';

export const reviewActions=['APPROVE','APPROVE_AND_PROVISION','REJECT','REQUEST_INFORMATION'] as const;
export type ReviewAction=typeof reviewActions[number];
export type AwsProvisioningMode='disabled'|'dry-run'|'live';
export interface PlannedOperation{service:'iam';operation:'CreatePolicy'|'AttachUserPolicy'|'AttachRolePolicy';executed:false;policyArn?:string;policyName?:string;policyPath?:'/permissionhub/';policyDocument?:Record<string,unknown>;targetName?:string;targetArn?:string}
export interface ProvisioningPlan{valid:boolean;policyMode:'MANAGED_POLICY'|'GENERATED_CUSTOMER_POLICY'|'MIXED';targetAccount:string;targetPrincipal:string;targetPrincipalType:'USER'|'ROLE';generatedPolicyNames:string[];plannedOperations:PlannedOperation[];validationResults:{check:string;valid:boolean;message:string}[];errors:{field:string;message:string}[]}

const optionalComment=z.preprocess(value=>{
 if(value===undefined||value===null)return undefined;
 const trimmed=String(value).trim();return trimmed||undefined;
},z.string().min(2,'Approval comments must contain at least 2 characters.').max(2000).optional());
const requiredComment=(message:string)=>z.preprocess(value=>value===undefined||value===null?'':String(value).trim(),z.string().min(2,message).max(2000));

export const reviewSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('APPROVE'),comment:optionalComment,idempotencyKey:z.string().min(8).max(120).optional()}),
 z.object({action:z.literal('APPROVE_AND_PROVISION'),comment:optionalComment,idempotencyKey:z.string().min(8).max(120).optional(),confirmation:z.object({phrase:z.string().min(1),safeTargetConfirmed:z.literal(true),awsMutationConfirmed:z.literal(true),manualCleanupAccepted:z.boolean().optional()}).optional()}),
 z.object({action:z.literal('REJECT'),comment:requiredComment('Provide a reason for rejecting this request.'),idempotencyKey:z.string().min(8).max(120).optional()}),
 z.object({action:z.literal('REQUEST_INFORMATION'),comment:requiredComment('Explain what additional information is required.'),idempotencyKey:z.string().min(8).max(120).optional()}),
]);
export type ReviewInput=z.infer<typeof reviewSchema>;

export function parseReviewInput(value:unknown):ReviewInput{
 const parsed=reviewSchema.safeParse(value);if(parsed.success){const {comment,...input}=parsed.data;return comment===undefined?input as ReviewInput:{...input,comment} as ReviewInput}
 const issue=parsed.error.issues[0],action=(value as {action?:string}|undefined)?.action;
 const fallback=action==='REJECT'?'Provide a reason for rejecting this request.':action==='REQUEST_INFORMATION'?'Explain what additional information is required.':issue?.message??'Review action validation failed.';
 throw new ApiError(422,fallback,'REVIEW_VALIDATION_ERROR',{blockingFields:parsed.error.issues.map(item=>({field:item.path.join('.'),message:item.message})),recommendedAction:action==='REJECT'||action==='REQUEST_INFORMATION'?'Enter a review comment and try again.':'Correct the review action and try again.'});
}

export function provisioningMode():AwsProvisioningMode{return env.AWS_PROVISIONING_MODE}

export function buildProvisioningPlan(request:PermissionRequest,account:AwsAccountContext):ProvisioningPlan{
 const errors:{field:string;message:string}[]=[],operations:PlannedOperation[]=[],generatedPolicyNames:string[]=[];
 if(!['USER','ROLE'].includes(request.targetType))errors.push({field:'targetType',message:'The target principal type is not supported for IAM provisioning.'});
 if(!request.targetName.trim())errors.push({field:'targetName',message:'The target principal name is missing.'});
 if(!request.targetArn.startsWith('arn:aws:iam::'))errors.push({field:'targetArn',message:'The target principal ARN is invalid.'});
 if(!request.targetArn.includes(`::${account.accountId}:`))errors.push({field:'targetArn',message:'The target principal belongs to a different AWS account.'});
 if(!request.scope?.type)errors.push({field:'scope',message:'The resource scope is missing.'});
 if(request.awsAccountId&&request.awsAccountId!==account.id&&request.awsAccountId!==account.accountId)errors.push({field:'awsAccountId',message:'The active AWS account does not match the request account.'});
 request.items.forEach((item,index)=>{
  const attachOperation=request.targetType==='USER'?'AttachUserPolicy':'AttachRolePolicy';
  if(item.mode==='MANAGED_POLICY'){
   if(!item.policyArn)errors.push({field:`items.${index}.policyArn`,message:'Managed-policy attachment requires a policy ARN.'});
   else if(item.policyArn.endsWith('/AdministratorAccess'))errors.push({field:`items.${index}.policyArn`,message:'AdministratorAccess provisioning is blocked.'});
   else operations.push({service:'iam',operation:attachOperation,executed:false,policyArn:item.policyArn,targetName:request.targetName});
  }else{
   const statements=(item.generatedPolicyDocument as {Statement?:unknown}|undefined)?.Statement;
   if(!item.generatedPolicyDocument||!Array.isArray(statements)||statements.length===0)errors.push({field:`items.${index}.generatedPolicyDocument`,message:'A reviewed generated policy document is required.'});
   if(!item.actions?.length)errors.push({field:`items.${index}.actions`,message:'At least one requested IAM action is required.'});
   const name=item.generatedPolicyName??`PH-${request.id}-${index+1}`;if(!/^[\w+=,.@-]{1,128}$/.test(name))errors.push({field:`items.${index}.generatedPolicyName`,message:'The generated IAM policy name is invalid.'});generatedPolicyNames.push(name);
   operations.push({service:'iam',operation:'CreatePolicy',executed:false,policyName:name,policyPath:'/permissionhub/',policyDocument:item.generatedPolicyDocument},{service:'iam',operation:attachOperation,executed:false,policyName:name,targetName:request.targetName,targetArn:request.targetArn});
  }
 });
 if(!request.items.length)errors.push({field:'items',message:'The request does not contain any permission items.'});
 const modes=new Set(request.items.map(item=>item.mode)),policyMode=modes.size>1?'MIXED':modes.has('SPECIFIC_ACTIONS')?'GENERATED_CUSTOMER_POLICY':'MANAGED_POLICY';
 return {valid:errors.length===0,policyMode,targetAccount:account.accountId,targetPrincipal:request.targetArn,targetPrincipalType:request.targetType,generatedPolicyNames,plannedOperations:operations,errors,validationResults:[
  {check:'active-account',valid:!errors.some(error=>error.field==='awsAccountId'),message:'Active AWS account matches the request.'},
  {check:'target-principal',valid:!errors.some(error=>error.field.startsWith('target')),message:'Target principal metadata is complete.'},
  {check:'policy-plan',valid:!errors.some(error=>error.field.startsWith('items')),message:'IAM operation plan is complete.'},
  {check:'resource-scope',valid:!errors.some(error=>error.field==='scope'),message:'Resource scope is present.'},
 ]};
}

export function reviewCapabilities(input:{request:PermissionRequest;account:AwsAccountContext;approvalAllowed:boolean;provisionPermission:boolean;canReview?:boolean;currentUserRoles?:AppRole[];selfApprovalBlocked?:boolean;assignedApproverMatch?:boolean}){
 const mode=provisioningMode(),plan=buildProvisioningPlan(input.request,input.account),requiredApproverRoles=(input.request.requiredApprovalStages??['ACCOUNT_APPROVER']).filter(stage=>stage!=='PROVISIONER'),currentUserRoles=input.currentUserRoles??[],provisionRoleValidated=input.account.provisionRoleStatus==='VALIDATED',safeTarget=liveTestAllowedPrincipals.length===0||liveTestAllowedPrincipals.includes(input.request.targetArn),expiryConfigured=!input.request.expiryDate||env.EXPIRY_REVOCATION_MODE==='worker'||(input.account.accountType!=='PRODUCTION'&&env.EXPIRY_REVOCATION_MODE==='manual'),liveFlagsReady=liveProvisioningEnabled&&Boolean(input.account.provisioningEnabled),blockingReasons:string[]=[];
 if(input.selfApprovalBlocked)blockingReasons.push('SELF_APPROVAL_BLOCKED');
 if(input.assignedApproverMatch===false)blockingReasons.push('CURRENT_USER_NOT_ASSIGNED_APPROVER');
 if(!input.approvalAllowed&&!input.selfApprovalBlocked&&input.assignedApproverMatch!==false)blockingReasons.push('CURRENT_USER_NOT_ELIGIBLE_APPROVER');
 if(!input.provisionPermission)blockingReasons.push('ACCOUNT_SCOPED_PROVISIONER_REQUIRED');
 if(mode==='disabled')blockingReasons.push('PROVISIONING_DISABLED');
 if(mode==='dry-run')blockingReasons.push('PROVISIONING_MODE_DRY_RUN');
 if(mode==='live'&&!liveFlagsReady)blockingReasons.push('LIVE_PROVISIONING_FLAGS_INCOMPLETE');
 if(!input.account.provisionRoleArn)blockingReasons.push('PROVISION_ROLE_NOT_CONFIGURED');else if(!provisionRoleValidated)blockingReasons.push('PROVISION_ROLE_NOT_VALIDATED');
 if(!plan.valid)blockingReasons.push('PROVISIONING_PLAN_INVALID');
 if(!safeTarget)blockingReasons.push('LIVE_TEST_TARGET_NOT_ALLOWED');
 if(!expiryConfigured)blockingReasons.push('EXPIRY_REVOCATION_NOT_CONFIGURED');
 const provisioningAllowed=input.approvalAllowed&&input.provisionPermission&&plan.valid&&(mode==='dry-run'||mode==='live'&&liveFlagsReady&&provisionRoleValidated&&safeTarget&&expiryConfigured);
 const reason=blockingReasons.length?blockingReasons[0]!:mode==='live'?'Live provisioning is enabled and requires explicit confirmation.':'Dry-run validation is available; no AWS changes will be made.';
 const checklist=[
  {key:'approvalEligibility',label:'Eligible approver',passed:input.approvalAllowed,reason:input.approvalAllowed?undefined:'Assign the required reviewer role or reassign the request.'},
  {key:'provisioningPermission',label:'Account-scoped Provisioner',passed:input.provisionPermission,reason:input.provisionPermission?undefined:'Grant PROVISIONER for this AWS account.'},
  {key:'provisioningMode',label:mode==='live'?'Live':'Live provisioning mode',passed:mode==='live',reason:mode==='live'?undefined:`Current mode is ${mode}.`},
  {key:'provisionRole',label:'Provision role validated',passed:provisionRoleValidated,reason:provisionRoleValidated?undefined:'Configure and validate the separate provision role.'},
  {key:'planValidation',label:'Provisioning plan valid',passed:plan.valid,reason:plan.valid?undefined:'Complete the IAM operation plan.'},
  {key:'safeTarget',label:'Approved test target',passed:safeTarget,reason:safeTarget?undefined:'Select a principal from the live-test allowlist.'},
  {key:'expiryHandling',label:'Expiry handling configured',passed:expiryConfigured,reason:expiryConfigured?undefined:'Configure a tested expiry worker before production temporary access.'},
 ];
 return {requestId:input.request.id,canReview:input.canReview??true,canApprove:input.approvalAllowed,canProvision:input.provisionPermission,approvalAllowed:input.approvalAllowed,provisioningAllowed,provisioningMode:mode,reason,blockingReasons,requiredApproverRoles,currentUserRoles,checklist,planValid:plan.valid,plannedOperations:plan.plannedOperations,blockingFields:plan.errors,liveTestAllowedPrincipals,provisionRoleStatus:input.account.provisionRoleStatus??'NOT_VALIDATED',expiryRevocationMode:env.EXPIRY_REVOCATION_MODE,selfApprovalAllowed:env.NODE_ENV!=='production'&&env.ALLOW_DEV_SELF_APPROVAL};
}

export function dryRunResult(request:PermissionRequest,plan:ProvisioningPlan){return {requestId:request.id,approvalStatus:'APPROVED',provisioning:{mode:'dry-run' as const,executed:false,safe:plan.valid,targetAccount:plan.targetAccount,targetPrincipal:plan.targetPrincipal,plannedOperations:plan.plannedOperations,validationResults:plan.validationResults,message:'Request approved. Provisioning plan validated; no AWS changes were made.'}}}
