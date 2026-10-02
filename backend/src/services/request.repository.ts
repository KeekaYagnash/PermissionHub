import type {Prisma,Request as DbRequest,RequestItem as DbRequestItem,RequestStatus as DbRequestStatus,TargetType as DbTargetType} from '@prisma/client';
import {prisma} from '../config/database.js';
import { logger } from '../config/logger.js';
import type {AccountType,PermissionRequest,PermissionRequestItem,RequestStatus,SessionUser} from '../types.js';
import { ApiError } from '../utils/http.js';
import {requests as memoryRequests} from './mock.service.js';

type JsonObject=Record<string,unknown>;

const statusToDb:Record<RequestStatus,DbRequestStatus>={
 'Draft':'DRAFT',
 'Pending approval':'PENDING_APPROVAL',
 'More information required':'MORE_INFORMATION_REQUIRED',
 'Approved':'APPROVED',
 'Rejected':'REJECTED',
 'Provisioning':'PROVISIONING',
 'Provisioned':'PROVISIONED',
 'Provisioning failed':'PROVISIONING_FAILED',
 'Expired':'EXPIRED',
 'Revoked':'REVOKED'
};
const statusFromDb:Record<DbRequestStatus,RequestStatus>={
 DRAFT:'Draft',
 PENDING_APPROVAL:'Pending approval',
 MORE_INFORMATION_REQUIRED:'More information required',
 APPROVED:'Approved',
 REJECTED:'Rejected',
 PROVISIONING:'Provisioning',
 PROVISIONED:'Provisioned',
 PROVISIONING_FAILED:'Provisioning failed',
 EXPIRED:'Expired',
 REVOKED:'Revoked'
};

function targetToDb(value:PermissionRequest['targetType']):DbTargetType{return value==='GROUP'?'IAM_GROUP':value}
function targetFromDb(value:DbTargetType):PermissionRequest['targetType']{return value==='IAM_GROUP'?'GROUP':value==='ROLE'?'ROLE':'USER'}
function json<T>(value:T):T{return value===undefined?value:JSON.parse(JSON.stringify(value)) as T}
function dbJson(value:unknown):Prisma.InputJsonValue|undefined{return value===undefined?undefined:JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue}
function date(value:string|undefined){return value?new Date(value):undefined}
function iso(value:Date|null|undefined){return value?.toISOString()}
function list<T>(value:unknown):T[]{return Array.isArray(value)?value as T[]:[]}
function object<T extends JsonObject>(value:unknown):T|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as T:undefined}

function toDomain(row:DbRequest&{items:DbRequestItem[]}):PermissionRequest{
 return {
  id:row.id,title:row.title,tenantId:row.tenantId??undefined,awsOrganisationId:row.awsOrganisationId??undefined,ouId:row.ouId??undefined,awsAccountId:row.awsAccountId??undefined,accountType:row.accountType as AccountType|undefined,requesterUserId:row.requesterUserId??undefined,requester:row.requester,approver:row.approver,approverUserId:row.approverUserId??undefined,targetSubjectType:row.targetSubjectType?targetFromDb(row.targetSubjectType):undefined,targetType:targetFromDb(row.targetType),targetName:row.targetName,targetArn:row.targetArn,group:object(row.group),role:object(row.role),members:list(row.members),approvalPolicyId:row.approvalPolicyId??undefined,requiredApprovalStages:list<string>(row.requiredApprovalStages),completedApprovalStages:list<string>(row.completedApprovalStages),provisioningAccountId:row.provisioningAccountId??undefined,provisioningRoleArn:row.provisioningRoleArn??undefined,items:row.items.map(toDomainItem),scope:object(row.scope) as PermissionRequest['scope']??{type:'ALL',resources:[]},duration:row.duration,startDate:row.startDate.toISOString(),expiryDate:iso(row.expiryDate),priority:row.priority as PermissionRequest['priority'],justification:row.justification,notes:row.notes??undefined,status:statusFromDb[row.status],submittedAt:iso(row.submittedAt),createdAt:row.createdAt.toISOString(),approvalComment:row.approvalComment??undefined,provisioningResult:row.provisioningResult??undefined,simulationResult:row.simulationResult??undefined,timeline:list(row.timeline)
 };
}

function toDomainItem(row:DbRequestItem):PermissionRequestItem{
 return {mode:row.mode==='SPECIFIC_ACTIONS'?'SPECIFIC_ACTIONS':'MANAGED_POLICY',operation:row.operation as PermissionRequestItem['operation'],policyArn:row.policyArn??undefined,policyName:row.policyName??undefined,generatedPolicyName:row.generatedPolicyName??undefined,requestedPolicyName:row.requestedPolicyName??undefined,actions:row.actions,generatedPolicyDocument:object(row.generatedPolicyDocument)};
}

function tenantAcronym(name:string|undefined){
 const clean=(name??'ORG').replace(/[^A-Za-z0-9 ]/g,' ').trim();
 const parts=clean.split(/\s+/).filter(Boolean);
 const raw=parts.length>1?parts.map(part=>part[0]).join(''):clean.slice(0,3);
 return (raw||'ORG').toUpperCase().slice(0,6);
}

function useMemoryOnly(){return process.env.VITEST==='true'||process.env.NODE_ENV==='test'}
function persistenceError(operation:string,error:unknown){
 logger.error({err:error,operation},'Permission request persistence failed');
 return new ApiError(500,'PermissionHub could not persist the permission request. No request was created.','REQUEST_PERSISTENCE_FAILED',{operation});
}

export const requestRepository={
 async list(input:{tenantId:string;accountId:string;accountNumber:string;user:SessionUser}){
  if(useMemoryOnly())return memoryRequests;
  try{
   const rows=await prisma.request.findMany({where:{tenantId:input.tenantId,OR:[{awsAccountId:input.accountId},{awsAccountId:input.accountNumber},{awsAccountId:null}]},include:{items:true},orderBy:{createdAt:'desc'}});
   return rows.map(toDomain);
  }catch(error){throw persistenceError('request.list',error)}
 },
 async find(id:string){
  if(useMemoryOnly())return memoryRequests.find(item=>item.id===id);
  try{const row=await prisma.request.findUnique({where:{id},include:{items:true}});return row?toDomain(row):undefined}catch(error){throw persistenceError('request.find',error)}
 },
 async nextId(tenantName:string|undefined){
  const prefix=`${tenantAcronym(tenantName)}-PR`;
  if(useMemoryOnly()){const max=memoryRequests.reduce((current,request)=>Math.max(current,Number(request.id.match(/^([A-Z0-9]+-)?PR-(\d+)$/)?.[2]??0)),1000);return `${prefix}-${max+1}`}
  try{
   const rows=await prisma.request.findMany({where:{id:{startsWith:`${prefix}-`}},select:{id:true},take:500,orderBy:{createdAt:'desc'}});
   const max=rows.reduce((current,row)=>Math.max(current,Number(row.id.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1]??0)),1000);
   return `${prefix}-${max+1}`;
  }catch(error){throw persistenceError('request.nextId',error)}
 },
 async create(request:PermissionRequest){
  if(useMemoryOnly()){memoryRequests.unshift(request);return request}
  try{
   await prisma.request.create({data:{id:request.id,title:request.title,tenantId:request.tenantId,awsOrganisationId:request.awsOrganisationId,ouId:request.ouId,awsAccountId:request.awsAccountId,accountType:request.accountType,requesterUserId:request.requesterUserId,requester:request.requester,approver:request.approver,approverUserId:request.approverUserId,targetSubjectType:request.targetSubjectType?targetToDb(request.targetSubjectType):undefined,targetType:targetToDb(request.targetType),targetName:request.targetName,targetArn:request.targetArn,permissionSource:undefined,group:dbJson(request.group),role:dbJson(request.role),members:dbJson(request.members),scope:dbJson(request.scope)!,duration:request.duration,startDate:new Date(request.startDate),expiryDate:date(request.expiryDate),priority:request.priority,justification:request.justification,notes:request.notes,approvalPolicyId:request.approvalPolicyId,requiredApprovalStages:dbJson(request.requiredApprovalStages),completedApprovalStages:dbJson(request.completedApprovalStages),provisioningAccountId:request.provisioningAccountId,provisioningRoleArn:request.provisioningRoleArn,status:statusToDb[request.status],approvalComment:request.approvalComment,provisioningResult:dbJson(request.provisioningResult),simulationResult:dbJson(request.simulationResult),timeline:dbJson(request.timeline)!,submittedAt:date(request.submittedAt),createdAt:new Date(request.createdAt),items:{create:request.items.map(item=>({mode:item.mode,operation:item.operation,policyArn:item.policyArn,policyName:item.policyName,generatedPolicyName:item.generatedPolicyName,requestedPolicyName:item.requestedPolicyName,actions:item.actions??[],generatedPolicyDocument:dbJson(item.generatedPolicyDocument)}))}}});
  }catch(error){throw persistenceError('request.create',error)}
  return request;
 },
 async save(request:PermissionRequest){
  if(useMemoryOnly()){const index=memoryRequests.findIndex(item=>item.id===request.id);if(index>=0)memoryRequests[index]=request;else memoryRequests.unshift(request);return request}
  try{
   await prisma.$transaction(async tx=>{
    await tx.request.update({where:{id:request.id},data:{title:request.title,approver:request.approver,approverUserId:request.approverUserId,targetName:request.targetName,targetArn:request.targetArn,group:dbJson(request.group),role:dbJson(request.role),members:dbJson(request.members),scope:dbJson(request.scope)!,duration:request.duration,startDate:new Date(request.startDate),expiryDate:date(request.expiryDate),priority:request.priority,justification:request.justification,notes:request.notes,requiredApprovalStages:dbJson(request.requiredApprovalStages),completedApprovalStages:dbJson(request.completedApprovalStages),status:statusToDb[request.status],approvalComment:request.approvalComment,provisioningResult:dbJson(request.provisioningResult),simulationResult:dbJson(request.simulationResult),timeline:dbJson(request.timeline)!,submittedAt:date(request.submittedAt)}});
    await tx.requestItem.deleteMany({where:{requestId:request.id}});
    if(request.items.length)await tx.requestItem.createMany({data:request.items.map(item=>({requestId:request.id,mode:item.mode,operation:item.operation,policyArn:item.policyArn,policyName:item.policyName,generatedPolicyName:item.generatedPolicyName,requestedPolicyName:item.requestedPolicyName,actions:item.actions??[],generatedPolicyDocument:dbJson(item.generatedPolicyDocument)}))});
   });
  }catch(error){throw persistenceError('request.save',error)}
  return request;
 }
};
