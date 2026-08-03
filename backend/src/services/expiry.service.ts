import type { AuditEvent,PermissionGrant } from '../types.js';
import { auditEvents,grants } from './mock.service.js';
import { IamProvisioningService } from './aws/aws-services.js';

export class PermissionGrantExpiryService{
 constructor(private provisioning=new IamProvisioningService()){}

 findExpired(now=new Date()):PermissionGrant[]{
  return grants.filter(grant=>Boolean(grant.expiresAt)&&!grant.revokedAt&&Date.parse(grant.expiresAt!)<=now.getTime());
 }

 async revokeExpired(actor='Expiry worker',now=new Date()){
  const expired=this.findExpired(now),results=[];
  for(const grant of expired){
   const response=await this.provisioning.detach({targetType:grant.targetType,targetName:grant.targetName,policyArn:grant.policyArn});
   grant.revokedAt=new Date().toISOString();
   grant.revocationResponse=response;
   auditEvents.unshift(this.audit(actor,grant,response));
   results.push({grantId:grant.id,requestId:grant.requestId,response});
  }
  return results;
 }

 private audit(actor:string,grant:PermissionGrant,response:unknown):AuditEvent{
  return {id:`evt_expiry_${Date.now()}_${grant.id}`,timestamp:new Date().toISOString(),actor,requestId:grant.requestId,targetArn:grant.targetArn,policyArn:grant.policyArn,action:'Policy detached',previousState:{attachedAt:grant.attachedAt,expiresAt:grant.expiresAt},newState:{revokedAt:grant.revokedAt},result:'SUCCESS',awsRequestId:(response as any)?.awsRequestId};
 }
}
