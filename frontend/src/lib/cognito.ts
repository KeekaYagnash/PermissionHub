const config = {
  mode: import.meta.env.VITE_AUTH_MODE,
  region: import.meta.env.VITE_COGNITO_REGION,
  domain: import.meta.env.VITE_COGNITO_DOMAIN,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI || `${origin()}/auth/callback`,
  logoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI || `${origin()}/login`
};

const verifierKey = 'permissionhub.pkce.verifier';
const tokenKey = 'permissionhub.cognito.tokens';

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
      sessionStorage.removeItem(tokenKey);
      return '';
    }
    return value.id_token ?? value.access_token ?? '';
  } catch {
    sessionStorage.removeItem(tokenKey);
    return '';
  }
}

export async function startCognitoLogin() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = await sha256(verifier);
  sessionStorage.setItem(verifierKey, verifier);
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: config.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });
  location.assign(`https://${cognitoDomain()}/oauth2/authorize?${params.toString()}`);
}

export async function completeCognitoLogin(code: string) {
  const verifier = sessionStorage.getItem(verifierKey);
  if (!verifier) throw new Error('Missing Cognito PKCE verifier. Start sign in again.');
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
  const tokens = await response.json() as { access_token: string; id_token?: string; expires_in?: number };
  sessionStorage.setItem(tokenKey, JSON.stringify({ ...tokens, expires_at: Date.now() + ((tokens.expires_in ?? 3600) - 30) * 1000 }));
  sessionStorage.removeItem(verifierKey);
}

export async function signInWithCognito(email: string, password: string) {
  const response = await cognitoRequest<{ AuthenticationResult?: { AccessToken: string; IdToken?: string; RefreshToken?: string; ExpiresIn?: number }; ChallengeName?: string }>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: config.clientId,
    AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password }
  });
  if (!response.AuthenticationResult) {
    throw new Error(response.ChallengeName ? `Additional Cognito challenge required: ${response.ChallengeName}` : 'Cognito sign in did not return tokens.');
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

export function logoutCognito() {
  sessionStorage.removeItem(tokenKey);
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
