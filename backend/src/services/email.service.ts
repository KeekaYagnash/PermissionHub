import {SESClient,SendEmailCommand} from '@aws-sdk/client-ses';
import {env} from '../config/env.js';
import {logger} from '../config/logger.js';
import {renderNotification,applicationLink,type EmailContent} from './email-template.js';
import {describeEmailFailure} from './email-diagnostics.js';
import {resolveEmailSender} from './email-sender.js';

// SES identities are regional. Never use the selected account's credentials or APP_AWS_REGION.
export const SES_EMAIL_REGION='us-east-1';
export type EmailEvent='Request Submitted'|'Approved'|'Rejected'|'Provisioned'|'Expired';
export class EmailService {
 private client=new SESClient({region:SES_EMAIL_REGION,maxAttempts:3});
 async sendMessage(to:string,content:EmailContent){
  const sender=resolveEmailSender(env.SES_FROM_EMAIL,env.SES_IDENTITY_ARN);
  const response=await this.client.send(new SendEmailCommand({Source:sender,Destination:{ToAddresses:[to]},Message:{Subject:{Data:content.subject.replace(/[\r\n]/g,' ').slice(0,200),Charset:'UTF-8'},Body:{Text:{Data:content.text,Charset:'UTF-8'},Html:{Data:content.html,Charset:'UTF-8'}}}}),{abortSignal:AbortSignal.timeout(6000)});
  return {delivery:'ses' as const,messageId:response.MessageId};
 }
 // Compatibility for any existing caller; logging is not delivery.
 async send(to:string,event:EmailEvent,details:{requestId:string;actor?:string}){
  if((env.NOTIFICATION_EMAIL_MODE??env.INVITATION_EMAIL_MODE)!=='ses')return {delivery:'disabled' as const};
  try{return await this.sendMessage(to,renderNotification({heading:event,organization:'PermissionHub',requestId:details.requestId,summary:'A permission request has an update. Review its current status securely in PermissionHub.',actionLabel:'View request',actionUrl:applicationLink(env.FRONTEND_URL,`/requests/${encodeURIComponent(details.requestId)}`)}))}
  catch(error){logger.warn({event:'EMAIL_DELIVERY_FAILED',...describeEmailFailure(error)},'Email delivery failed; application state is unchanged');return {delivery:'failed' as const}}
 }
}
