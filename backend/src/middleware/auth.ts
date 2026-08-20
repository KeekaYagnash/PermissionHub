import type { NextFunction,Response } from 'express';
import { env } from '../config/env.js';
import type { AppRole,AuthenticatedRequest } from '../types.js';
import type { NamedCapability } from '../services/authorization.service.js';
import { ApiError } from '../utils/http.js';
import { authorization } from '../services/authorization.service.js';
import { identityDomain } from '../services/identity-domain.service.js';
import { awsAccountRepository } from '../services/aws-account.repository.js';
import { safeEqualToken } from '../services/auth-provider.service.js';

export function authenticate(req:AuthenticatedRequest,_res:Response,next:NextFunction){
 if(!env.AUTH_ENABLED&&!env.ENABLE_DEV_AUTH)return next(new ApiError(503,'Authentication is disabled without a configured development identity.','AUTH_CONFIGURATION_REQUIRED'));
 if(!req.session.user&&!env.AUTH_ENABLED&&env.NODE_ENV!=='production'&&env.DEV_AUTH_USER_ID){const selected=identityDomain.findDevelopmentUser(env.DEV_AUTH_USER_ID);if(selected)req.session.user=identityDomain.sessionUser(selected,'development')}
 if(!req.session.user){const user=cognitoUser(req);if(user)req.session.user=user}
 const user=req.session.user;if(!user)return next(new ApiError(401,'Authentication required','UNAUTHENTICATED'));
 req.sessionUser=user;
 const membership=user.memberships.find(item=>item.tenantId===user.activeTenantId&&item.status==='ACTIVE');
 if(membership)req.auth={sub:user.id,organizationId:membership.tenantId,role:membership.role,email:user.email,name:user.displayName};
 next();
}
export function isConnectionAdmin(req:AuthenticatedRequest){return Boolean(req.sessionUser&&authorization.hasCapability(req.sessionUser,'CONNECTION_MANAGE'))}
export const authorize=(...roles:AppRole[])=>(req:AuthenticatedRequest,_res:Response,next:NextFunction)=>req.auth&&(roles.includes(req.auth.role)||(roles.includes('ORGANISATION_ADMIN')&&(req.path.startsWith('/aws/accounts')||req.path.startsWith('/aws/local-credentials'))&&isConnectionAdmin(req)))?next():next(new ApiError(403,'You do not have permission to perform this action','FORBIDDEN'));
export function requireConnectionAdmin(req:AuthenticatedRequest,_res:Response,next:NextFunction){return isConnectionAdmin(req)?next():next(new ApiError(403,'You are not authorised to administer AWS account connections.','AWS_CONNECTION_ADMIN_REQUIRED'))}
export function requireNamedCapability(capability:NamedCapability,accountScoped=false){
 return (req:AuthenticatedRequest,_res:Response,next:NextFunction)=>{
  const accountId=accountScoped?req.awsAccountContext?.id:undefined;
  return req.sessionUser&&authorization.hasCapability(req.sessionUser,capability,accountId)?next():next(new ApiError(403,'You do not have permission to perform this action.','CAPABILITY_FORBIDDEN',{capability}));
 };
}
export function tenantScope(req:AuthenticatedRequest,_res:Response,next:NextFunction){
 const user=req.sessionUser;if(!user?.activeTenantId)return next(new ApiError(409,'Select a tenant before continuing.','TENANT_REQUIRED'));
 const requested=req.headers['x-tenant-id']?.toString()||req.headers['x-organization-id']?.toString();
 if(requested&&requested!==user.activeTenantId)return next(new ApiError(403,'Cross-tenant access is prohibited.','TENANT_VIOLATION'));
 if(!authorization.canViewTenant(user,user.activeTenantId))return next(new ApiError(403,'Tenant membership is not active.','TENANT_VIOLATION'));
 req.tenantId=user.activeTenantId;next();
}
export async function accountScope(req:AuthenticatedRequest,_res:Response,next:NextFunction){
 try{const user=req.sessionUser!,headerRecordId=req.headers['x-aws-account-record-id']?.toString(),requested=user.activeAwsAccountRecordId??user.activeAccountId;
  if(headerRecordId&&headerRecordId!==requested)return next(new ApiError(403,'The requested AWS account does not match the active server session.','AWS_ACCOUNT_CONTEXT_MISMATCH'));
  if(!requested)return next(new ApiError(409,'Select an authorised AWS account before using this endpoint.','AWS_ACCOUNT_REQUIRED'));
  await awsAccountRepository.refreshManualAccounts(req.tenantId!);
  const account=identityDomain.account(user,requested);if(!account||!authorization.canViewAccount(user,account.id))return next(new ApiError(403,'AWS account access is not permitted.','AWS_ACCOUNT_FORBIDDEN'));
  if(!['CONNECTED','DEGRADED'].includes(account.connectionStatus))return next(new ApiError(409,'Validate and connect this AWS account before using AWS data.','AWS_ACCOUNT_NOT_CONNECTED'));
  req.awsAccountContext=account;next();
 }catch(error){next(error)}
}
export function requireCapability(capability:'request'|'approve'|'provision'|'revoke'|'manage'){
 return (req:AuthenticatedRequest,_res:Response,next:NextFunction)=>{const user=req.sessionUser!,account=req.awsAccountContext!,map={request:'REQUEST_CREATE',approve:'REQUEST_APPROVE',provision:'PROVISION_EXECUTE',revoke:'GRANT_REVOKE',manage:'CONNECTION_MANAGE'} as const;return authorization.hasCapability(user,map[capability],account.id)?next():next(new ApiError(403,`You cannot ${capability} in this AWS account.`,'SCOPE_FORBIDDEN'))};
}
export function csrfProtection(req:AuthenticatedRequest,_res:Response,next:NextFunction){if(!env.CSRF_ENABLED||req.sessionUser?.provider==='cognito'||['GET','HEAD','OPTIONS'].includes(req.method))return next();if(!safeEqualToken(req.headers['x-csrf-token']?.toString(),req.session.csrfToken))return next(new ApiError(403,'CSRF validation failed. Refresh the page and try again.','CSRF_INVALID'));next()}

function cognitoUser(req:AuthenticatedRequest){
 const event=(req as any).apiGateway?.event;
 const claims=event?.requestContext?.authorizer?.jwt?.claims;
 if(!claims?.sub)return undefined;
 const rawGroups=claims['cognito:groups'];
 const groups=Array.isArray(rawGroups)?rawGroups:typeof rawGroups==='string'?rawGroups.split(',').map(item=>item.trim()).filter(Boolean):[];
 return identityDomain.sessionUserFromCognito({sub:String(claims.sub),email:claims.email?String(claims.email):undefined,name:claims.name?String(claims.name):undefined,groups});
}
