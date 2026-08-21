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
   const membershipOnly=grant.targetType==='GROUP'&&grant.policyArn.startsWith('GROUP_MEMBERSHIP:');
   const memberResults=[];
   if(grant.targetType==='GROUP')for(const userName of grant.groupMembersAdded??[])memberResults.push(await this.provisioning.removeUserFromGroup(grant.targetName,userName));
   const response=membershipOnly?{operation:'RemoveUserFromGroup',changed:memberResults.some(item=>(item as {changed?:boolean}).changed),members:memberResults}:await this.provisioning.detach({targetType:grant.targetType,targetName:grant.targetName,policyArn:grant.policyArn});
   grant.revokedAt=new Date().toISOString();
   grant.revocationResponse=response;
   auditEvents.unshift(this.audit(actor,grant,response));
   results.push({grantId:grant.id,requestId:grant.requestId,response});
  }
  return results;
 }

 private audit(actor:string,grant:PermissionGrant,response:unknown):AuditEvent{
  const membershipOnly=grant.targetType==='GROUP'&&grant.policyArn.startsWith('GROUP_MEMBERSHIP:');
  return {id:`evt_expiry_${Date.now()}_${grant.id}`,timestamp:new Date().toISOString(),actor,requestId:grant.requestId,targetArn:grant.targetArn,policyArn:grant.policyArn,action:membershipOnly?'Group members removed':'Policy detached',previousState:{attachedAt:grant.attachedAt,expiresAt:grant.expiresAt},newState:{revokedAt:grant.revokedAt},result:'SUCCESS',awsRequestId:(response as any)?.awsRequestId};
 }
}
