import {emailConfigurationError} from './email-diagnostics.js';

export const DEFAULT_EMAIL_SENDER='no-reply@disraptor.co.za';
export const ALTERNATE_EMAIL_SENDER='no-reply@disraptor-internal.net';

/** Configuration compatibility only. SES verification/account status remains authoritative. */
export function resolveEmailSender(configuredSender=DEFAULT_EMAIL_SENDER,configuredIdentityArn?:string){
 const sender=(configuredSender.trim()||DEFAULT_EMAIL_SENDER).toLowerCase();
 // Keep previously configured verified senders working while no-reply is rolled out.
 if(sender!==DEFAULT_EMAIL_SENDER&&sender!=='info@disraptor.co.za'&&!/^[^@\s]+@disraptor-internal\.net$/.test(sender))throw emailConfigurationError('EMAIL_SENDER_NOT_ALLOWED');
 const identityArn=configuredIdentityArn?.trim();
 if(identityArn){
  const identity=identityArn.match(/^arn:aws:ses:us-east-1:\d{12}:identity\/([^/]+)$/)?.[1]?.toLowerCase();
  if(!identity||identity!==sender&&identity!==sender.split('@')[1])throw emailConfigurationError('EMAIL_SENDER_IDENTITY_MISMATCH');
 }
 return sender;
}
