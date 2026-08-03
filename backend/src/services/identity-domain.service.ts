import type { AccountType,AdminScope,AppRole,AwsAccountContext,SessionUser,TenantMembership } from '../types.js';

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
 findDevelopmentUser(id:string){return developmentUsers.find(user=>user.id===id)}
 findByProviderSubject(provider:string,subject:string,email?:string){return developmentUsers.find(user=>user.providerSubject===subject||(provider!=='development'&&email&&user.email.toLowerCase()===email.toLowerCase()))}
 sessionUser(user:DirectoryUser,provider:string):SessionUser{return {id:user.id,email:user.email,displayName:user.displayName,provider,providerSubject:user.providerSubject,activeTenantId:user.memberships.length===1?user.memberships[0]!.tenantId:undefined,activeAccountId:undefined,permissions:[],memberships:user.memberships}}
 tenantsFor(user:SessionUser){return user.memberships.filter(m=>m.status==='ACTIVE').map(m=>({id:m.tenantId,name:m.tenantName,slug:m.tenantSlug,role:m.role}))}
 organisationsFor(user:SessionUser){return developmentOrganisations.filter(org=>this.canSeeTenant(user,org.tenantId))}
 ousFor(user:SessionUser){return developmentOus.filter(ou=>developmentOrganisations.some(org=>org.id===ou.organisationId&&this.canSeeTenant(user,org.tenantId)))}
 accountsFor(user:SessionUser,tenantId=user.activeTenantId){return developmentAccounts.filter(account=>account.tenantId===tenantId&&this.canSeeAccount(user,account))}
 account(user:SessionUser,accountId:string){return this.accountsFor(user).find(account=>account.id===accountId||account.accountId===accountId)}
 private canSeeTenant(user:SessionUser,tenantId:string){return user.memberships.some(m=>m.tenantId===tenantId&&m.status==='ACTIVE')}
 private canSeeAccount(user:SessionUser,account:AwsAccountContext){
  const membership=user.memberships.find(m=>m.tenantId===account.tenantId&&m.status==='ACTIVE');if(!membership)return false;
  return membership.scopes.some(s=>s.canView&&(s.scopeType==='TENANT'&&s.scopeId===account.tenantId||s.scopeType==='AWS_ORGANISATION'&&s.scopeId===account.organisationId||s.scopeType==='ORGANISATIONAL_UNIT'&&s.scopeId===account.ouId||s.scopeType==='AWS_ACCOUNT'&&(s.scopeId===account.id||s.scopeId===account.accountId)));
 }
}

export const identityDomain=new IdentityDomainService();
export const accountTypeLabel=(type:AccountType)=>type.replaceAll('_',' ').toLowerCase().replace(/^\w/,c=>c.toUpperCase());
