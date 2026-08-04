import type { NextFunction,Response } from 'express';
import { env } from '../config/env.js';
import type { AppRole,AuthenticatedRequest } from '../types.js';
import { ApiError } from '../utils/http.js';
import { authorization } from '../services/authorization.service.js';
import { identityDomain } from '../services/identity-domain.service.js';
import { safeEqualToken } from '../services/auth-provider.service.js';

export function authenticate(req:AuthenticatedRequest,_res:Response,next:NextFunction){
 if(!env.AUTH_ENABLED&&!env.ENABLE_DEV_AUTH)return next(new ApiError(503,'Authentication is disabled without a configured development identity.','AUTH_CONFIGURATION_REQUIRED'));
 if(!req.session.user&&!env.AUTH_ENABLED&&env.NODE_ENV!=='production'&&env.DEV_AUTH_USER_ID){const selected=identityDomain.findDevelopmentUser(env.DEV_AUTH_USER_ID);if(selected)req.session.user=identityDomain.sessionUser(selected,'development')}
 const user=req.session.user;if(!user)return next(new ApiError(401,'Authentication required','UNAUTHENTICATED'));
 req.sessionUser=user;
 const membership=user.memberships.find(item=>item.tenantId===user.activeTenantId&&item.status==='ACTIVE');
 if(membership)req.auth={sub:user.id,organizationId:membership.tenantId,role:membership.role,email:user.email,name:user.displayName};
 next();
}
export function isConnectionAdmin(req:AuthenticatedRequest){const user=req.sessionUser!,tenantId=req.tenantId??user.activeTenantId,membership=user.memberships.find(item=>item.tenantId===tenantId&&item.status==='ACTIVE');return Boolean(membership?.scopes.some(scope=>scope.canManageConfiguration&&scope.canView&&scope.scopeType==='TENANT'&&scope.scopeId===tenantId))}
export const authorize=(...roles:AppRole[])=>(req:AuthenticatedRequest,_res:Response,next:NextFunction)=>req.auth&&(roles.includes(req.auth.role)||(roles.includes('ORGANISATION_ADMIN')&&(req.path.startsWith('/aws/accounts')||req.path.startsWith('/aws/local-credentials'))&&isConnectionAdmin(req)))?next():next(new ApiError(403,'You do not have permission to perform this action','FORBIDDEN'));
export function requireConnectionAdmin(req:AuthenticatedRequest,_res:Response,next:NextFunction){return isConnectionAdmin(req)?next():next(new ApiError(403,'You are not authorised to administer AWS account connections.','AWS_CONNECTION_ADMIN_REQUIRED'))}
export function tenantScope(req:AuthenticatedRequest,_res:Response,next:NextFunction){
 const user=req.sessionUser;if(!user?.activeTenantId)return next(new ApiError(409,'Select a tenant before continuing.','TENANT_REQUIRED'));
 const requested=req.headers['x-tenant-id']?.toString()||req.headers['x-organization-id']?.toString();
 if(requested&&requested!==user.activeTenantId)return next(new ApiError(403,'Cross-tenant access is prohibited.','TENANT_VIOLATION'));
 if(!authorization.canViewTenant(user,user.activeTenantId))return next(new ApiError(403,'Tenant membership is not active.','TENANT_VIOLATION'));
 req.tenantId=user.activeTenantId;next();
}
export function accountScope(req:AuthenticatedRequest,_res:Response,next:NextFunction){
 const user=req.sessionUser!,headerAccount=req.headers['x-aws-account-id']?.toString(),requested=user.activeAccountId;
 if(headerAccount&&headerAccount!==requested)return next(new ApiError(403,'The requested AWS account does not match the active server session.','AWS_ACCOUNT_CONTEXT_MISMATCH'));
 if(!requested)return next(new ApiError(409,'Select an authorised AWS account before using this endpoint.','AWS_ACCOUNT_REQUIRED'));
 const account=identityDomain.account(user,requested);if(!account||!authorization.canViewAccount(user,account.id))return next(new ApiError(403,'AWS account access is not permitted.','AWS_ACCOUNT_FORBIDDEN'));
 if(!['CONNECTED','DEGRADED'].includes(account.connectionStatus))return next(new ApiError(409,'Validate and connect this AWS account before using AWS data.','AWS_ACCOUNT_NOT_CONNECTED'));
 req.awsAccountContext=account;next();
}
export function requireCapability(capability:'request'|'approve'|'provision'|'revoke'|'manage'){
 return (req:AuthenticatedRequest,_res:Response,next:NextFunction)=>{const user=req.sessionUser!,account=req.awsAccountContext!;const allowed=capability==='request'?authorization.canRequestAccess(user,account.id):capability==='manage'?authorization.canManageAccountConfiguration(user,account.id):user.memberships.some(m=>m.tenantId===account.tenantId&&m.scopes.some(s=>s[`can${capability[0]!.toUpperCase()}${capability.slice(1)}` as keyof typeof s]===true));return allowed?next():next(new ApiError(403,`You cannot ${capability} in this AWS account.`,'SCOPE_FORBIDDEN'))};
}
export function csrfProtection(req:AuthenticatedRequest,_res:Response,next:NextFunction){if(['GET','HEAD','OPTIONS'].includes(req.method))return next();if(!safeEqualToken(req.headers['x-csrf-token']?.toString(),req.session.csrfToken))return next(new ApiError(403,'CSRF validation failed. Refresh the page and try again.','CSRF_INVALID'));next()}
