import {createHash,randomBytes} from 'node:crypto';
import {Prisma,PrismaClient,type ApplicationRole} from '@prisma/client';
import {prisma} from '../config/database.js';
import {ApiError} from '../utils/http.js';
import type {SessionUser,AwsAccountContext} from '../types.js';
import {authorization} from './authorization.service.js';
import {env} from '../config/env.js';
import {renderNotification} from './email-template.js';
import {logger} from '../config/logger.js';
import {describeEmailFailure} from './email-diagnostics.js';

export const organizationRoles=['REQUESTER','ACCOUNT_APPROVER','OU_ADMIN','SECURITY_REVIEWER','PROVISIONER','ORGANISATION_ADMIN'] as const;
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const newProof=()=>randomBytes(32).toString('base64url');
export function verifiedEmail(user:SessionUser){if(!user.emailVerified)throw new ApiError(403,'Verify your email address before continuing.','EMAIL_VERIFICATION_REQUIRED');return user.email.trim().toLowerCase()}
function requireProfile(user:SessionUser){if(user.displayName.trim().length<2||user.displayName===user.email||user.displayName==='Cognito user')throw new ApiError(422,'Complete your profile with your full name before continuing.','PROFILE_REQUIRED')}
export function scopeForRole(role:ApplicationRole,tenantId:string){return {scopeType:'TENANT' as const,scopeId:tenantId,includeDescendants:true,canView:true,canRequest:true,canApprove:['ACCOUNT_APPROVER','OU_ADMIN','SECURITY_REVIEWER','ORGANISATION_ADMIN'].includes(role),canProvision:['PROVISIONER','ORGANISATION_ADMIN'].includes(role),canRevoke:['PROVISIONER','ORGANISATION_ADMIN'].includes(role),canManageConfiguration:role==='ORGANISATION_ADMIN'}}
export interface InvitationMailer {send(to:string,subject:string,body:string,html?:string):Promise<void>}
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
  let deliveryStatus='SENT';
  let deliveryError:ReturnType<typeof describeEmailFailure>|undefined;
  try{const tenant=await this.db.tenant.findUniqueOrThrow({where:{id:tenantId}}),url=new URL('/accept-invitation',this.frontendUrl);url.hash=new URLSearchParams({token:proof}).toString();const message=renderNotification({heading:'You’re invited to join an organization',organization:tenant.name,summary:`You are invited to ${tenant.name} as ${role.replaceAll('_',' ')}. Sign in or create an account with your invited email address, verify it, then accept this invitation. This single-use link expires in 48 hours. Ask your administrator to resend it if it expires.`,actionLabel:'Accept invitation',actionUrl:url.toString()});await this.mailer.send(normalized,`Invitation to ${tenant.name} on PermissionHub`,message.text,message.html)}catch(error){deliveryStatus='FAILED';deliveryError=describeEmailFailure(error);logger.warn({event:'INVITATION_EMAIL_DELIVERY_FAILED',tenantId,invitationId:invitation.id,...deliveryError},'Invitation saved; email delivery failed')}
  // A concurrent resend must never update the delivery state of a newer token.
  try{await this.db.organizationInvitation.updateMany({where:{id:invitation.id,tokenHash:tokenHash(proof)},data:{deliveryStatus,lastSentAt:deliveryStatus==='SENT'?new Date():null}})}catch{/* Delivery metadata must not undo a committed invitation. */}
  return {id:invitation.id,email:normalized,role,status:'PENDING',expiresAt:invitation.expiresAt,deliveryStatus,...(deliveryError?{deliveryError}:{}),message:deliveryStatus==='SENT'?'Invitation email sent.':`Invitation saved, but email could not be delivered. [${deliveryError?.code??'EMAIL_DELIVERY_FAILED'}] ${deliveryError?.message??'Review CloudWatch and resend.'}`};
 }
 async resend(user:SessionUser,tenantId:string,id:string){const item=await this.db.organizationInvitation.findFirst({where:{id,tenantId}});if(!item)throw new ApiError(404,'Invitation not found.','INVITATION_NOT_FOUND');return this.invite(user,tenantId,item.email,item.role,id)}
 async revoke(user:SessionUser,tenantId:string,id:string){return this.transaction(async tx=>{await this.admin(tx,user,tenantId);const result=await tx.organizationInvitation.updateMany({where:{id,tenantId,status:'PENDING'},data:{status:'REVOKED',revokedAt:new Date()}});if(!result.count)throw new ApiError(409,'Invitation is not pending.','INVITATION_NOT_PENDING');await this.audit(tx,user,tenantId,'INVITATION_REVOKED',{invitationId:id});return {revoked:true}})}
 async inspect(user:SessionUser,proof:string){const email=verifiedEmail(user),item=await this.db.organizationInvitation.findUnique({where:{tokenHash:tokenHash(proof)},include:{tenant:true}});if(!item||item.email!==email)throw new ApiError(403,'This invitation is not for your verified email address. Sign in with the invited account.','INVITATION_EMAIL_MISMATCH');if(item.status!=='PENDING')throw new ApiError(410,`This invitation is ${item.status.toLowerCase()}.`,'INVITATION_UNAVAILABLE');if(item.expiresAt<=new Date())throw new ApiError(410,'This invitation has expired. Ask the organisation administrator to resend it.','INVITATION_EXPIRED');return {organizationName:item.tenant.name,role:item.role,expiresAt:item.expiresAt}}
 async pendingInvitations(user:SessionUser){
  const email=verifiedEmail(user);
  const items=await this.db.organizationInvitation.findMany({where:{email,status:'PENDING',expiresAt:{gt:new Date()},tenant:{status:'ACTIVE'}},select:{id:true,role:true,expiresAt:true,tenant:{select:{name:true}}},orderBy:{createdAt:'desc'}});
  return items.map(item=>({id:item.id,organizationName:item.tenant.name,role:item.role,expiresAt:item.expiresAt}));
 }
 async decline(user:SessionUser,id:string){
  const email=verifiedEmail(user);
  return this.transaction(async tx=>{
   const item=await tx.organizationInvitation.findFirst({where:{id,email,status:'PENDING',expiresAt:{gt:new Date()},tenant:{status:'ACTIVE'}}});
   if(!item)throw new ApiError(410,'This invitation is unavailable for your verified account.','INVITATION_UNAVAILABLE');
   const result=await tx.organizationInvitation.updateMany({where:{id:item.id,email,status:'PENDING',expiresAt:{gt:new Date()}},data:{status:'DECLINED'}});
   if(result.count!==1)throw new ApiError(409,'This invitation has already been updated.','INVITATION_UNAVAILABLE');
   await this.audit(tx,user,item.tenantId,'INVITATION_DECLINED',{invitationId:item.id});return {declined:true};
  });
 }
 async accept(user:SessionUser,proof:string){return this.acceptSelected(user,{tokenHash:tokenHash(proof)})}
 async acceptPending(user:SessionUser,id:string){return this.acceptSelected(user,{id})}
 private async acceptSelected(user:SessionUser,where:Prisma.OrganizationInvitationWhereUniqueInput){
  const email=verifiedEmail(user);requireProfile(user);
  const result=await this.transaction(async tx=>{
   const item=await tx.organizationInvitation.findUnique({where,include:{tenant:true}});
   if(!item||item.email!==email)throw new ApiError(403,'Sign in with the invited, verified email address.','INVITATION_EMAIL_MISMATCH');
   if(item.status!=='PENDING'||item.expiresAt<=new Date()||item.tenant.status!=='ACTIVE')throw new ApiError(410,'This invitation is expired, revoked or already used. Ask an administrator for a new invitation.','INVITATION_UNAVAILABLE');
   if(!organizationRoles.includes(item.role as typeof organizationRoles[number]))throw new ApiError(403,'This invitation contains a role that cannot be assigned by an organisation administrator.','ROLE_NOT_ASSIGNABLE');
   const consumed=await tx.organizationInvitation.updateMany({where:{id:item.id,tokenHash:item.tokenHash,status:'PENDING',expiresAt:{gt:new Date()}},data:{status:'ACCEPTED',acceptedAt:new Date(),acceptedByUserId:user.id}});
   if(consumed.count!==1)throw new ApiError(409,'This invitation has already been used.','INVITATION_ALREADY_USED');
   const existing=await tx.tenantMembership.findUnique({where:{tenantId_userId:{tenantId:item.tenantId,userId:user.id}}});
   if(existing?.status!=='ACTIVE'){
    const membership=await tx.tenantMembership.upsert({where:{tenantId_userId:{tenantId:item.tenantId,userId:user.id}},create:{tenantId:item.tenantId,userId:user.id,role:item.role},update:{role:item.role,status:'ACTIVE'}});
    await tx.adminScope.deleteMany({where:{tenantMembershipId:membership.id}});
    // Membership/application role is not an AWS account grant. Owners retain
    // organization administration; other invitees need explicit account scopes.
    if(item.role==='ORGANISATION_ADMIN')await tx.adminScope.create({data:{tenantMembershipId:membership.id,...scopeForRole(item.role,item.tenantId)}});
   }
   await tx.user.update({where:{id:user.id},data:{activeTenantId:item.tenantId,activeAwsAccountRecordId:null}});
   await this.audit(tx,user,item.tenantId,'INVITATION_ACCEPTED',{invitationId:item.id});return {tenantId:item.tenantId,name:item.tenant.name};
  });
  try{await this.mailer.send(email,`You joined ${result.name}`,`Your verified account has joined ${result.name} on PermissionHub. Application roles do not grant AWS IAM credentials.`)}catch{try{await this.db.organizationInvitation.updateMany({where,data:{deliveryStatus:'CONFIRMATION_FAILED'}})}catch{/* Joining succeeded even if confirmation delivery/metadata failed. */}}
  return result;
 }
 async changeMember(user:SessionUser,tenantId:string,id:string,role?:ApplicationRole){
  if(role&&!organizationRoles.includes(role as typeof organizationRoles[number]))throw new ApiError(403,'Platform Admin is not an assignable organisation role.','ROLE_NOT_ASSIGNABLE');
  return this.transaction(async tx=>{
   await this.admin(tx,user,tenantId);const target=await tx.tenantMembership.findFirst({where:{id,tenantId,status:'ACTIVE'}});if(!target)throw new ApiError(404,'Member not found in this organisation.','MEMBER_NOT_FOUND');
   if(target.role==='PLATFORM_ADMIN')throw new ApiError(403,'Platform administrator identities cannot be changed through organisation administration.','PLATFORM_ROLE_PROTECTED');
   if(target.role==='ORGANISATION_ADMIN'&&role!=='ORGANISATION_ADMIN'&&await tx.tenantMembership.count({where:{tenantId,status:'ACTIVE',role:'ORGANISATION_ADMIN'}})<=1)throw new ApiError(409,'The organisation must retain at least one administrator.','LAST_ADMIN_REQUIRED');
   if(!role)await tx.adminScope.deleteMany({where:{tenantMembershipId:id}});
   else if(target.role==='ORGANISATION_ADMIN'||role==='ORGANISATION_ADMIN')await tx.adminScope.deleteMany({where:{tenantMembershipId:id,scopeType:'TENANT',scopeId:tenantId}});
   await tx.tenantMembership.update({where:{id},data:{status:role?'ACTIVE':'SUSPENDED',...(role?{role,...(role==='ORGANISATION_ADMIN'?{adminScopes:{create:scopeForRole(role,tenantId)}}:{})}:{})}});
   // Account-specific development grants must not survive membership removal/demotion.
   await tx.developmentRoleGrant.updateMany({where:{tenantId,userId:target.userId,revokedAt:null},data:{revokedAt:new Date()}});
   await this.audit(tx,user,tenantId,role?'MEMBER_ROLE_CHANGED':'MEMBER_REMOVED',{membershipId:id,...(role?{role}:{})});return {updated:true};
  });
 }
 async memberDetails(user:SessionUser,tenantId:string,membershipId:string){return this.transaction(async tx=>{
  await this.admin(tx,user,tenantId);
  const target=await tx.tenantMembership.findFirst({where:{id:membershipId,tenantId},include:{tenant:true,adminScopes:true,user:{select:{id:true,email:true,displayName:true,identities:{select:{provider:true}}}}}});
  if(!target)throw new ApiError(404,'Member not found in this organization.','MEMBER_NOT_FOUND');
  const accounts=await tx.awsAccount.findMany({where:{tenantId,isDemo:false},select:{id:true,tenantId:true,awsOrganisationId:true,ouId:true,accountId:true,accountName:true,accountType:true,environment:true,riskTier:true,region:true,connectionType:true,connectionStatus:true},orderBy:{accountName:'asc'}});
  const grants=env.NODE_ENV!=='production'&&target.user.identities.some(item=>item.provider==='development')?await tx.developmentRoleGrant.findMany({where:{tenantId,userId:target.userId,revokedAt:null},select:{id:true,tenantId:true,awsAccountId:true,role:true}}):[];
  const subject:SessionUser={id:target.userId,email:target.user.email,displayName:target.user.displayName,provider:'membership',providerSubject:target.userId,activeTenantId:tenantId,permissions:[],memberships:[{id:target.id,tenantId,tenantName:target.tenant.name,tenantSlug:target.tenant.slug,role:target.role,status:target.status,scopes:target.adminScopes}],roleAssignments:grants};
  return {id:target.id,role:target.role,status:target.status,user:{id:target.user.id,email:target.user.email,displayName:target.user.displayName},accounts:accounts.map(row=>{
   const context:AwsAccountContext={...row,organisationId:row.awsOrganisationId??undefined,ouId:row.ouId??undefined};
   const direct=target.adminScopes.find(scope=>scope.scopeType==='AWS_ACCOUNT'&&[row.id,row.accountId].includes(scope.scopeId));
   const inherited={...subject,memberships:[{...subject.memberships[0]!,scopes:target.adminScopes.filter(scope=>!(scope.scopeType==='AWS_ACCOUNT'&&[row.id,row.accountId].includes(scope.scopeId)))}]};
   return {id:row.id,accountName:row.accountName,awsAccountNumber:row.accountId,region:row.region,connectionStatus:row.connectionStatus,directScope:direct?{canView:direct.canView,canRequest:direct.canRequest,canApprove:direct.canApprove,canProvision:direct.canProvision,canRevoke:direct.canRevoke}:null,effective:authorization.accountAccess(subject,context),inherited:authorization.accountAccess(inherited,context)};
  })};
 })}
 async setMemberAccountAccess(user:SessionUser,tenantId:string,membershipId:string,accountRecordId:string,access:{canView:boolean;canRequest:boolean;canApprove:boolean;canProvision:boolean;canRevoke:boolean}|null){return this.transaction(async tx=>{
  await this.admin(tx,user,tenantId);
  const target=await tx.tenantMembership.findFirst({where:{id:membershipId,tenantId,status:'ACTIVE'}}),account=await tx.awsAccount.findFirst({where:{id:accountRecordId,tenantId,isDemo:false},select:{id:true,accountId:true}});
  if(!target||!account)throw new ApiError(404,'Member or AWS account not found in this organization.','MEMBER_ACCOUNT_NOT_FOUND');
  if(target.role==='PLATFORM_ADMIN')throw new ApiError(403,'Platform identities cannot be granted customer access here.','PLATFORM_ROLE_PROTECTED');
  if(access){
   if(!access.canView&&Object.values(access).some(Boolean))throw new ApiError(422,'Account view access is required for other account actions.','ACCOUNT_VIEW_REQUIRED');
   const subject:SessionUser={...user,id:target.userId,permissions:[],memberships:[{id:target.id,tenantId,tenantName:'',tenantSlug:'',role:target.role,status:target.status,scopes:[]}],roleAssignments:[]};
   for(const [flag,capability]of [['canRequest','REQUEST_CREATE'],['canApprove','REQUEST_APPROVE'],['canProvision','PROVISION_EXECUTE'],['canRevoke','GRANT_REVOKE']] as const)if(access[flag]&&!authorization.hasCapability(subject,capability))throw new ApiError(422,'The assigned application role does not permit this account action.','ROLE_CAPABILITY_REQUIRED');
  }
  // Normalize any legacy numeric account scope to the internal record ID.
  await tx.adminScope.deleteMany({where:{tenantMembershipId:membershipId,scopeType:'AWS_ACCOUNT',scopeId:{in:[account.id,account.accountId]}}});
  if(access)await tx.adminScope.create({data:{tenantMembershipId:membershipId,scopeType:'AWS_ACCOUNT',scopeId:account.id,includeDescendants:false,...access,canManageConfiguration:false}});
  await this.audit(tx,user,tenantId,access?'MEMBER_ACCOUNT_ACCESS_UPDATED':'MEMBER_ACCOUNT_ACCESS_REMOVED',{membershipId,accountRecordId,...(access??{})});return {updated:true};
 })}
 async validateScopeAssignment(user:SessionUser,tenantId:string,membershipId:string,scopeType:'TENANT'|'AWS_ORGANISATION'|'ORGANISATIONAL_UNIT'|'AWS_ACCOUNT',scopeId:string){return this.transaction(async tx=>{
  await this.admin(tx,user,tenantId);
  if(!await tx.tenantMembership.findFirst({where:{id:membershipId,tenantId,status:'ACTIVE'}}))throw new ApiError(404,'Active member not found in this organization.','MEMBER_NOT_FOUND');
  const valid=scopeType==='TENANT'?scopeId===tenantId:scopeType==='AWS_ACCOUNT'?await tx.awsAccount.findFirst({where:{tenantId,OR:[{id:scopeId},{accountId:scopeId}]},select:{id:true}}):scopeType==='AWS_ORGANISATION'?await tx.awsOrganisation.findFirst({where:{tenantId,OR:[{id:scopeId},{organisationId:scopeId}]},select:{id:true}}):await tx.awsOrganisationalUnit.findFirst({where:{awsOrganisation:{tenantId},OR:[{id:scopeId},{ouId:scopeId}]},select:{id:true}});
  if(!valid)throw new ApiError(403,'Scope must belong to the active organization.','SCOPE_TENANT_VIOLATION');
 })}
}
