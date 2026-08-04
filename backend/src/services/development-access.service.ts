import {env} from '../config/env.js';
import {prisma} from '../config/database.js';
import type {AppRole} from '../types.js';
import {ApiError} from '../utils/http.js';

export const grantableDevelopmentRoles=['SECURITY_REVIEWER','ACCOUNT_APPROVER','PROVISIONER'] as const satisfies readonly AppRole[];
export type GrantableDevelopmentRole=typeof grantableDevelopmentRoles[number];

export class DevelopmentAccessService{
 private assertAvailable(){if(env.NODE_ENV==='production')throw new ApiError(404,'Not found.','NOT_FOUND')}
 async resolve(userEmail:string,awsAccountNumber:string){
  this.assertAvailable();
  const user=await prisma.user.findUnique({where:{email:userEmail},include:{memberships:true}});
  if(!user)throw new ApiError(404,'Development user not found.','DEV_USER_NOT_FOUND');
  const tenants=user.memberships.filter(item=>item.status==='ACTIVE').map(item=>item.tenantId);
  const account=await prisma.awsAccount.findFirst({where:{tenantId:{in:tenants},accountId:awsAccountNumber,isDemo:false}});
  if(!account)throw new ApiError(404,'No matching account exists in a tenant shared by this user.','DEV_ACCOUNT_SCOPE_NOT_FOUND');
  return {user,account,tenantId:account.tenantId};
 }
 async grant(input:{userEmail:string;awsAccountNumber:string;roles:GrantableDevelopmentRole[];actorUserId?:string}){
  const {user,account,tenantId}=await this.resolve(input.userEmail,input.awsAccountNumber),actorUserId=input.actorUserId??user.id;
  const values=[];
  for(const role of [...new Set(input.roles)])values.push(await prisma.developmentRoleGrant.upsert({where:{tenantId_userId_awsAccountId_role:{tenantId,userId:user.id,awsAccountId:account.id,role}},create:{tenantId,userId:user.id,awsAccountId:account.id,role,grantedById:actorUserId},update:{revokedAt:null,grantedById:actorUserId}}));
  await prisma.connectionAuditEvent.create({data:{tenantId,awsAccountId:account.id,actorUserId,action:'DEVELOPMENT_REQUEST_ACCESS_GRANTED',outcome:'SUCCESS',metadata:{userId:user.id,userEmail:user.email,roles:values.map(value=>value.role),scopeType:'AWS_ACCOUNT',awsAccountNumber:account.accountId}}});
  return {user:{id:user.id,email:user.email},account:{accountRecordId:account.id,awsAccountNumber:account.accountId},roles:values.map(value=>value.role)};
 }
 async revoke(input:{userEmail:string;awsAccountNumber:string;roles?:GrantableDevelopmentRole[];actorUserId?:string}){
  const {user,account,tenantId}=await this.resolve(input.userEmail,input.awsAccountNumber),actorUserId=input.actorUserId??user.id,where={tenantId,userId:user.id,awsAccountId:account.id,revokedAt:null,...(input.roles?.length?{role:{in:input.roles}}:{})};
  const existing=await prisma.developmentRoleGrant.findMany({where});await prisma.developmentRoleGrant.updateMany({where,data:{revokedAt:new Date()}});
  await prisma.connectionAuditEvent.create({data:{tenantId,awsAccountId:account.id,actorUserId,action:'DEVELOPMENT_REQUEST_ACCESS_REVOKED',outcome:'SUCCESS',metadata:{userId:user.id,userEmail:user.email,roles:existing.map(value=>value.role),scopeType:'AWS_ACCOUNT',awsAccountNumber:account.accountId}}});
  return {user:{id:user.id,email:user.email},account:{accountRecordId:account.id,awsAccountNumber:account.accountId},roles:existing.map(value=>value.role)};
 }
}
export const developmentAccess=new DevelopmentAccessService();
