import {env} from '../config/env.js';
import type {InvitationMailer} from './organization.service.js';
import {EmailService} from './email.service.js';
import {renderNotification,applicationLink} from './email-template.js';

export class SesInvitationMailer implements InvitationMailer {
 private client=new EmailService();
 async send(to:string,subject:string,body:string,html?:string){
  if(env.INVITATION_EMAIL_MODE!=='ses'||!/^\S+@\S+\.\S+$/.test(env.SES_FROM_EMAIL)||env.SES_FROM_EMAIL.endsWith('.local'))throw new Error('Invitation email delivery is not configured.');
  // Never log message bodies: invitation links contain bearer proofs.
  await this.client.sendMessage(to,{subject,text:body,html:html??renderNotification({heading:'Organization update',organization:'PermissionHub',summary:body,actionLabel:'Open PermissionHub',actionUrl:applicationLink(env.FRONTEND_URL,'/')}).html});
 }
}
