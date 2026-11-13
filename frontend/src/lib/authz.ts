import type { AppRole,AuthSession,SessionUser } from '../types';

export type Capability=
 |'REQUEST_VIEW_OWN'|'REQUEST_VIEW_ALL'|'REQUEST_CREATE'|'REQUEST_REVIEW'|'REQUEST_APPROVE'|'REQUEST_REJECT'|'REQUEST_REASSIGN'
 |'PERMISSION_CATALOGUE_VIEW'|'PERMISSION_ADMIN'
 |'IDENTITY_VIEW_OWN'|'IDENTITY_VIEW_ALL'|'IDENTITY_ADMIN'
 |'ACTIVITY_VIEW'
 |'ADMINISTRATION_VIEW'|'ADMINISTRATION_MANAGE'
 |'CONNECTION_VIEW'|'CONNECTION_MANAGE'
 |'PROVISION_EXECUTE'|'GRANT_REVOKE';

const requester:Capability[]=['REQUEST_VIEW_OWN','REQUEST_CREATE','PERMISSION_CATALOGUE_VIEW','IDENTITY_VIEW_OWN'];
const approver:Capability[]=['REQUEST_VIEW_OWN','REQUEST_REVIEW','REQUEST_APPROVE','REQUEST_REJECT'];
const securityReviewer:Capability[]=['REQUEST_VIEW_OWN','REQUEST_VIEW_ALL','REQUEST_CREATE','REQUEST_REVIEW','REQUEST_APPROVE','REQUEST_REJECT','REQUEST_REASSIGN','PERMISSION_CATALOGUE_VIEW','IDENTITY_VIEW_OWN','IDENTITY_VIEW_ALL','ACTIVITY_VIEW','ADMINISTRATION_VIEW','CONNECTION_VIEW'];
const admin:Capability[]=['REQUEST_VIEW_OWN','REQUEST_VIEW_ALL','REQUEST_CREATE','REQUEST_REVIEW','REQUEST_APPROVE','REQUEST_REJECT','REQUEST_REASSIGN','PERMISSION_CATALOGUE_VIEW','PERMISSION_ADMIN','IDENTITY_VIEW_OWN','IDENTITY_VIEW_ALL','IDENTITY_ADMIN','ACTIVITY_VIEW','ADMINISTRATION_VIEW','ADMINISTRATION_MANAGE','CONNECTION_VIEW','CONNECTION_MANAGE','PROVISION_EXECUTE','GRANT_REVOKE'];

export const roleCapabilities:Record<AppRole|'APPROVER'|'ADMIN',Capability[]>={
 REQUESTER:requester,
 ACCOUNT_APPROVER:approver,
 APPROVER:approver,
 OU_ADMIN:[...new Set<Capability>([...requester,...approver,'REQUEST_REASSIGN','ADMINISTRATION_VIEW','CONNECTION_VIEW'])],
 SECURITY_REVIEWER:securityReviewer,
 PROVISIONER:['REQUEST_VIEW_OWN','PROVISION_EXECUTE','GRANT_REVOKE'],
 ORGANISATION_ADMIN:admin,
 PLATFORM_ADMIN:admin,
 ADMIN:admin
};

const legacyPermissions:Record<string,Capability>={
 requestAccess:'REQUEST_CREATE',
 approveRequest:'REQUEST_APPROVE',
 provisionRequest:'PROVISION_EXECUTE',
 revokeGrant:'GRANT_REVOKE',
 manageAccount:'CONNECTION_MANAGE',
 viewTenant:'REQUEST_VIEW_OWN'
};

export function userRoles(user?:SessionUser):string[]{
 if(!user)return [];
 return [...new Set([
  ...user.memberships.filter(m=>m.status==='ACTIVE'&&(!user.activeTenantId||m.tenantId===user.activeTenantId)).map(m=>m.role),
  ...(user.roleAssignments??[]).filter(item=>!user.activeTenantId||item.tenantId===user.activeTenantId).map(item=>item.role)
 ])];
}

export function getCapabilities(user?:SessionUser):Capability[]{
 if(!user)return [];
 const granted=new Set<Capability>();
 for(const role of userRoles(user))for(const capability of roleCapabilities[role as keyof typeof roleCapabilities]??[])granted.add(capability);
 for(const permission of user.permissions??[]){
  if(isCapability(permission))granted.add(permission);
  else if(legacyPermissions[permission])granted.add(legacyPermissions[permission]);
 }
 return [...granted];
}

export function can(userOrSession:SessionUser|AuthSession|undefined,capability:Capability){
 const user=(userOrSession as AuthSession|undefined)?.user??userOrSession as SessionUser|undefined;
 return getCapabilities(user).includes(capability);
}

function isCapability(value:string):value is Capability{return [
 'REQUEST_VIEW_OWN','REQUEST_VIEW_ALL','REQUEST_CREATE','REQUEST_REVIEW','REQUEST_APPROVE','REQUEST_REJECT','REQUEST_REASSIGN',
 'PERMISSION_CATALOGUE_VIEW','PERMISSION_ADMIN','IDENTITY_VIEW_OWN','IDENTITY_VIEW_ALL','IDENTITY_ADMIN','ACTIVITY_VIEW',
 'ADMINISTRATION_VIEW','ADMINISTRATION_MANAGE','CONNECTION_VIEW','CONNECTION_MANAGE','PROVISION_EXECUTE','GRANT_REVOKE'
].includes(value)}
