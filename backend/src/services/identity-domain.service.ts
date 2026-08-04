import type { AccountType,AdminScope,AppRole,AwsAccountContext,SessionUser,TenantMembership } from '../types.js';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';

export interface DirectoryUser {id:string;email:string;displayName:string;providerSubject:string;memberships:TenantMembership[]}
export interface OrganisationRecord {id:string;tenantId:string;organisationId:string;name:string;managementAccountId:string;connectionStatus:string;lastSyncedAt?:string}
export interface OuRecord {id:string;organisationId:string;ouId:string;parentOuId?:string;name:string;fullPath:string}

const tenant={id:'tenant_disraptor_dev',name:'Disraptor',slug:'disraptor'};
const organisation:OrganisationRecord={id:'org_disraptor_dev',tenantId:tenant.id,organisationId:'o-exampledev',name:'Disraptor Organisation',managementAccountId:'111122223333',connectionStatus:'CONNECTED'};
export const developmentOus:OuRecord[]=[
 {id:'ou_production_dev',organisationId:organisation.id,ouId:'ou-example-prod',name:'Production',fullPath:'/Disraptor/Production'},
 {id:'ou_development_dev',organisationId:organisation.id,ouId:'ou-example-dev',name:'Development',fullPath:'/Disraptor/Development'},
 {id:'ou_security_dev',organisationId:organisation.id,ouId:'ou-example-sec',name:'Security',fullPath:'/Disraptor/Security'}
];
export const developmentAccounts:AwsAccountContext[]=[
 {id:'account_prod_payments_dev',tenantId:tenant.id,organisationId:organisation.id,ouId:developmentOus[0]!.id,ouPath:developmentOus[0]!.fullPath,accountId:'111122223334',accountName:'Production Payments',accountType:'PRODUCTION',environment:'production',riskTier:'HIGH',region:'af-south-1',connectionType:'ORGANISATION_MEMBER',connectionStatus:'DISCONNECTED',provisioningStatus:'DISABLED',readRoleArn:'arn:aws:iam::111122223334:role/PermissionHubReadRole',provisionRoleArn:'arn:aws:iam::111122223334:role/PermissionHubProvisionRole',organisationsRegion:'us-east-1',provisioningEnabled:false},
 {id:'account_sandbox_dev',tenantId:tenant.id,organisationId:organisation.id,ouId:developmentOus[1]!.id,ouPath:developmentOus[1]!.fullPath,accountId:'111122223335',accountName:'Development Sandbox',accountType:'DEVELOPMENT',environment:'development',riskTier:'LOW',region:'af-south-1',connectionType:'LOCAL_DEVELOPMENT',connectionStatus:'CONNECTED',provisioningStatus:'DISABLED',organisationsRegion:'us-east-1',provisioningEnabled:false},
 {id:'account_security_dev',tenantId:tenant.id,organisationId:organisation.id,ouId:developmentOus[2]!.id,ouPath:developmentOus[2]!.fullPath,accountId:'111122223336',accountName:'Security Tooling',accountType:'SECURITY',environment:'security',riskTier:'CRITICAL',region:'af-south-1',connectionType:'ORGANISATION_MEMBER',connectionStatus:'DISCONNECTED',provisioningStatus:'DISABLED',readRoleArn:'arn:aws:iam::111122223336:role/PermissionHubReadRole',provisionRoleArn:'arn:aws:iam::111122223336:role/PermissionHubProvisionRole',organisationsRegion:'us-east-1',provisioningEnabled:false}
];
developmentAccounts.forEach(account=>Object.assign(account,{sourceType:'DEMO_SEED',connectionSource:'DEMO_SEED',isDemo:true}));
export const developmentOrganisations=[organisation];

function scope(scopeType:AdminScope['scopeType'],scopeId:string,capabilities:Partial<AdminScope>):AdminScope{return {scopeType,scopeId,includeDescendants:true,canView:true,canRequest:false,canApprove:false,canProvision:false,canRevoke:false,canManageConfiguration:false,...capabilities}}
function membership(id:string,role:AppRole,scopes:AdminScope[]):TenantMembership{return {id,tenantId:tenant.id,tenantName:tenant.name,tenantSlug:tenant.slug,role,status:'ACTIVE',scopes}}

export const developmentUsers:DirectoryUser[]=[
 {id:'user_org_admin_dev',email:'org.admin@disraptor.example',displayName:'Organisation Admin',providerSubject:'dev-org-admin',memberships:[membership('membership_org_admin', 'ORGANISATION_ADMIN',[scope('TENANT',tenant.id,{canRequest:true,canApprove:true,canProvision:true,canRevoke:true,canManageConfiguration:true})])]},
 {id:'user_ou_admin_dev',email:'ou.admin@disraptor.example',displayName:'Production OU Admin',providerSubject:'dev-ou-admin',memberships:[membership('membership_ou_admin','OU_ADMIN',[scope('ORGANISATIONAL_UNIT',developmentOus[0]!.id,{canRequest:true,canApprove:true,canManageConfiguration:true})])]},
 {id:'user_approver_dev',email:'approver@disraptor.example',displayName:'Account Approver',providerSubject:'dev-approver',memberships:[membership('membership_approver','ACCOUNT_APPROVER',[scope('AWS_ACCOUNT',developmentAccounts[0]!.id,{canApprove:true})])]},
 {id:'user_requester_dev',email:'requester@disraptor.example',displayName:'Permission Requester',providerSubject:'dev-requester',memberships:[membership('membership_requester','REQUESTER',[scope('AWS_ACCOUNT',developmentAccounts[0]!.id,{canRequest:true}),scope('AWS_ACCOUNT',developmentAccounts[1]!.id,{canRequest:true})])]},
 {id:'user_security_dev',email:'security.reviewer@disraptor.example',displayName:'Security Reviewer',providerSubject:'dev-security-reviewer',memberships:[membership('membership_security','SECURITY_REVIEWER',[scope('TENANT',tenant.id,{canApprove:true})])]},
 {id:'user_provisioner_dev',email:'provisioner@disraptor.example',displayName:'Access Provisioner',providerSubject:'dev-provisioner',memberships:[membership('membership_provisioner','PROVISIONER',[scope('TENANT',tenant.id,{canProvision:true,canRevoke:true})])]},
 {id:'user_platform_dev',email:'platform.admin@permissionhub.example',displayName:'Platform Administrator',providerSubject:'dev-platform-admin',memberships:[membership('membership_platform','PLATFORM_ADMIN',[])]}
];

export class IdentityDomainService {
 private manualAccounts:AwsAccountContext[]=[];
 findDevelopmentUser(id:string){return developmentUsers.find(user=>user.id===id)}
 findByProviderSubject(provider:string,subject:string,email?:string){return developmentUsers.find(user=>user.providerSubject===subject||(provider!=='development'&&email&&user.email.toLowerCase()===email.toLowerCase()))}
 sessionUser(user:DirectoryUser,provider:string):SessionUser{const memberships=user.memberships.map(membership=>({...membership,scopes:membership.scopes.map(item=>({...item}))}));if(provider==='development'&&!env.AUTH_ENABLED&&env.ENABLE_DEV_AUTH&&env.DEV_AUTH_USER_ID===user.id){const membership=memberships[0];if(membership&&!membership.scopes.some(item=>item.scopeType==='TENANT'&&item.scopeId===membership.tenantId&&item.canManageConfiguration))membership.scopes.push(scope('TENANT',membership.tenantId,{canView:true,canRequest:true,canManageConfiguration:true}))}return {id:user.id,email:user.email,displayName:user.displayName,provider,providerSubject:user.providerSubject,activeTenantId:memberships.length===1?memberships[0]!.tenantId:undefined,activeAccountId:undefined,permissions:[],memberships}}
 tenantsFor(user:SessionUser){return user.memberships.filter(m=>m.status==='ACTIVE').map(m=>({id:m.tenantId,name:m.tenantName,slug:m.tenantSlug,role:m.role}))}
 organisationsFor(user:SessionUser){if(env.AWS_CONNECTION_MODE==='manual')return [];return developmentOrganisations.filter(org=>this.canSeeTenant(user,org.tenantId))}
 ousFor(user:SessionUser){if(env.AWS_CONNECTION_MODE==='manual')return [];return developmentOus.filter(ou=>developmentOrganisations.some(org=>org.id===ou.organisationId&&this.canSeeTenant(user,org.tenantId)))}
 accountsFor(user:SessionUser,tenantId=user.activeTenantId){const source=env.AWS_CONNECTION_MODE==='manual'?this.manualAccounts:[...this.manualAccounts,...(env.ENABLE_AWS_DEMO_DATA?developmentAccounts:[])];return source.filter(account=>account.tenantId===tenantId&&(!account.isDemo||env.ENABLE_AWS_DEMO_DATA)&&this.canSeeAccount(user,account))}
 account(user:SessionUser,accountId:string){return this.accountsFor(user).find(account=>account.id===accountId||account.accountId===accountId)??(env.NODE_ENV==='test'?developmentAccounts.find(account=>(account.id===accountId||account.accountId===accountId)&&this.canSeeAccount(user,account)):undefined)}
 replaceManualAccounts(tenantId:string,accounts:AwsAccountContext[]){this.manualAccounts=this.manualAccounts.filter(account=>account.tenantId!==tenantId).concat(accounts.filter(account=>account.tenantId===tenantId&&account.sourceType==='MANUAL'&&!account.isDemo))}
 addManualAccount(account:AwsAccountContext){this.manualAccounts=this.manualAccounts.filter(item=>!(item.tenantId===account.tenantId&&(item.id===account.id||item.accountId===account.accountId)));this.manualAccounts.push({...account,sourceType:'MANUAL',connectionSource:'MANUAL',isDemo:false})}
 removeManualAccount(tenantId:string,accountId:string){this.manualAccounts=this.manualAccounts.filter(item=>!(item.tenantId===tenantId&&(item.id===accountId||item.accountId===accountId)))}
 allAccounts(){return [...this.manualAccounts,...(env.ENABLE_AWS_DEMO_DATA||env.NODE_ENV==='test'?developmentAccounts:[])]}
 private canSeeTenant(user:SessionUser,tenantId:string){return user.memberships.some(m=>m.tenantId===tenantId&&m.status==='ACTIVE')}
 private canSeeAccount(user:SessionUser,account:AwsAccountContext){
  const membership=user.memberships.find(m=>m.tenantId===account.tenantId&&m.status==='ACTIVE');if(!membership)return false;
  return membership.scopes.some(s=>s.canView&&(s.scopeType==='TENANT'&&s.scopeId===account.tenantId||s.scopeType==='AWS_ORGANISATION'&&s.scopeId===account.organisationId||s.scopeType==='ORGANISATIONAL_UNIT'&&s.scopeId===account.ouId||s.scopeType==='AWS_ACCOUNT'&&(s.scopeId===account.id||s.scopeId===account.accountId)));
 }
}

export const identityDomain=new IdentityDomainService();
export const accountTypeLabel=(type:AccountType)=>type.replaceAll('_',' ').toLowerCase().replace(/^\w/,c=>c.toUpperCase());

export async function persistDevelopmentIdentity(user:SessionUser){
 if(env.NODE_ENV!=='development'||user.provider!=='development')return;
 const membership=user.memberships.find(item=>item.tenantId===user.activeTenantId);if(!membership)return;
 await prisma.$transaction(async tx=>{
  await tx.tenant.upsert({where:{id:membership.tenantId},create:{id:membership.tenantId,name:membership.tenantName,slug:membership.tenantSlug,status:'ACTIVE'},update:{name:membership.tenantName,status:'ACTIVE'}});
  await tx.user.upsert({where:{id:user.id},create:{id:user.id,email:user.email,displayName:user.displayName,status:'ACTIVE',lastLoginAt:new Date()},update:{email:user.email,displayName:user.displayName,status:'ACTIVE',lastLoginAt:new Date()}});
  await tx.tenantMembership.upsert({where:{tenantId_userId:{tenantId:membership.tenantId,userId:user.id}},create:{id:membership.id,tenantId:membership.tenantId,userId:user.id,role:membership.role,status:'ACTIVE'},update:{role:membership.role,status:'ACTIVE'}});
  for(const item of membership.scopes)await tx.adminScope.upsert({where:{tenantMembershipId_scopeType_scopeId:{tenantMembershipId:membership.id,scopeType:item.scopeType,scopeId:item.scopeId}},create:{tenantMembershipId:membership.id,...item},update:{includeDescendants:item.includeDescendants,canView:item.canView,canRequest:item.canRequest,canApprove:item.canApprove,canProvision:item.canProvision,canRevoke:item.canRevoke,canManageConfiguration:item.canManageConfiguration}});
 });
}
