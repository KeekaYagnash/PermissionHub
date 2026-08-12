import type { AdminScope,AppRole,AwsAccountContext,SessionUser } from '../types.js';
import { developmentOrganisations,developmentOus,identityDomain } from './identity-domain.service.js';
import { env,isLocalProvisioningEnabled } from '../config/env.js';

type Capability='canView'|'canRequest'|'canApprove'|'canProvision'|'canRevoke'|'canManageConfiguration';
export type NamedCapability=
 |'REQUEST_VIEW_OWN'|'REQUEST_VIEW_ALL'|'REQUEST_CREATE'|'REQUEST_REVIEW'|'REQUEST_APPROVE'|'REQUEST_REJECT'|'REQUEST_REASSIGN'
 |'PERMISSION_CATALOGUE_VIEW'|'PERMISSION_ADMIN'
 |'IDENTITY_VIEW_OWN'|'IDENTITY_VIEW_ALL'|'IDENTITY_ADMIN'
 |'ACTIVITY_VIEW'
 |'ADMINISTRATION_VIEW'|'ADMINISTRATION_MANAGE'
 |'CONNECTION_VIEW'|'CONNECTION_MANAGE'
 |'PROVISION_EXECUTE'|'GRANT_REVOKE';
const requester:NamedCapability[]=['REQUEST_VIEW_OWN','REQUEST_CREATE','PERMISSION_CATALOGUE_VIEW','IDENTITY_VIEW_OWN'];
const approver:NamedCapability[]=['REQUEST_VIEW_OWN','REQUEST_REVIEW','REQUEST_APPROVE','REQUEST_REJECT'];
const securityReviewer:NamedCapability[]=['REQUEST_VIEW_OWN','REQUEST_VIEW_ALL','REQUEST_CREATE','REQUEST_REVIEW','REQUEST_APPROVE','REQUEST_REJECT','REQUEST_REASSIGN','PERMISSION_CATALOGUE_VIEW','IDENTITY_VIEW_OWN','IDENTITY_VIEW_ALL','ACTIVITY_VIEW','ADMINISTRATION_VIEW','CONNECTION_VIEW'];
const admin:NamedCapability[]=['REQUEST_VIEW_OWN','REQUEST_VIEW_ALL','REQUEST_CREATE','REQUEST_REVIEW','REQUEST_APPROVE','REQUEST_REJECT','REQUEST_REASSIGN','PERMISSION_CATALOGUE_VIEW','PERMISSION_ADMIN','IDENTITY_VIEW_OWN','IDENTITY_VIEW_ALL','IDENTITY_ADMIN','ACTIVITY_VIEW','ADMINISTRATION_VIEW','ADMINISTRATION_MANAGE','CONNECTION_VIEW','CONNECTION_MANAGE','PROVISION_EXECUTE','GRANT_REVOKE'];
export const roleCapabilities:Record<AppRole|'APPROVER'|'ADMIN',NamedCapability[]>={
 REQUESTER:requester,
 ACCOUNT_APPROVER:approver,
 APPROVER:approver,
 OU_ADMIN:[...new Set<NamedCapability>([...requester,...approver,'REQUEST_REASSIGN','ADMINISTRATION_VIEW','CONNECTION_VIEW'])],
 SECURITY_REVIEWER:securityReviewer,
 PROVISIONER:['REQUEST_VIEW_OWN','PROVISION_EXECUTE','GRANT_REVOKE'],
 ORGANISATION_ADMIN:admin,
 PLATFORM_ADMIN:admin,
 ADMIN:admin
};
export interface ScopedRequest {tenantId?:string;awsAccountId?:string;requesterUserId?:string;requester?:string;approverUserId?:string;status?:string;requiredApprovalStages?:string[];completedApprovalStages?:string[]}
export interface ScopedGrant {awsAccountId?:string;requestId?:string}

export class AuthorizationService {
 canViewTenant(user:SessionUser,tenantId:string){return this.membership(user,tenantId)!==undefined}
 canViewOrganisation(user:SessionUser,organisationId:string){const org=developmentOrganisations.find(o=>o.id===organisationId||o.organisationId===organisationId);return Boolean(org&&this.allowed(user,'canView',{tenantId:org.tenantId,organisationId:org.id}))}
 canViewOU(user:SessionUser,ouId:string){const ou=developmentOus.find(o=>o.id===ouId||o.ouId===ouId),org=ou&&developmentOrganisations.find(o=>o.id===ou.organisationId);return Boolean(ou&&org&&this.allowed(user,'canView',{tenantId:org.tenantId,organisationId:org.id,ouId:ou.id}))}
 canViewAccount(user:SessionUser,accountId:string){const account=identityDomain.allAccounts().find(a=>a.id===accountId||a.accountId===accountId);return Boolean(account&&this.allowed(user,'canView',account))}
 canRequestAccess(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canRequest')}
 canApproveInAccount(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canApprove')}
 canProvisionInAccount(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canProvision')}
 canRevokeInAccount(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canRevoke')}
 canApproveRequest(user:SessionUser,request:ScopedRequest){if(!request.awsAccountId)return false;if(isLocalProvisioningEnabled())return this.forAccount(user,request.awsAccountId,'canView');const self=request.requesterUserId===user.id||(!request.requesterUserId&&request.requester===user.displayName);if(self&&!(env.NODE_ENV!=='production'&&env.ALLOW_DEV_SELF_APPROVAL))return false;if(request.approverUserId&&request.approverUserId!==user.id)return false;const stages=(request.requiredApprovalStages??[]).filter(stage=>stage!=='PROVISIONER'),stage=stages[(request.completedApprovalStages??[]).length];if(!stage)return true;const roles=this.rolesForAccount(user,request.awsAccountId);if(stage==='ACCOUNT_APPROVER')return roles.some(role=>['ACCOUNT_APPROVER','OU_ADMIN','ORGANISATION_ADMIN'].includes(role));return roles.includes(stage as AppRole)}
 canProvisionRequest(user:SessionUser,request:ScopedRequest){if(!request.awsAccountId||request.status!=='Approved')return false;if(isLocalProvisioningEnabled())return this.forAccount(user,request.awsAccountId,'canView');return this.forAccount(user,request.awsAccountId,'canProvision')}
 canRevokeGrant(user:SessionUser,grant:ScopedGrant){return Boolean(grant.awsAccountId&&this.forAccount(user,grant.awsAccountId,'canRevoke'))}
 canManageAccountConfiguration(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canManageConfiguration')}
 canViewRequest(user:SessionUser,request:ScopedRequest){if(this.hasCapability(user,'REQUEST_VIEW_ALL'))return true;if(request.requesterUserId===user.id||(!request.requesterUserId&&request.requester===user.displayName))return this.hasCapability(user,'REQUEST_VIEW_OWN');return this.canApproveRequest(user,request)}
 hasCapability(user:SessionUser,capability:NamedCapability,accountId?:string){const base=this.namedCapabilities(user);if(!base.has(capability))return false;if(!accountId)return true;return capability==='REQUEST_CREATE'?this.canRequestAccess(user,accountId):capability==='REQUEST_APPROVE'||capability==='REQUEST_REJECT'?this.canApproveInAccount(user,accountId):capability==='PROVISION_EXECUTE'?this.canProvisionInAccount(user,accountId):capability==='GRANT_REVOKE'?this.canRevokeInAccount(user,accountId):capability==='CONNECTION_MANAGE'||capability==='ADMINISTRATION_MANAGE'||capability==='PERMISSION_ADMIN'||capability==='IDENTITY_ADMIN'?this.canManageAccountConfiguration(user,accountId):this.canViewAccount(user,accountId)}
 permissions(user:SessionUser,accountId?:string){const named=[...this.namedCapabilities(user)].filter(capability=>this.hasCapability(user,capability,accountId));const legacy:Record<string,boolean>={viewTenant:Boolean(user.activeTenantId&&this.canViewTenant(user,user.activeTenantId))};if(accountId)Object.assign(legacy,{viewAccount:this.canViewAccount(user,accountId),requestAccess:this.canRequestAccess(user,accountId),approveRequest:this.canApproveInAccount(user,accountId),provisionRequest:this.canProvisionInAccount(user,accountId),revokeGrant:this.canRevokeInAccount(user,accountId),manageAccount:this.canManageAccountConfiguration(user,accountId)});return [...new Set([...named,...Object.entries(legacy).filter(([,allowed])=>allowed).map(([permission])=>permission)])]}
 rolesForAccount(user:SessionUser,accountId:string){const account=identityDomain.allAccounts().find(a=>a.id===accountId||a.accountId===accountId),membershipRoles=user.memberships.filter(m=>m.status==='ACTIVE'&&(!account||m.tenantId===account.tenantId)).map(m=>m.role),assigned=(user.roleAssignments??[]).filter(item=>item.awsAccountId===account?.id&&item.tenantId===account.tenantId).map(item=>item.role);return [...new Set([...membershipRoles,...assigned])]}
 private forAccount(user:SessionUser,accountId:string,capability:Capability){const account=identityDomain.allAccounts().find(a=>a.id===accountId||a.accountId===accountId);return Boolean(account&&this.allowed(user,capability,account))}
 private membership(user:SessionUser,tenantId:string){return user.memberships.find(m=>m.tenantId===tenantId&&m.status==='ACTIVE')}
 private allowed(user:SessionUser,capability:Capability,context:Pick<AwsAccountContext,'tenantId'> & Partial<AwsAccountContext>){
  const membership=this.membership(user,context.tenantId);if(!membership)return false;
  if(membership.scopes.some(scope=>Boolean(scope[capability])&&this.scopeMatches(scope,context)))return true;
  const roleAssignments=user.roleAssignments?.filter(item=>item.tenantId===context.tenantId&&item.awsAccountId===context.id)??[];
  return roleAssignments.some(item=>capability==='canApprove'?['SECURITY_REVIEWER','ACCOUNT_APPROVER'].includes(item.role):capability==='canProvision'?item.role==='PROVISIONER':capability==='canRevoke'?item.role==='PROVISIONER':capability==='canView');
 }
 private namedCapabilities(user:SessionUser){const capabilities=new Set<NamedCapability>();for(const role of this.allRoles(user)){for(const capability of roleCapabilities[role as keyof typeof roleCapabilities]??[])capabilities.add(capability)}return capabilities}
 private allRoles(user:SessionUser){return [...new Set([...user.memberships.filter(m=>m.status==='ACTIVE'&&(!user.activeTenantId||m.tenantId===user.activeTenantId)).map(m=>m.role),...(user.roleAssignments??[]).filter(item=>!user.activeTenantId||item.tenantId===user.activeTenantId).map(item=>item.role)])]}
 private scopeMatches(scope:AdminScope,context:Pick<AwsAccountContext,'tenantId'> & Partial<AwsAccountContext>){
  if(scope.scopeType==='TENANT')return scope.scopeId===context.tenantId;
  if(scope.scopeType==='AWS_ORGANISATION')return scope.scopeId===context.organisationId;
  if(scope.scopeType==='AWS_ACCOUNT')return scope.scopeId===context.id||scope.scopeId===context.accountId;
  if(scope.scopeType==='ORGANISATIONAL_UNIT')return scope.scopeId===context.ouId||Boolean(scope.includeDescendants&&context.ouId&&this.isOuDescendant(context.ouId,scope.scopeId));
  return false;
 }
 private isOuDescendant(ouId:string,ancestorId:string){let current=developmentOus.find(ou=>ou.id===ouId||ou.ouId===ouId);while(current?.parentOuId){if(current.parentOuId===ancestorId)return true;current=developmentOus.find(ou=>ou.id===current!.parentOuId||ou.ouId===current!.parentOuId)}return false}
}

export const authorization=new AuthorizationService();
export const roleAllows=(role:AppRole,allowed:AppRole[])=>allowed.includes(role);
