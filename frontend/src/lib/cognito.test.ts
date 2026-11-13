// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';

const response=(value:unknown,ok=true)=>({ok,json:async()=>value});
const jwt=(payload:Record<string,unknown>)=>`header.${btoa(JSON.stringify(payload))}.signature`;
beforeEach(()=>{vi.resetModules();sessionStorage.clear();vi.stubEnv('VITE_AUTH_MODE','cognito');vi.stubEnv('VITE_COGNITO_CLIENT_ID','test-client');vi.stubEnv('VITE_COGNITO_DOMAIN','test.auth.af-south-1.amazoncognito.com');vi.stubEnv('VITE_COGNITO_REGION','af-south-1');vi.stubEnv('VITE_COGNITO_PROVIDERS','[]');vi.stubGlobal('crypto',webcrypto)});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
describe('Cognito registration, recovery and federation contract',()=>{
 it('registers, confirms and resends verification without creating organisation membership',async()=>{
  const fetch=vi.fn().mockResolvedValue(response({}));vi.stubGlobal('fetch',fetch);const auth=await import('./cognito');
  await auth.signUpWithCognito({email:' NEW@Example.com ',password:'Never-a-real-password-123!',displayName:'New Person'});await auth.confirmCognitoSignUp('NEW@example.com',' 123456 ');await auth.resendCognitoConfirmation('NEW@example.com');
  const signup=JSON.parse(fetch.mock.calls[0][1].body);expect(signup.Username).toBe('new@example.com');expect(signup.UserAttributes).toContainEqual({Name:'name',Value:'New Person'});expect(signup).not.toHaveProperty('tenantId');
  expect(fetch.mock.calls[1][1].headers['x-amz-target']).toContain('ConfirmSignUp');expect(JSON.parse(fetch.mock.calls[1][1].body).ConfirmationCode).toBe('123456');
 });
 it('completes password recovery and exposes friendly expired-code errors',async()=>{
  const fetch=vi.fn().mockResolvedValue(response({}));vi.stubGlobal('fetch',fetch);const auth=await import('./cognito');await auth.startCognitoPasswordReset('new@example.com');await auth.confirmCognitoPasswordReset('new@example.com','123456','New-not-real-password-123!');
  expect(fetch.mock.calls[1][1].headers['x-amz-target']).toContain('ConfirmForgotPassword');fetch.mockResolvedValueOnce(response({__type:'ExpiredCodeException'},false));await expect(auth.confirmCognitoSignUp('new@example.com','bad')).rejects.toThrow('expired');
 });
 it('does not offer unconfigured providers and rejects arbitrary provider names',async()=>{
  const auth=await import('./cognito');expect(auth.configuredProviders()).toEqual([]);await expect(auth.buildCognitoAuthorizationUrl('Google')).rejects.toThrow('not configured');
 });
 it('configured Google and tenant-specific Microsoft use authorization code, PKCE, state and nonce',async()=>{
  vi.stubEnv('VITE_COGNITO_PROVIDERS',JSON.stringify([{name:'Google',label:'Google'},{name:'EntraExample',label:'Microsoft Example'}]));const auth=await import('./cognito');
  for(const name of ['Google','EntraExample']){const url=new URL(await auth.buildCognitoAuthorizationUrl(name));expect(url.searchParams.get('response_type')).toBe('code');expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('identity_provider')).toBe(name);expect(url.searchParams.get('state')).toHaveLength(43);expect(url.searchParams.get('nonce')).toHaveLength(43);expect(url.toString()).not.toContain('client_secret')}
 });
 it('invalid state and nonce cannot establish a session; callbacks are single-use',async()=>{
  const auth=await import('./cognito');const url=new URL(await auth.buildCognitoAuthorizationUrl());const fetch=vi.fn().mockResolvedValue(response({access_token:'a',id_token:jwt({nonce:'wrong'})}));vi.stubGlobal('fetch',fetch);
  await expect(auth.completeCognitoLogin('code','bad-state')).rejects.toThrow('state');expect(fetch).not.toHaveBeenCalled();
  await expect(auth.completeCognitoLogin('code',url.searchParams.get('state'))).rejects.toThrow('nonce');expect(auth.getAccessToken()).toBe('');await expect(auth.completeCognitoLogin('code',url.searchParams.get('state'))).rejects.toThrow('state');
 });
 it('deduplicates concurrent callback exchange and preserves a valid token only after nonce checks',async()=>{
  const auth=await import('./cognito'),url=new URL(await auth.buildCognitoAuthorizationUrl());const id=jwt({nonce:url.searchParams.get('nonce'),email_verified:true});const fetch=vi.fn().mockResolvedValue(response({access_token:'access',id_token:id,refresh_token:'refresh',expires_in:3600}));vi.stubGlobal('fetch',fetch);
  await Promise.all([auth.completeCognitoLogin('code',url.searchParams.get('state')),auth.completeCognitoLogin('code',url.searchParams.get('state'))]);expect(fetch).toHaveBeenCalledTimes(1);expect(auth.getAccessToken()).toBe(id);
 });
 it('refreshes expired tokens once across simultaneous API requests and clears rejected sessions',async()=>{
  const auth=await import('./cognito');sessionStorage.setItem('permissionhub.cognito.tokens',JSON.stringify({refresh_token:'fake-refresh',expires_at:0,source:'password'}));const fetch=vi.fn().mockResolvedValue(response({AuthenticationResult:{AccessToken:'a',IdToken:'new-id',ExpiresIn:3600}}));vi.stubGlobal('fetch',fetch);
  expect(await Promise.all([auth.ensureAccessToken(),auth.ensureAccessToken()])).toEqual(['new-id','new-id']);expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValueOnce(response({__type:'NotAuthorizedException'},false));await expect(auth.refreshCognitoTokens()).rejects.toThrow();expect(auth.getAccessToken()).toBe('');
 });
 it('logout clears tokens and revokes refresh/access sessions',async()=>{
  const auth=await import('./cognito');sessionStorage.setItem('permissionhub.cognito.tokens',JSON.stringify({access_token:'fake',refresh_token:'fake-refresh',expires_at:Date.now()+30000}));const fetch=vi.fn().mockResolvedValue(response({}));vi.stubGlobal('fetch',fetch);await auth.clearCognitoSession();expect(auth.getAccessToken()).toBe('');expect(fetch.mock.calls.map(call=>call[1].headers['x-amz-target'])).toEqual(['AWSCognitoIdentityProviderService.GlobalSignOut','AWSCognitoIdentityProviderService.RevokeToken']);expect(localStorage.getItem('permissionhub.cognito.tokens')).toBeNull();
 });
 it('verifies a federated mailbox through Cognito and refreshes its verified-email claim',async()=>{
  const auth=await import('./cognito');sessionStorage.setItem('permissionhub.cognito.tokens',JSON.stringify({access_token:'access',id_token:jwt({email_verified:false}),refresh_token:'refresh',source:'password',expires_at:Date.now()+60000}));expect(auth.emailNeedsVerification()).toBe(true);
  const fetch=vi.fn().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({AuthenticationResult:{AccessToken:'access-new',IdToken:jwt({email_verified:true}),ExpiresIn:3600}}));vi.stubGlobal('fetch',fetch);await auth.requestEmailVerification();await auth.verifyEmailAttribute('123456');expect(auth.emailNeedsVerification()).toBe(false);expect(fetch.mock.calls.map(call=>call[1].headers['x-amz-target'])).toEqual(['AWSCognitoIdentityProviderService.GetUserAttributeVerificationCode','AWSCognitoIdentityProviderService.VerifyUserAttribute','AWSCognitoIdentityProviderService.InitiateAuth']);
 });
});
