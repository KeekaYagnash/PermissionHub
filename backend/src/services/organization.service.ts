import {createHash,randomBytes} from 'node:crypto';
import {Prisma,PrismaClient,type ApplicationRole} from '@prisma/client';
import {prisma} from '../config/database.js';
import {ApiError} from '../utils/http.js';
import type {SessionUser} from '../types.js';

export const organizationRoles=['REQUESTER','ACCOUNT_APPROVER','OU_ADMIN','SECURITY_REVIEWER','PROVISIONER','ORGANISATION_ADMIN'] as const;
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const newProof=()=>randomBytes(32).toString('base64url');
export function verifiedEmail(user:SessionUser){if(!user.emailVerified)throw new ApiError(403,'Verify your email address before continuing.','EMAIL_VERIFICATION_REQUIRED');return user.email.trim().toLowerCase()}
function requireProfile(user:SessionUser){if(user.displayName.trim().length<2||user.displayName===user.email||user.displayName==='Cognito user')throw new ApiError(422,'Complete your profile with your full name before continuing.','PROFILE_REQUIRED')}
export function scopeForRole(role:ApplicationRole,tenantId:string){return {scopeType:'TENANT' as const,scopeId:tenantId,includeDescendants:true,canView:true,canRequest:true,canApprove:['ACCOUNT_APPROVER','OU_ADMIN','SECURITY_REVIEWER','ORGANISATION_ADMIN'].includes(role),canProvision:['PROVISIONER','ORGANISATION_ADMIN'].includes(role),canRevoke:['PROVISIONER','ORGANISATION_ADMIN'].includes(role),canManageConfiguration:role==='ORGANISATION_ADMIN'}}
export interface InvitationMailer {send(to:string,subject:string,body:string):Promise<void>}
type Tx=Prisma.TransactionClient;
export class OrganizationService {
 constructor(private db:PrismaClient=prisma,private mailer:InvitationMailer,private frontendUrl:string){}
 private async transaction<T>(fn:(tx:Tx)=>Promise<T>):Promise<T>{for(let i=0;;i++){try{return await this.db.$transaction(fn,{isolationLevel:'Serializable'})}catch(error){if(i<2&&error instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(error.code))continue;throw error}}}
 private async admin(tx:Tx,user:SessionUser,tenantId:string){const m=await tx.tenantMembership.findUnique({where:{tenantId_userId:{tenantId,userId:user.id}},include:{tenant:true}});if(!m||m.status!=='ACTIVE'||m.tenant.status!=='ACTIVE'||m.role!=='ORGANISATION_ADMIN')throw new ApiError(403,'Organisation administrator access is required.','ORGANIZATION_ADMIN_REQUIRED');return m}
 private audit(tx:Tx,user:SessionUser,tenantId:string,action:string,metadata:Prisma.InputJsonObject={}){return tx.connectionAuditEvent.create({data:{tenantId,actorUserId:user.id,action,outcome:'SUCCESS',metadata}})}
 async create(user:SessionUser,companyName:string){
  verifiedEmail(user);requireProfile(user);const name=companyName.trim();if(name.length<2||name.length>120)throw new ApiError(422,'Enter a company name between 2 and 120 characters.','COMPANY_NAME_INVALID');
  const digest=tokenHash(`${user.id}:${name.toLowerCase()}`),id=`tenant_${digest.slice(0,32)}`;
  return this.transaction(async tx=>{
   const existing=await tx.tenant.findUnique({where:{id}});
   if(existing){const m=await tx.tenantMembership.findUnique({where:{tenantId_userId:{tenantId:id,userId:user.id}}});if(existing.status!=='ACTIVE'||existing.createdByUserId!==user.id||m?.status!=='ACTIVE')throw new ApiError(403,'Contact an existing administrator to restore organisation membership.','ORGANIZATION_ACCESS_REMOVED');await tx.user.update({where:{id:user.id},data:{activeTenantId:id,activeAwsAccountRecordId:null}});return existing}
   const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'organization';
   const tenant=await tx.tenant.create({data:{id,name,slug:`${slug}-${digest.slice(0,12)}`,createdByUserId:user.id}});
   await tx.tenantMembership.create({data:{tenantId:id,userId:user.id,role:'ORGANISATION_ADMIN',adminScopes:{create:scopeForRole('ORGANISATION_ADMIN',id)}}});
   await this.audit(tx,user,id,'ORGANIZATION_CREATED',{name});await tx.user.update({where:{id:user.id},data:{activeTenantId:id,activeAwsAccountRecordId:null}});return tenant;
  });
 }
 async list(user:SessionUser,tenantId:string){return this.transaction(async tx=>{await this.admin(tx,user,tenantId);const [members,invitations]=await Promise.all([tx.tenantMembership.findMany({where:{tenantId},select:{id:true,role:true,status:true,user:{select:{id:true,email:true,displayName:true}}},orderBy:{createdAt:'asc'}}),tx.organizationInvitation.findMany({where:{tenantId},select:{id:true,email:true,role:true,status:true,expiresAt:true,deliveryStatus:true,lastSentAt:true,acceptedAt:true},orderBy:{createdAt:'desc'}})]);return {members,invitations:invitations.map(item=>({...item,status:item.status==='PENDING'&&item.expiresAt<new Date()?'EXPIRED':item.status}))}})}
 async invite(user:SessionUser,tenantId:string,email:string,role:ApplicationRole,resendId?:string){
  if(!organizationRoles.includes(role as typeof organizationRoles[number]))throw new ApiError(403,'This role cannot be assigned by an organisation administrator.','ROLE_NOT_ASSIGNABLE');
  const proof=newProof(),normalized=email.trim().toLowerCase();
  const invitation=await this.transaction(async tx=>{
   await this.admin(tx,user,tenantId);
   if(resendId){const previous=await tx.organizationInvitation.findFirst({where:{id:resendId,tenantId,status:'PENDING'}});if(!previous||previous.email!==normalized||previous.role!==role)throw new ApiError(409,'Only pending or expired invitations can be resent.','INVITATION_NOT_PENDING')}
   const member=await tx.tenantMembership.findFirst({where:{tenantId,status:'ACTIVE',user:{email:normalized}}});if(member)throw new ApiError(409,'This person is already an active organisation member.','MEMBER_ALREADY_EXISTS');
   const data={role,tokenHash:tokenHash(proof),status:'PENDING',expiresAt:new Date(Date.now()+48*3600_000),createdByUserId:user.id,acceptedAt:null,acceptedByUserId:null,revokedAt:null,deliveryStatus:'PENDING'};
   const item=await tx.organizationInvitation.upsert({where:{tenantId_email:{tenantId,email:normalized}},create:{tenantId,email:normalized,...data},update:data});
   await this.audit(tx,user,tenantId,resendId?'INVITATION_RESENT':'INVITATION_CREATED',{invitationId:item.id,email:normalized,role});return item;
  });
  const tenant=await this.db.tenant.findUniqueOrThrow({where:{id:tenantId}});
  const url=new URL('/accept-invitation',this.frontendUrl);url.hash=new URLSearchParams({token:proof}).toString();
  let deliveryStatus='SENT';
  try{await this.mailer.send(normalized,`Invitation to ${tenant.name} on PermissionHub`,`You are invited to ${tenant.name} as ${role.replaceAll('_',' ')}.\nSign in or register with ${normalized}, verify your email, and open:\n${url}\nThis single-use link expires in 48 hours. If expired, ask the organisation administrator to resend it.`)}catch{deliveryStatus='FAILED'}
  // A concurrent resend must never update the delivery state of a newer token.
  await this.db.organizationInvitation.updateMany({where:{id:invitation.id,tokenHash:tokenHash(proof)},data:{deliveryStatus,lastSentAt:deliveryStatus==='SENT'?new Date():null}});
  return {id:invitation.id,email:normalized,role,status:'PENDING',expiresAt:invitation.expiresAt,deliveryStatus,message:deliveryStatus==='SENT'?'Invitation email sent.':'Invitation saved, but email could not be delivered. Configure the sender and resend.'};
 }
 async resend(user:SessionUser,tenantId:string,id:string){const item=await this.db.organizationInvitation.findFirst({where:{id,tenantId}});if(!item)throw new ApiError(404,'Invitation not found.','INVITATION_NOT_FOUND');return this.invite(user,tenantId,item.email,item.role,id)}
 async revoke(user:SessionUser,tenantId:string,id:string){return this.transaction(async tx=>{await this.admin(tx,user,tenantId);const result=await tx.organizationInvitation.updateMany({where:{id,tenantId,status:'PENDING'},data:{status:'REVOKED',revokedAt:new Date()}});if(!result.count)throw new ApiError(409,'Invitation is not pending.','INVITATION_NOT_PENDING');await this.audit(tx,user,tenantId,'INVITATION_REVOKED',{invitationId:id});return {revoked:true}})}
 async inspect(user:SessionUser,proof:string){const email=verifiedEmail(user),item=await this.db.organizationInvitation.findUnique({where:{tokenHash:tokenHash(proof)},include:{tenant:true}});if(!item||item.email!==email)throw new ApiError(403,'This invitation is not for your verified email address. Sign in with the invited account.','INVITATION_EMAIL_MISMATCH');if(item.status!=='PENDING')throw new ApiError(410,`This invitation is ${item.status.toLowerCase()}.`,'INVITATION_UNAVAILABLE');if(item.expiresAt<=new Date())throw new ApiError(410,'This invitation has expired. Ask the organisation administrator to resend it.','INVITATION_EXPIRED');return {organizationName:item.tenant.name,role:item.role,expiresAt:item.expiresAt}}
 async accept(user:SessionUser,proof:string){
  const email=verifiedEmail(user);requireProfile(user);
  const result=await this.transaction(async tx=>{
   const item=await tx.organizationInvitation.findUnique({where:{tokenHash:tokenHash(proof)},include:{tenant:true}});
   if(!item||item.email!==email)throw new ApiError(403,'Sign in with the invited, verified email address.','INVITATION_EMAIL_MISMATCH');
   if(item.status!=='PENDING'||item.expiresAt<=new Date()||item.tenant.status!=='ACTIVE')throw new ApiError(410,'This invitation is expired, revoked or already used. Ask an administrator for a new invitation.','INVITATION_UNAVAILABLE');
   if(!organizationRoles.includes(item.role as typeof organizationRoles[number]))throw new ApiError(403,'This invitation contains a role that cannot be assigned by an organisation administrator.','ROLE_NOT_ASSIGNABLE');
   const consumed=await tx.organizationInvitation.updateMany({where:{id:item.id,tokenHash:tokenHash(proof),status:'PENDING',expiresAt:{gt:new Date()}},data:{status:'ACCEPTED',acceptedAt:new Date(),acceptedByUserId:user.id}});
   if(consumed.count!==1)throw new ApiError(409,'This invitation has already been used.','INVITATION_ALREADY_USED');
   const existing=await tx.tenantMembership.findUnique({where:{tenantId_userId:{tenantId:item.tenantId,userId:user.id}}});
   if(existing?.status!=='ACTIVE'){
    const membership=await tx.tenantMembership.upsert({where:{tenantId_userId:{tenantId:item.tenantId,userId:user.id}},create:{tenantId:item.tenantId,userId:user.id,role:item.role},update:{role:item.role,status:'ACTIVE'}});
    await tx.adminScope.deleteMany({where:{tenantMembershipId:membership.id}});
    await tx.adminScope.create({data:{tenantMembershipId:membership.id,...scopeForRole(item.role,item.tenantId)}});
   }
   await tx.user.update({where:{id:user.id},data:{activeTenantId:item.tenantId,activeAwsAccountRecordId:null}});
   await this.audit(tx,user,item.tenantId,'INVITATION_ACCEPTED',{invitationId:item.id});return {tenantId:item.tenantId,name:item.tenant.name};
  });
  try{await this.mailer.send(email,`You joined ${result.name}`,`Your verified account has joined ${result.name} on PermissionHub. Application roles do not grant AWS IAM credentials.`)}catch{await this.db.organizationInvitation.updateMany({where:{tokenHash:tokenHash(proof)},data:{deliveryStatus:'CONFIRMATION_FAILED'}})}
  return result;
 }
 async changeMember(user:SessionUser,tenantId:string,id:string,role?:ApplicationRole){
  if(role&&!organizationRoles.includes(role as typeof organizationRoles[number]))throw new ApiError(403,'Platform Admin is not an assignable organisation role.','ROLE_NOT_ASSIGNABLE');
  return this.transaction(async tx=>{
   await this.admin(tx,user,tenantId);const target=await tx.tenantMembership.findFirst({where:{id,tenantId,status:'ACTIVE'}});if(!target)throw new ApiError(404,'Member not found in this organisation.','MEMBER_NOT_FOUND');
   if(target.role==='PLATFORM_ADMIN')throw new ApiError(403,'Platform administrator identities cannot be changed through organisation administration.','PLATFORM_ROLE_PROTECTED');
   if(target.role==='ORGANISATION_ADMIN'&&role!=='ORGANISATION_ADMIN'&&await tx.tenantMembership.count({where:{tenantId,status:'ACTIVE',role:'ORGANISATION_ADMIN'}})<=1)throw new ApiError(409,'The organisation must retain at least one administrator.','LAST_ADMIN_REQUIRED');
   await tx.adminScope.deleteMany({where:{tenantMembershipId:id}});
   await tx.tenantMembership.update({where:{id},data:{status:role?'ACTIVE':'SUSPENDED',...(role?{role,adminScopes:{create:scopeForRole(role,tenantId)}}:{})}});
   // Account-specific development grants must not survive membership removal/demotion.
   await tx.developmentRoleGrant.updateMany({where:{tenantId,userId:target.userId,revokedAt:null},data:{revokedAt:new Date()}});
   await this.audit(tx,user,tenantId,role?'MEMBER_ROLE_CHANGED':'MEMBER_REMOVED',{membershipId:id,...(role?{role}:{})});return {updated:true};
  });
 }
}
