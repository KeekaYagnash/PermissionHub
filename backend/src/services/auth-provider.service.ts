import { createHash,randomBytes } from 'node:crypto';
import * as oidc from 'openid-client';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { developmentUsers,identityDomain } from './identity-domain.service.js';
import type { SessionUser } from '../types.js';

export interface AuthStart {redirectUrl?:string;provider:string;state?:string;codeVerifier?:string;nonce?:string}
export interface AuthCallbackInput {currentUrl:string;state?:string;codeVerifier?:string;nonce?:string}
export interface AuthProvider {
 readonly name:string;
 signIn():Promise<AuthStart>;
 signOut(user?:SessionUser):Promise<{redirectUrl:string}>;
 getSession(user?:SessionUser):Promise<SessionUser|undefined>;
 refreshSession(user:SessionUser):Promise<SessionUser>;
 getCurrentUser(input?:AuthCallbackInput):Promise<SessionUser|undefined>;
 handleCallback(input:AuthCallbackInput):Promise<SessionUser>;
}

export class DevelopmentAuthProvider implements AuthProvider {
 readonly name='development';
 async signIn(){return {provider:this.name}}
 async signOut(){return {redirectUrl:`${env.FRONTEND_URL}/login`}}
 async getSession(user?:SessionUser){return user}
 async refreshSession(user:SessionUser){return user}
 async getCurrentUser(){return undefined}
 async handleCallback(_input:AuthCallbackInput):Promise<SessionUser>{throw new ApiError(400,'Development login does not use an OIDC callback.','INVALID_AUTH_FLOW')}
 async authenticate(userId:string){
  if(env.NODE_ENV==='production'||!env.ENABLE_DEV_AUTH)throw new ApiError(404,'Development authentication is unavailable.','DEV_AUTH_DISABLED');
  const user=developmentUsers.find(candidate=>candidate.id===userId);if(!user)throw new ApiError(401,'Unknown development user.','INVALID_DEV_USER');
  return identityDomain.sessionUser(user,this.name);
 }
}

export class OidcAuthProvider implements AuthProvider {
 readonly name=env.AUTH_PROVIDER;
 private config?:oidc.Configuration;
 private async configuration(){
  if(this.config)return this.config;
  if(!env.OIDC_ISSUER_URL||!env.OIDC_CLIENT_ID)throw new ApiError(503,'OIDC is not configured.','OIDC_NOT_CONFIGURED');
  this.config=await oidc.discovery(new URL(env.OIDC_ISSUER_URL),env.OIDC_CLIENT_ID,env.OIDC_CLIENT_SECRET?{client_secret:env.OIDC_CLIENT_SECRET}:undefined);
  return this.config;
 }
 async signIn():Promise<AuthStart>{
  const config=await this.configuration(),state=oidc.randomState(),nonce=oidc.randomNonce(),codeVerifier=oidc.randomPKCECodeVerifier(),codeChallenge=await oidc.calculatePKCECodeChallenge(codeVerifier);
  const url=oidc.buildAuthorizationUrl(config,{redirect_uri:env.OIDC_REDIRECT_URI,scope:'openid profile email',response_type:'code',state,nonce,code_challenge:codeChallenge,code_challenge_method:'S256'});
  return {provider:this.name,redirectUrl:url.href,state,nonce,codeVerifier};
 }
 async handleCallback(input:AuthCallbackInput){
  if(!input.state||!input.codeVerifier||!input.nonce)throw new ApiError(400,'The authentication transaction has expired.','AUTH_TRANSACTION_EXPIRED');
  const tokens=await oidc.authorizationCodeGrant(await this.configuration(),new URL(input.currentUrl),{expectedState:input.state,pkceCodeVerifier:input.codeVerifier,expectedNonce:input.nonce});
  const claims=tokens.claims();if(!claims?.sub)throw new ApiError(401,'OIDC provider did not return a subject.','INVALID_ID_TOKEN');
  const email=typeof claims.email==='string'?claims.email:undefined;
  const directoryUser=identityDomain.findByProviderSubject(this.name,claims.sub,email);
  if(!directoryUser)throw new ApiError(403,'Your identity has not been invited to PermissionHub.','MEMBERSHIP_REQUIRED');
  return {...identityDomain.sessionUser(directoryUser,this.name),providerSubject:claims.sub,email:email??directoryUser.email,displayName:typeof claims.name==='string'?claims.name:directoryUser.displayName};
 }
 async signOut(){return {redirectUrl:env.OIDC_LOGOUT_REDIRECT_URI}}
 async getSession(user?:SessionUser){return user}
 async refreshSession(user:SessionUser){return user}
 async getCurrentUser(){return undefined}
}

export function configuredAuthProvider():AuthProvider{return env.AUTH_PROVIDER==='development'?new DevelopmentAuthProvider():new OidcAuthProvider()}
export function csrfToken(){return randomBytes(32).toString('base64url')}
export function safeEqualToken(actual?:string,expected?:string){if(!actual||!expected)return false;return createHash('sha256').update(actual).digest('hex')===createHash('sha256').update(expected).digest('hex')}
