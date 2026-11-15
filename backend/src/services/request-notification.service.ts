import {createHash} from 'node:crypto';
import {env} from '../config/env.js';
import {logger} from '../config/logger.js';
import {authorization} from './authorization.service.js';
import {EmailService} from './email.service.js';
import {applicationLink,renderNotification,type NotificationView} from './email-template.js';
import type {PermissionRequest,SessionUser} from '../types.js';

export type RequestEmailEvent='REVIEW_REQUIRED'|'APPROVED'|'REJECTED'|'PROVISIONED'|'PROVISIONING_FAILED';
export interface NotificationRecord {id:string;tenantId:string;requestId:string;recipientUserId:string;event:RequestEmailEvent;payload:{organization:string;reason?:string}}
export interface NotificationStore {
 enqueue(record:NotificationRecord):Promise<void>;
 due(tenantId?:string,requestId?:string,limit?:number):Promise<string[]>;
 claim(id:string):Promise<NotificationRecord|undefined>;
 finish(id:string,status:'SENT'|'FAILED'|'CANCELLED',messageId?:string):Promise<void>;
}
export interface NotificationDirectory {load(request:PermissionRequest):Promise<{organization:string;users:SessionUser[]}>;request(id:string):Promise<PermissionRequest|undefined>}

export function eventForRequest(request:PermissionRequest):RequestEmailEvent|undefined{
 const events:Partial<Record<PermissionRequest['status'],RequestEmailEvent>>={'Pending approval':'REVIEW_REQUIRED',Approved:'APPROVED',Rejected:'REJECTED',Provisioned:'PROVISIONED','Provisioning failed':'PROVISIONING_FAILED'};
 return events[request.status];
}
export function notificationId(request:PermissionRequest,event:RequestEmailEvent,recipientUserId:string){
 const occurrence=event==='REVIEW_REQUIRED'?`${request.completedApprovalStages?.length??0}:${request.approverUserId??'routing'}`:event==='PROVISIONED'||event==='PROVISIONING_FAILED'?request.timeline.filter(item=>item.label===(event==='PROVISIONED'?'AWS operation completed':'Provisioning failed')).at(-1)?.timestamp??request.status:'';
 return createHash('sha256').update(JSON.stringify([request.tenantId,request.id,event,request.submittedAt,occurrence,recipientUserId])).digest('hex');
}
export function notificationRecipients(request:PermissionRequest,event:RequestEmailEvent,users:SessionUser[]){
 const unique=new Map<string,SessionUser>();
 for(const user of users){
  if(user.activeTenantId!==request.tenantId||!user.memberships.some(m=>m.tenantId===request.tenantId&&m.status==='ACTIVE')||!/^\S+@\S+\.\S+$/.test(user.email))continue;
  const allowed=event==='REVIEW_REQUIRED'?request.status==='Pending approval'&&authorization.canApproveRequest(user,request):user.id===request.requesterUserId&&authorization.canViewRequest(user,request);
  if(allowed)unique.set(user.email.trim().toLowerCase(),user);
 }
 return [...unique.values()];
}
export function requestEmailView(record:NotificationRecord,frontendUrl:string):NotificationView{
 const text:Record<RequestEmailEvent,[string,string]>={
  REVIEW_REQUIRED:['Permission request needs your review','A permission request is waiting for your review. Read the request and confirm your decision in PermissionHub.'],
  APPROVED:['Request approved','All required approval stages are complete. Approval alone does not mean access has been provisioned. Check the request for the current provisioning status.'],
  REJECTED:['Request denied','Your permission request was denied. Review the decision and contact your organization’s reviewer if you need clarification.'],
  PROVISIONED:['Provisioning completed','PermissionHub recorded successful provisioning for this request. Open the request to review the granted access and any expiry.'],
  PROVISIONING_FAILED:['Provisioning failed','PermissionHub could not complete provisioning. Some operations may have completed; review the recorded result before retrying.']
 };
 const [heading,summary]=text[record.event];
 return {heading,summary,organization:record.payload.organization,requestId:record.requestId,reason:record.payload.reason,warning:record.event==='REJECTED'||record.event==='PROVISIONING_FAILED',actionLabel:record.event==='REVIEW_REQUIRED'?'Sign in to review request':'View request',actionUrl:applicationLink(frontendUrl,`/requests/${encodeURIComponent(record.requestId)}`)};
}
export class RequestNotificationService {
 constructor(private store:NotificationStore,private directory:NotificationDirectory,private mailer:Pick<EmailService,'sendMessage'>=new EmailService(),private enabled=()=> !process.env.VITEST&&(env.NOTIFICATION_EMAIL_MODE??env.INVITATION_EMAIL_MODE)==='ses',private frontendUrl=env.FRONTEND_URL){}
 async record(request:PermissionRequest){
  if(!this.enabled()||!request.tenantId||!request.awsAccountId)return;
  const event=eventForRequest(request);if(!event)return;
  try{
   const directory=await this.directory.load(request),users=notificationRecipients(request,event,directory.users);
   if(!users.length)logger.warn({event:'NOTIFICATION_NO_RECIPIENTS',tenantId:request.tenantId,requestId:request.id,emailEvent:event},'No currently authorized organization recipient found');
   for(const user of users)await this.store.enqueue({id:notificationId(request,event,user.id),tenantId:request.tenantId,requestId:request.id,recipientUserId:user.id,event,payload:{organization:directory.organization,...(event==='REJECTED'&&request.approvalComment?{reason:request.approvalComment.slice(0,1000)}:{})}});
   // Await a bounded batch: do not leave unawaited email work in a frozen Lambda.
   await this.retry(request.tenantId,request.id,2);
  }catch{logger.warn({event:'NOTIFICATION_ENQUEUE_FAILED',tenantId:request.tenantId,requestId:request.id},'Notification unavailable; committed workflow state is unchanged')}
 }
 async retry(tenantId?:string,requestId?:string,limit=20){
  if(!this.enabled())return;
  const ids=await this.store.due(tenantId,requestId,Math.min(limit,100));
  // Two sends at a time; no unbounded Promise.all.
  for(let i=0;i<ids.length;i+=2)await Promise.all(ids.slice(i,i+2).map(id=>this.deliver(id)));
 }
 private async deliver(id:string){
  const record=await this.store.claim(id);if(!record)return;
  try{
   const request=await this.directory.request(record.requestId);
   if(!request||request.tenantId!==record.tenantId){await this.store.finish(id,'CANCELLED');return}
   const directory=await this.directory.load(request),recipient=notificationRecipients(request,record.event,directory.users).find(user=>user.id===record.recipientUserId);
   if(!recipient){await this.store.finish(id,'CANCELLED');return}
   const response=await this.mailer.sendMessage(recipient.email,renderNotification(requestEmailView(record,this.frontendUrl)));
   await this.store.finish(id,'SENT',response.messageId);
  }catch{
   await this.store.finish(id,'FAILED');
   logger.warn({event:'NOTIFICATION_DELIVERY_FAILED',notificationId:id},'Notification retained for bounded retry');
  }
 }
}
