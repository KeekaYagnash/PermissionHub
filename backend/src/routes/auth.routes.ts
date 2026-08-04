import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { asyncHandler,ApiError } from '../utils/http.js';
import { configuredAuthProvider,csrfToken,DevelopmentAuthProvider,safeEqualToken } from '../services/auth-provider.service.js';
import { developmentUsers,identityDomain,persistDevelopmentIdentity } from '../services/identity-domain.service.js';
import { authorization } from '../services/authorization.service.js';
import type { AuthenticatedRequest,SessionUser } from '../types.js';
import { securityAudit } from '../services/security-audit.service.js';
import { awsAccountRepository } from '../services/aws-account.repository.js';

const router=Router(),provider=configuredAuthProvider();
const authLimiter=rateLimit({windowMs:60_000,limit:20,standardHeaders:'draft-8',legacyHeaders:false});
const requireUser=(req:AuthenticatedRequest)=>{if(!req.session.user)throw new ApiError(401,'Authentication required.','UNAUTHENTICATED');return req.session.user};
const requireCsrf=(req:AuthenticatedRequest)=>{if(!safeEqualToken(req.headers['x-csrf-token']?.toString(),req.session.csrfToken))throw new ApiError(403,'CSRF validation failed.','CSRF_INVALID')};
const regenerate=(req:AuthenticatedRequest)=>new Promise<void>((resolve,reject)=>req.session.regenerate(error=>error?reject(error):resolve()));
const save=(req:AuthenticatedRequest)=>new Promise<void>((resolve,reject)=>req.session.save(error=>error?reject(error):resolve()));
const destroy=(req:AuthenticatedRequest)=>new Promise<void>((resolve,reject)=>req.session.destroy(error=>error?reject(error):resolve()));
const configuredDevUser=()=>env.NODE_ENV!=='production'&&!env.AUTH_ENABLED&&env.ENABLE_DEV_AUTH&&env.DEV_AUTH_USER_ID?identityDomain.findDevelopmentUser(env.DEV_AUTH_USER_ID):undefined;
const activeRecordId=(user:SessionUser)=>user.activeAwsAccountRecordId??user.activeAccountId;
const clearActive=(user:SessionUser)=>{user.activeAwsAccountRecordId=undefined;user.activeAccountId=undefined};
const setActive=(user:SessionUser,value:string)=>{user.activeAwsAccountRecordId=value;user.activeAccountId=value};
const sessionPayload=(user:SessionUser|undefined,token:string)=>({authenticated:Boolean(user),user:user?{...user,activeAwsAccountRecordId:activeRecordId(user),permissions:authorization.permissions(user,activeRecordId(user))}:undefined,csrfToken:token,authProvider:'development',devAuthAvailable:env.NODE_ENV!=='production'&&env.ENABLE_DEV_AUTH,developmentAuthenticationActive:Boolean(user&&configuredDevUser()),awsConnectionMode:env.AWS_CONNECTION_MODE,demoDataEnabled:env.ENABLE_AWS_DEMO_DATA});

router.get('/session',asyncHandler(async(req:AuthenticatedRequest,res)=>{req.session.csrfToken??=csrfToken();if(!req.session.user){const selected=configuredDevUser();if(selected)req.session.user=identityDomain.sessionUser(selected,'development')}res.json({data:sessionPayload(req.session.user,req.session.csrfToken)})}));
router.get(['/login','/callback','/providers'],(_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'SSO authentication is not available.'}}));
router.get('/development-users',(_req,res)=>{if(env.NODE_ENV==='production'||!env.ENABLE_DEV_AUTH)throw new ApiError(404,'Not found.','NOT_FOUND');res.json({data:developmentUsers.map(user=>({id:user.id,email:user.email,displayName:user.displayName,roles:user.memberships.map(m=>m.role)}))})});
router.post('/development-login',authLimiter,asyncHandler(async(req:AuthenticatedRequest,res)=>{requireCsrf(req);if(!(provider instanceof DevelopmentAuthProvider))throw new ApiError(400,'Development authentication is not the configured provider.','AUTH_PROVIDER_MISMATCH');const {userId}=z.object({userId:z.string().min(1)}).parse(req.body);const user=await provider.authenticate(userId);await persistDevelopmentIdentity(user);await regenerate(req);req.session.user=user;req.session.csrfToken=csrfToken();await save(req);securityAudit.record({tenantId:user.activeTenantId,actorUserId:user.id,action:'USER_LOGIN',outcome:'SUCCESS',metadata:{provider:'development'}});res.json({data:sessionPayload(user,req.session.csrfToken)})}));
router.post('/logout',asyncHandler(async(req:AuthenticatedRequest,res)=>{requireCsrf(req);const user=req.session.user,target=await provider.signOut(user);if(user)securityAudit.record({tenantId:user.activeTenantId,actorUserId:user.id,action:'USER_LOGOUT',outcome:'SUCCESS',metadata:{provider:user.provider}});await destroy(req);res.clearCookie(env.SESSION_COOKIE_NAME);res.json({data:target})}));
router.post('/select-tenant',asyncHandler(async(req:AuthenticatedRequest,res)=>{requireCsrf(req);const user=requireUser(req),{tenantId}=z.object({tenantId:z.string()}).parse(req.body);if(!authorization.canViewTenant(user,tenantId))throw new ApiError(403,'Tenant selection is not permitted.','TENANT_FORBIDDEN');user.activeTenantId=tenantId;clearActive(user);req.session.user=user;await save(req);res.json({data:sessionPayload(user,req.session.csrfToken!)})}));
router.post('/select-account',asyncHandler(async(req:AuthenticatedRequest,res)=>{requireCsrf(req);const user=requireUser(req),value=z.object({accountRecordId:z.string().optional(),accountId:z.string().optional()}).parse(req.body),accountRecordId=value.accountRecordId??value.accountId;if(!accountRecordId)throw new ApiError(422,'PermissionHub account record ID is required.','VALIDATION_ERROR');await awsAccountRepository.refreshManualAccounts(user.activeTenantId!);const account=await awsAccountRepository.getByRecordId(user.activeTenantId!,accountRecordId);if(!account||!identityDomain.account(user,account.id)||!authorization.canViewAccount(user,account.id))throw new ApiError(403,'AWS account selection is not permitted.','AWS_ACCOUNT_FORBIDDEN');if(!['CONNECTED','DEGRADED'].includes(account.connectionStatus))throw new ApiError(409,'Only validated AWS accounts can be selected.','AWS_ACCOUNT_NOT_CONNECTED');setActive(user,account.id);req.session.user=user;await save(req);res.json({data:sessionPayload(user,req.session.csrfToken!)})}));
router.post('/clear-account',asyncHandler(async(req:AuthenticatedRequest,res)=>{requireCsrf(req);const user=requireUser(req);clearActive(user);req.session.user=user;await save(req);res.json({data:sessionPayload(user,req.session.csrfToken!)})}));
router.get('/context',asyncHandler(async(req:AuthenticatedRequest,res)=>{const user=requireUser(req);const accounts=user.activeTenantId?await awsAccountRepository.getAuthorisedAccountsForUser(user,user.activeTenantId):[],active=activeRecordId(user);if(active&&!accounts.some(account=>account.id===active)){clearActive(user);req.session.user=user;await save(req)}res.json({data:{tenants:identityDomain.tenantsFor(user),organisations:identityDomain.organisationsFor(user),organisationalUnits:identityDomain.ousFor(user),accounts,activeTenantId:user.activeTenantId,activeAwsAccountRecordId:activeRecordId(user),activeAccountId:activeRecordId(user),awsConnectionMode:env.AWS_CONNECTION_MODE}})}));

export default router;
