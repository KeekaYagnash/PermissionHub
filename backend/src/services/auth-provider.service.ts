import { createHash,randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { developmentUsers,identityDomain } from './identity-domain.service.js';
import type { SessionUser } from '../types.js';

export interface AuthStart {redirectUrl?:string;provider:string}
export interface AuthProvider {
 readonly name:string;
 signIn():Promise<AuthStart>;
 signOut(user?:SessionUser):Promise<{redirectUrl:string}>;
 getSession(user?:SessionUser):Promise<SessionUser|undefined>;
 refreshSession(user:SessionUser):Promise<SessionUser>;
 getCurrentUser():Promise<SessionUser|undefined>;
}

export class DevelopmentAuthProvider implements AuthProvider {
 readonly name='development';
 async signIn(){return {provider:this.name}}
 async signOut(){return {redirectUrl:`${env.FRONTEND_URL}/login`}}
 async getSession(user?:SessionUser){return user}
 async refreshSession(user:SessionUser){return user}
 async getCurrentUser(){return undefined}
 async authenticate(userId:string){
  if(env.NODE_ENV==='production'||!env.ENABLE_DEV_AUTH)throw new ApiError(404,'Development authentication is unavailable.','DEV_AUTH_DISABLED');
  const user=developmentUsers.find(candidate=>candidate.id===userId);if(!user)throw new ApiError(401,'Unknown development user.','INVALID_DEV_USER');
  return identityDomain.sessionUser(user,this.name);
 }
}

export function configuredAuthProvider():AuthProvider{return new DevelopmentAuthProvider()}
export function csrfToken(){return randomBytes(32).toString('base64url')}
export function safeEqualToken(actual?:string,expected?:string){if(!actual||!expected)return false;return createHash('sha256').update(actual).digest('hex')===createHash('sha256').update(expected).digest('hex')}
