const config = {
  mode: import.meta.env.VITE_AUTH_MODE,
  domain: import.meta.env.VITE_COGNITO_DOMAIN,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI || `${origin()}/auth/callback`,
  logoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI || `${origin()}/login`
};

const verifierKey = 'permissionhub.pkce.verifier';
const tokenKey = 'permissionhub.cognito.tokens';

export const cognitoEnabled = () => config.mode === 'cognito' && Boolean(config.domain && config.clientId);

export function getAccessToken() {
  const raw = sessionStorage.getItem(tokenKey);
  if (!raw) return '';
  try {
    const value = JSON.parse(raw) as { access_token?: string; expires_at?: number };
    if (value.expires_at && value.expires_at < Date.now()) {
      sessionStorage.removeItem(tokenKey);
      return '';
    }
    return value.access_token ?? '';
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
  location.assign(`https://${config.domain}/oauth2/authorize?${params.toString()}`);
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
  const response = await fetch(`https://${config.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error('Cognito token exchange failed.');
  const tokens = await response.json() as { access_token: string; expires_in?: number };
  sessionStorage.setItem(tokenKey, JSON.stringify({ ...tokens, expires_at: Date.now() + ((tokens.expires_in ?? 3600) - 30) * 1000 }));
  sessionStorage.removeItem(verifierKey);
}

export function logoutCognito() {
  sessionStorage.removeItem(tokenKey);
  if (!cognitoEnabled()) return;
  const params = new URLSearchParams({ client_id: config.clientId, logout_uri: config.logoutUri });
  location.assign(`https://${config.domain}/logout?${params.toString()}`);
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
