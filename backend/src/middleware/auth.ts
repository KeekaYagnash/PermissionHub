import type { NextFunction,Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AppRole,AuthenticatedRequest,AuthClaims } from '../types.js';
import { ApiError } from '../utils/http.js';

export function authenticate(req:AuthenticatedRequest,_res:Response,next:NextFunction){const token=req.headers.authorization?.replace(/^Bearer\s+/,'');if(!token){if(env.NODE_ENV==='development'){req.auth={sub:'usr_001',organizationId:req.headers['x-organization-id']?.toString()||'org_acme',role:'ADMINISTRATOR',email:'alex.morgan@acme.io',name:'Alex Morgan'};return next()}return next(new ApiError(401,'Authentication required','UNAUTHENTICATED'))}try{req.auth=jwt.verify(token,env.JWT_SECRET) as AuthClaims;next()}catch{next(new ApiError(401,'Invalid or expired token','INVALID_TOKEN'))}}
export const authorize=(...roles:AppRole[])=>(req:AuthenticatedRequest,_res:Response,next:NextFunction)=>req.auth&&roles.includes(req.auth.role)?next():next(new ApiError(403,'You do not have permission to perform this action','FORBIDDEN'));
export function tenantScope(req:AuthenticatedRequest,_res:Response,next:NextFunction){if(!req.auth?.organizationId)return next(new ApiError(403,'Organization context is required','TENANT_REQUIRED'));const requested=req.headers['x-organization-id']?.toString();if(requested&&requested!==req.auth.organizationId&&req.auth.role!=='ADMINISTRATOR')return next(new ApiError(403,'Cross-organization access is prohibited','TENANT_VIOLATION'));next()}
