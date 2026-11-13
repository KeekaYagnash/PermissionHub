const config = {
  mode: import.meta.env.VITE_AUTH_MODE,
  region: import.meta.env.VITE_COGNITO_REGION,
  domain: import.meta.env.VITE_COGNITO_DOMAIN,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI || `${origin()}/auth/callback`,
  logoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI || `${origin()}/login`
};

const verifierKey = 'permissionhub.pkce.verifier';
const transactionKey = 'permissionhub.pkce.transaction';
const tokenKey = 'permissionhub.cognito.tokens';
export type FederatedProvider={name:string;label:string};
export function configuredProviders():FederatedProvider[]{try{const value:unknown=JSON.parse(import.meta.env.VITE_COGNITO_PROVIDERS||'[]');return Array.isArray(value)?value.filter((p):p is FederatedProvider=>typeof p?.name==='string'&&typeof p?.label==='string'):[]}catch{return []}}

export const cognitoDomain = () => {
  if (!config.domain) return '';
  if (config.domain.includes('.')) return config.domain;
  return `${config.domain}.auth.${cognitoRegion()}.amazoncognito.com`;
};

export const cognitoEnabled = () => config.mode === 'cognito' && Boolean(config.domain && config.clientId);

export function getAccessToken() {
  const raw = sessionStorage.getItem(tokenKey);
  if (!raw) return '';
  try {
    const value = JSON.parse(raw) as { access_token?: string; id_token?: string; expires_at?: number };
    if (value.expires_at && value.expires_at < Date.now()) {
      return '';
    }
    return value.id_token ?? value.access_token ?? '';
  } catch {
    sessionStorage.removeItem(tokenKey);
    return '';
  }
}

export async function startCognitoLogin(provider?:string) {location.assign(await buildCognitoAuthorizationUrl(provider))}
export async function buildCognitoAuthorizationUrl(provider?:string) {
  if(provider&&!configuredProviders().some(item=>item.name===provider))throw new Error('This identity provider is not configured.');
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = await sha256(verifier);
  sessionStorage.setItem(verifierKey, verifier);
  const state=base64url(crypto.getRandomValues(new Uint8Array(32))),nonce=base64url(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.setItem(transactionKey,JSON.stringify({state,nonce,createdAt:Date.now()}));
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid email profile aws.cognito.signin.user.admin',
    redirect_uri: config.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    nonce,
    ...(provider?{identity_provider:provider,prompt:'login'}:{})
  });
  return `https://${cognitoDomain()}/oauth2/authorize?${params.toString()}`;
}

const callbacks=new Map<string,Promise<void>>();
export function completeCognitoLogin(code:string,state?:string|null){const current=callbacks.get(code);if(current)return current;const pending=exchangeCognitoCode(code,state).finally(()=>callbacks.delete(code));callbacks.set(code,pending);return pending}
async function exchangeCognitoCode(code: string,state?:string|null) {
  const transaction=JSON.parse(sessionStorage.getItem(transactionKey)||'null') as {state:string;nonce:string;createdAt:number}|null;
  if(!transaction||!state||state!==transaction.state||Date.now()-transaction.createdAt>600_000)throw new Error('Sign-in state is invalid or expired. Start sign in again.');
  const verifier = sessionStorage.getItem(verifierKey);
  if (!verifier) throw new Error('Missing Cognito PKCE verifier. Start sign in again.');
  sessionStorage.removeItem(transactionKey);sessionStorage.removeItem(verifierKey);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier
  });
  const response = await fetch(`https://${cognitoDomain()}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error('Cognito token exchange failed.');
  const tokens = await response.json() as { access_token: string; id_token?: string; refresh_token?:string;expires_in?: number };
  if(!tokens.id_token||tokenClaims(tokens.id_token).nonce!==transaction.nonce)throw new Error('Sign-in nonce is invalid. Start sign in again.');
  sessionStorage.setItem(tokenKey, JSON.stringify({ ...tokens, source:'oauth',expires_at: Date.now() + ((tokens.expires_in ?? 3600) - 30) * 1000 }));
  sessionStorage.removeItem(verifierKey);
}

export async function signInWithCognito(email: string, password: string) {
  const response = await cognitoRequest<{ AuthenticationResult?: { AccessToken: string; IdToken?: string; RefreshToken?: string; ExpiresIn?: number }; ChallengeName?: string }>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: config.clientId,
    AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password }
  });
  if (!response.AuthenticationResult) {
    throw new Error(response.ChallengeName ? 'Additional verification is required. Use Cognito hosted sign in to complete your MFA or account challenge.' : 'Cognito sign in did not return tokens.');
  }
  storeTokens(response.AuthenticationResult);
}

export async function signUpWithCognito(input: { email: string; password: string; displayName?: string }) {
  await cognitoRequest('SignUp', {
    ClientId: config.clientId,
    Username: input.email.trim().toLowerCase(),
    Password: input.password,
    UserAttributes: [
      { Name: 'email', Value: input.email.trim().toLowerCase() },
      ...(input.displayName?.trim() ? [{ Name: 'name', Value: input.displayName.trim() }] : [])
    ]
  });
}

export async function confirmCognitoSignUp(email: string, code: string) {
  await cognitoRequest('ConfirmSignUp', {
    ClientId: config.clientId,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: code.trim()
  });
}

export async function resendCognitoConfirmation(email: string) {
  await cognitoRequest('ResendConfirmationCode', {
    ClientId: config.clientId,
    Username: email.trim().toLowerCase()
  });
}

export async function startCognitoPasswordReset(email: string) {
  await cognitoRequest('ForgotPassword', {
    ClientId: config.clientId,
    Username: email.trim().toLowerCase()
  });
}
export async function confirmCognitoPasswordReset(email:string,code:string,password:string){await cognitoRequest('ConfirmForgotPassword',{ClientId:config.clientId,Username:email.trim().toLowerCase(),ConfirmationCode:code.trim(),Password:password})}
export async function requestEmailVerification(){await ensureAccessToken();await cognitoRequest('GetUserAttributeVerificationCode',{AccessToken:storedTokens().access_token,AttributeName:'email'})}
export async function verifyEmailAttribute(code:string){await ensureAccessToken();await cognitoRequest('VerifyUserAttribute',{AccessToken:storedTokens().access_token,AttributeName:'email',Code:code.trim()});await refreshCognitoTokens()}
function tokenClaims(token:string):Record<string,unknown>{try{return JSON.parse(atob(token.split('.')[1]!.replace(/-/g,'+').replace(/_/g,'/')))}catch{return {}}}
export function emailNeedsVerification(){const token=storedTokens().id_token;return Boolean(token&&tokenClaims(token).email_verified!==true&&tokenClaims(token).email_verified!=='true')}
function storedTokens():{access_token?:string;id_token?:string;refresh_token?:string;source?:string;expires_at?:number}{try{return JSON.parse(sessionStorage.getItem(tokenKey)||'{}')}catch{return {}}}
let refreshing:Promise<void>|undefined;
export async function refreshCognitoTokens(){
 if(refreshing)return refreshing;
 refreshing=(async()=>{const old=storedTokens();if(!old.refresh_token)throw new Error('Your session has expired. Sign in again.');
  if(old.source==='oauth'){
   const response=await fetch(`https://${cognitoDomain()}/oauth2/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:config.clientId,refresh_token:old.refresh_token})});
   if(!response.ok)throw new Error('Your session has expired. Sign in again.');
   const tokens=await response.json();sessionStorage.setItem(tokenKey,JSON.stringify({...old,...tokens,expires_at:Date.now()+((tokens.expires_in??3600)-30)*1000}));
  }else{
   const result=await cognitoRequest<{AuthenticationResult?:{AccessToken:string;IdToken?:string;ExpiresIn?:number}}>('InitiateAuth',{AuthFlow:'REFRESH_TOKEN_AUTH',ClientId:config.clientId,AuthParameters:{REFRESH_TOKEN:old.refresh_token}});
   if(!result.AuthenticationResult)throw new Error('Your session has expired. Sign in again.');storeTokens({...result.AuthenticationResult,RefreshToken:old.refresh_token});
  }
 })().catch(()=>{sessionStorage.removeItem(tokenKey);throw new Error('Your session has expired. Sign in again.')}).finally(()=>{refreshing=undefined});return refreshing;
}
export async function ensureAccessToken(){if(cognitoEnabled()&&!getAccessToken()&&storedTokens().refresh_token)await refreshCognitoTokens();return getAccessToken()}

export async function clearCognitoSession() {
  const old=storedTokens();
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(verifierKey);sessionStorage.removeItem(transactionKey);
  sessionStorage.removeItem('permissionhub.identityLink');
  if(old.access_token)await cognitoRequest('GlobalSignOut',{AccessToken:old.access_token}).catch(()=>undefined);
  if(old.refresh_token)await cognitoRequest('RevokeToken',{ClientId:config.clientId,Token:old.refresh_token}).catch(()=>undefined);
}
export async function logoutCognito() {
  await clearCognitoSession();
  if (!cognitoEnabled()) return;
  const params = new URLSearchParams({ client_id: config.clientId, logout_uri: config.logoutUri });
  location.assign(`https://${cognitoDomain()}/logout?${params.toString()}`);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return base64url(new Uint8Array(hash));
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function origin() {
  return typeof location === 'undefined' ? 'http://localhost:5173' : location.origin;
}

async function cognitoRequest<T = unknown>(operation: string, body: Record<string, unknown>): Promise<T> {
  if (!config.clientId) throw new Error('Cognito client ID is not configured.');
  const response = await fetch(`https://cognito-idp.${cognitoRegion()}.amazonaws.com/`, {
    method: 'POST',
    signal:AbortSignal.timeout(10000),
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': `AWSCognitoIdentityProviderService.${operation}`
    },
    body: JSON.stringify(body)
  });
  const value = await response.json().catch(() => ({})) as { __type?: string; message?: string; Message?: string };
  if (!response.ok) {
    const code = value.__type?.split('#').pop();
    throw new Error(cognitoErrorMessage(code, value.message ?? value.Message));
  }
  return value as T;
}

function cognitoRegion() {
  if (config.region) return config.region;
  const match = String(config.domain ?? '').match(/\.auth\.([a-z0-9-]+)\.amazoncognito\.com$/);
  return match?.[1] ?? 'af-south-1';
}

function storeTokens(tokens: { AccessToken: string; IdToken?: string; RefreshToken?: string; ExpiresIn?: number }) {
  sessionStorage.setItem(tokenKey, JSON.stringify({
    access_token: tokens.AccessToken,
    id_token: tokens.IdToken,
    refresh_token: tokens.RefreshToken,
    source:'password',
    expires_at: Date.now() + ((tokens.ExpiresIn ?? 3600) - 30) * 1000
  }));
}

function cognitoErrorMessage(code?: string, message?: string) {
  if (code === 'UserNotConfirmedException') return 'Confirm your email address before signing in.';
  if (code === 'NotAuthorizedException') return 'The email or password is incorrect.';
  if (code === 'UsernameExistsException') return 'An account with this email already exists. Sign in or reset your password.';
  if (code === 'InvalidPasswordException') return message ?? 'Password does not meet the configured security policy.';
  if (code === 'CodeMismatchException') return 'The confirmation code is incorrect.';
  if (code === 'ExpiredCodeException') return 'The confirmation code has expired. Request a new code.';
  if (code === 'LimitExceededException' || code === 'TooManyRequestsException') return 'Cognito rate limited this request. Wait a moment and try again.';
  return message ?? 'Cognito authentication failed.';
}
