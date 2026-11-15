import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../config/database.js';
import {identityDomain,loadDevelopmentRoleGrants} from './identity-domain.service.js';
import {awsAccountRepository} from './aws-account.repository.js';
import {requestRepository} from './request.repository.js';
import {RequestNotificationService,type NotificationDirectory,type NotificationStore} from './request-notification.service.js';

const payloadSchema=z.object({organization:z.string(),reason:z.string().optional()});
const eventSchema=z.enum(['REVIEW_REQUIRED','APPROVED','REJECTED','PROVISIONED','PROVISIONING_FAILED']);
const dueWhere=()=>({attempts:{lt:5},OR:[{status:{in:['PENDING','FAILED']},nextAttemptAt:{lte:new Date()}},{status:'SENDING',leaseUntil:{lt:new Date()}}]});
export const notificationStore:NotificationStore={
 async enqueue(record){await prisma.emailNotification.upsert({where:{id:record.id},update:{},create:{...record,payload:record.payload as Prisma.InputJsonObject}})},
 async due(tenantId,requestId,limit=20){const rows=await prisma.emailNotification.findMany({where:{...dueWhere(),...(tenantId?{tenantId}:{}),...(requestId?{requestId}:{})},select:{id:true},orderBy:{createdAt:'asc'},take:Math.min(limit,100)});return rows.map(row=>row.id)},
 async claim(id){
  const result=await prisma.emailNotification.updateMany({where:{id,...dueWhere()},data:{status:'SENDING',attempts:{increment:1},leaseUntil:new Date(Date.now()+60_000)}});
  if(result.count!==1)return;
  const row=await prisma.emailNotification.findUniqueOrThrow({where:{id}});
  return {id:row.id,tenantId:row.tenantId,requestId:row.requestId,recipientUserId:row.recipientUserId,event:eventSchema.parse(row.event),payload:payloadSchema.parse(row.payload)};
 },
 async finish(id,status,messageId){const row=await prisma.emailNotification.findUniqueOrThrow({where:{id},select:{attempts:true}});await prisma.emailNotification.update({where:{id},data:{status,messageId,sentAt:status==='SENT'?new Date():undefined,leaseUntil:null,nextAttemptAt:new Date(Date.now()+Math.min(3600,30*2**row.attempts)*1000)}})}
};
export const notificationDirectory:NotificationDirectory={
 async request(id){return requestRepository.find(id)},
 async load(request){
  if(!request.tenantId||!request.awsAccountId)throw new Error('Notification requires tenant and account context.');
  const account=await awsAccountRepository.getByRecordId(request.tenantId,request.awsAccountId);
  if(!account||account.tenantId!==request.tenantId)throw new Error('Notification account is unavailable.');
  // Never reclassify discovered/legacy accounts as manual just to send an email.
  if(account.sourceType==='MANUAL')identityDomain.addManualAccount(account);
  else if(!identityDomain.allAccounts().some(item=>item.tenantId===account.tenantId&&item.id===account.id))throw new Error('Account authorization context is unavailable.');
  const rows=await prisma.tenantMembership.findMany({where:{tenantId:request.tenantId,status:'ACTIVE',tenant:{status:'ACTIVE'},user:{status:'ACTIVE'}},include:{tenant:true,user:true,adminScopes:true}});
  const users=[];
  for(const row of rows){const user=identityDomain.sessionUser({id:row.userId,email:row.user.email,displayName:row.user.displayName,providerSubject:row.userId,memberships:[{id:row.id,tenantId:row.tenantId,tenantName:row.tenant.name,tenantSlug:row.tenant.slug,role:row.role,status:row.status,scopes:row.adminScopes}]},'directory');await loadDevelopmentRoleGrants(user);users.push(user)}
  return {organization:rows[0]?.tenant.name??'Your organization',users};
 }
};
export const requestNotifications=new RequestNotificationService(notificationStore,notificationDirectory);
