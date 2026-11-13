import {SESClient,SendEmailCommand} from '@aws-sdk/client-ses';
import {env} from '../config/env.js';
import type {InvitationMailer} from './organization.service.js';

export class SesInvitationMailer implements InvitationMailer {
 private client=new SESClient({region:env.SES_REGION??env.AWS_REGION,maxAttempts:3});
 async send(to:string,subject:string,body:string){
  if(env.INVITATION_EMAIL_MODE!=='ses'||!/^\S+@\S+\.\S+$/.test(env.SES_FROM_EMAIL)||env.SES_FROM_EMAIL.endsWith('.local'))throw new Error('Invitation email delivery is not configured.');
  // Never log message bodies: invitation links contain bearer proofs.
  await this.client.send(new SendEmailCommand({Source:env.SES_FROM_EMAIL,Destination:{ToAddresses:[to]},Message:{Subject:{Data:subject,Charset:'UTF-8'},Body:{Text:{Data:body,Charset:'UTF-8'}}}}),{abortSignal:AbortSignal.timeout(6000)});
 }
}
