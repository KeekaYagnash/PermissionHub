import type { AdminScope,AppRole,AwsAccountContext,SessionUser } from '../types.js';
import { developmentAccounts,developmentOrganisations,developmentOus } from './identity-domain.service.js';

type Capability='canView'|'canRequest'|'canApprove'|'canProvision'|'canRevoke'|'canManageConfiguration';
export interface ScopedRequest {tenantId?:string;awsAccountId?:string;requesterUserId?:string;requester?:string;status?:string;requiredApprovalStages?:string[];completedApprovalStages?:string[]}
export interface ScopedGrant {awsAccountId?:string;requestId?:string}

export class AuthorizationService {
 canViewTenant(user:SessionUser,tenantId:string){return this.membership(user,tenantId)!==undefined}
 canViewOrganisation(user:SessionUser,organisationId:string){const org=developmentOrganisations.find(o=>o.id===organisationId||o.organisationId===organisationId);return Boolean(org&&this.allowed(user,'canView',{tenantId:org.tenantId,organisationId:org.id}))}
 canViewOU(user:SessionUser,ouId:string){const ou=developmentOus.find(o=>o.id===ouId||o.ouId===ouId),org=ou&&developmentOrganisations.find(o=>o.id===ou.organisationId);return Boolean(ou&&org&&this.allowed(user,'canView',{tenantId:org.tenantId,organisationId:org.id,ouId:ou.id}))}
 canViewAccount(user:SessionUser,accountId:string){const account=developmentAccounts.find(a=>a.id===accountId||a.accountId===accountId);return Boolean(account&&this.allowed(user,'canView',account))}
 canRequestAccess(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canRequest')}
 canApproveInAccount(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canApprove')}
 canProvisionInAccount(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canProvision')}
 canRevokeInAccount(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canRevoke')}
 canApproveRequest(user:SessionUser,request:ScopedRequest){if(request.requesterUserId===user.id||(!request.requesterUserId&&request.requester===user.displayName))return false;if(!request.awsAccountId||!this.forAccount(user,request.awsAccountId,'canApprove'))return false;const stages=(request.requiredApprovalStages??[]).filter(stage=>stage!=='PROVISIONER'),stage=stages[(request.completedApprovalStages??[]).length];if(!stage)return true;const roles=user.memberships.filter(m=>m.status==='ACTIVE').map(m=>m.role);if(stage==='ACCOUNT_APPROVER')return roles.some(role=>['ACCOUNT_APPROVER','OU_ADMIN','ORGANISATION_ADMIN'].includes(role));return roles.includes(stage as AppRole)}
 canProvisionRequest(user:SessionUser,request:ScopedRequest){return Boolean(request.awsAccountId&&request.status==='Approved'&&this.forAccount(user,request.awsAccountId,'canProvision'))}
 canRevokeGrant(user:SessionUser,grant:ScopedGrant){return Boolean(grant.awsAccountId&&this.forAccount(user,grant.awsAccountId,'canRevoke'))}
 canManageAccountConfiguration(user:SessionUser,accountId:string){return this.forAccount(user,accountId,'canManageConfiguration')}
 permissions(user:SessionUser,accountId?:string){const checks:Record<string,boolean>={viewTenant:Boolean(user.activeTenantId&&this.canViewTenant(user,user.activeTenantId))};if(accountId)Object.assign(checks,{viewAccount:this.canViewAccount(user,accountId),requestAccess:this.canRequestAccess(user,accountId),approveRequest:this.canApproveInAccount(user,accountId),provisionRequest:this.canProvisionInAccount(user,accountId),revokeGrant:this.canRevokeInAccount(user,accountId),manageAccount:this.canManageAccountConfiguration(user,accountId)});return Object.entries(checks).filter(([,allowed])=>allowed).map(([permission])=>permission)}
 private forAccount(user:SessionUser,accountId:string,capability:Capability){const account=developmentAccounts.find(a=>a.id===accountId||a.accountId===accountId);return Boolean(account&&this.allowed(user,capability,account))}
 private membership(user:SessionUser,tenantId:string){return user.memberships.find(m=>m.tenantId===tenantId&&m.status==='ACTIVE')}
 private allowed(user:SessionUser,capability:Capability,context:Pick<AwsAccountContext,'tenantId'> & Partial<AwsAccountContext>){
  const membership=this.membership(user,context.tenantId);if(!membership)return false;
  return membership.scopes.some(scope=>Boolean(scope[capability])&&this.scopeMatches(scope,context));
 }
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
