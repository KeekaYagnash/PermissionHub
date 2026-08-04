import {z} from 'zod';
import {env,liveProvisioningEnabled} from '../config/env.js';
import type {AwsAccountContext,PermissionRequest} from '../types.js';
import {ApiError} from '../utils/http.js';

export const reviewActions=['APPROVE','APPROVE_AND_PROVISION','REJECT','REQUEST_INFORMATION'] as const;
export type ReviewAction=typeof reviewActions[number];
export type AwsProvisioningMode='disabled'|'dry-run'|'live';
export interface PlannedOperation{service:'iam';operation:'CreatePolicy'|'AttachUserPolicy'|'AttachRolePolicy';executed:false;policyArn?:string;policyName?:string;targetName?:string}
export interface ProvisioningPlan{valid:boolean;policyMode:'MANAGED_POLICY'|'GENERATED_CUSTOMER_POLICY'|'MIXED';targetAccount:string;targetPrincipal:string;targetPrincipalType:'USER'|'ROLE';generatedPolicyNames:string[];plannedOperations:PlannedOperation[];validationResults:{check:string;valid:boolean;message:string}[];errors:{field:string;message:string}[]}

const optionalComment=z.preprocess(value=>{
 if(value===undefined||value===null)return undefined;
 const trimmed=String(value).trim();return trimmed||undefined;
},z.string().min(2,'Approval comments must contain at least 2 characters.').max(2000).optional());
const requiredComment=(message:string)=>z.preprocess(value=>value===undefined||value===null?'':String(value).trim(),z.string().min(2,message).max(2000));

export const reviewSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('APPROVE'),comment:optionalComment,idempotencyKey:z.string().min(8).max(120).optional()}),
 z.object({action:z.literal('APPROVE_AND_PROVISION'),comment:optionalComment,idempotencyKey:z.string().min(8).max(120).optional()}),
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
   const name=item.generatedPolicyName??`PH-${request.id}-${index+1}`;generatedPolicyNames.push(name);
   operations.push({service:'iam',operation:'CreatePolicy',executed:false,policyName:name},{service:'iam',operation:attachOperation,executed:false,policyName:name,targetName:request.targetName});
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

export function reviewCapabilities(input:{request:PermissionRequest;account:AwsAccountContext;approvalAllowed:boolean;provisionPermission:boolean}){
 const mode=provisioningMode(),plan=buildProvisioningPlan(input.request,input.account),provisioningAllowed=input.approvalAllowed&&input.provisionPermission&&mode!=='disabled'&&plan.valid;
 const reason=!input.approvalAllowed?'You are not authorised to approve this request.':!input.provisionPermission?'You do not have provisioning permission for this account.':mode==='disabled'?'Live provisioning is disabled for this environment.':!plan.valid?'The request does not contain a complete IAM provisioning plan.':mode==='dry-run'?'Dry-run validation is available; no AWS changes will be made.':liveProvisioningEnabled?'Live provisioning is enabled and requires confirmation.':'Live provisioning safety flags are incomplete.';
 return {approvalAllowed:input.approvalAllowed,provisioningAllowed:mode==='live'?provisioningAllowed&&liveProvisioningEnabled:provisioningAllowed,provisioningMode:mode,reason,planValid:plan.valid,plannedOperations:plan.plannedOperations,blockingFields:plan.errors};
}

export function dryRunResult(request:PermissionRequest,plan:ProvisioningPlan){return {requestId:request.id,approvalStatus:'APPROVED',provisioning:{mode:'dry-run' as const,executed:false,safe:plan.valid,targetAccount:plan.targetAccount,targetPrincipal:plan.targetPrincipal,plannedOperations:plan.plannedOperations,validationResults:plan.validationResults,message:'Request approved. Provisioning plan validated; no AWS changes were made.'}}}
