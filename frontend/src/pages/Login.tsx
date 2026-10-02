import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, setCsrfToken } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  cognitoEnabled,
  completeCognitoLogin,
  confirmCognitoSignUp,
  getAccessToken,
  resendCognitoConfirmation,
  signInWithCognito,
  signUpWithCognito,
  startCognitoLogin,
  startCognitoPasswordReset
} from '../lib/cognito';

type AuthMode = 'sign-in' | 'sign-up' | 'confirm';
const pendingCompanyKey = 'permissionhub.pendingCompanyName';

export default function Login() {
  const [users, setUsers] = useState<any[]>([]);
  const [available, setAvailable] = useState<boolean>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const navigate = useNavigate();
  const setSession = useAuthStore(state => state.setSession);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (cognitoEnabled()) {
          const code = new URLSearchParams(location.search).get('code');
          if (code) {
            await completeCognitoLogin(code);
            history.replaceState(null, '', '/auth/callback');
          } else if (!getAccessToken()) {
            if (active) setAvailable(false);
            return;
          }
          const session = await api.session();
          if (!active) return;
          setSession(session);
          navigate(session.user?.activeTenantId ? '/' : '/select-tenant', { replace: true });
          return;
        }
        const session = await api.session();
        if (!active) return;
          setCsrfToken(session.csrfToken ?? '');
        if (session.authenticated) {
          setSession(session);
          navigate(session.user?.activeTenantId ? '/' : '/select-tenant', { replace: true });
          return;
        }
        setAvailable(session.devAuthAvailable);
        if (session.devAuthAvailable) {
          const seededUsers = await api.developmentUsers();
          if (active) setUsers(seededUsers);
        }
      } catch (error: any) {
        if (active) {
          setAvailable(false);
          setError(error?.response?.data?.error?.message ?? error?.message ?? 'PermissionHub could not reach the backend.');
        }
      }
    }
    void load();
    return () => { active = false; };
  }, [navigate, setSession]);

  async function finishCognitoSession() {
    let session = await api.session();
    const pendingCompany = sessionStorage.getItem(pendingCompanyKey);
    if (pendingCompany?.trim()) {
      session = await api.setOrganization(pendingCompany.trim());
      sessionStorage.removeItem(pendingCompanyKey);
    }
    setSession(session);
    navigate(session.user?.activeTenantId ? '/' : '/select-tenant', { replace: true });
  }

  async function submitSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signInWithCognito(email, password);
      await finishCognitoSession();
    } catch (error: any) {
      setError(error?.message ?? 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitSignUp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signUpWithCognito({ email, password, displayName });
      sessionStorage.setItem(pendingCompanyKey, companyName.trim());
      setMode('confirm');
      setPassword('');
      setNotice('Account created. Enter the confirmation code sent to your email address.');
    } catch (error: any) {
      setError(error?.message ?? 'Sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitConfirmation(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await confirmCognitoSignUp(email, confirmCode);
      setMode('sign-in');
      setConfirmCode('');
      setNotice('Email confirmed. You can now sign in.');
    } catch (error: any) {
      setError(error?.message ?? 'Confirmation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await resendCognitoConfirmation(email);
      setNotice('A new confirmation code has been sent.');
    } catch (error: any) {
      setError(error?.message ?? 'Could not resend confirmation code.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('Enter your email address first, then request a password reset.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await startCognitoPasswordReset(email);
      setNotice('Password reset instructions have been sent if the account exists.');
    } catch (error: any) {
      setError(error?.message ?? 'Could not start password reset.');
    } finally {
      setBusy(false);
    }
  }

  async function login(userId: string) {
    setBusy(true);
    setError('');
    try {
      const session = await api.developmentLogin(userId);
      setSession(session);
      navigate(session.user?.activeTenantId ? '/' : '/select-tenant', { replace: true });
    } catch (error: any) {
      setError(error?.response?.data?.error?.message ?? 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">PH</span><div><strong>PermissionHub</strong><small>Multi-account AWS permission governance</small></div></div><div className="auth-intro"><ShieldCheck size={28}/><h1>{cognitoEnabled() ? authTitle(mode) : 'Development sign in'}</h1><p>{cognitoEnabled() ? 'Use your PermissionHub demo account to request, approve and provision AWS permissions.' : 'Select a seeded PermissionHub user. AWS identities remain separate managed targets, and all tenant and account authorisation rules are enforced.'}</p></div>{error && <div className="error-box" role="alert">{error}</div>}{notice && <div className="success-box" role="status">{notice}</div>}{cognitoEnabled() ? <CognitoForms mode={mode} setMode={setMode} email={email} setEmail={setEmail} displayName={displayName} setDisplayName={setDisplayName} companyName={companyName} setCompanyName={setCompanyName} password={password} setPassword={setPassword} confirmCode={confirmCode} setConfirmCode={setConfirmCode} busy={busy} submitSignIn={submitSignIn} submitSignUp={submitSignUp} submitConfirmation={submitConfirmation} resendCode={resendCode} resetPassword={resetPassword}/> : <DevelopmentLogin available={available} busy={busy} users={users} login={login}/>}</section></main>;
}

function CognitoForms(props: { mode: AuthMode; setMode: (mode: AuthMode) => void; email: string; setEmail: (value: string) => void; displayName: string; setDisplayName: (value: string) => void; companyName: string; setCompanyName: (value: string) => void; password: string; setPassword: (value: string) => void; confirmCode: string; setConfirmCode: (value: string) => void; busy: boolean; submitSignIn: (event: React.FormEvent) => void; submitSignUp: (event: React.FormEvent) => void; submitConfirmation: (event: React.FormEvent) => void; resendCode: () => void; resetPassword: () => void }) {
  const { mode, setMode, email, setEmail, displayName, setDisplayName, companyName, setCompanyName, password, setPassword, confirmCode, setConfirmCode, busy, submitSignIn, submitSignUp, submitConfirmation, resendCode, resetPassword } = props;
  return <div className="cognito-auth"><div className="auth-tabs" role="tablist" aria-label="Authentication mode"><button type="button" className={mode === 'sign-in' ? 'active' : ''} onClick={() => setMode('sign-in')} disabled={busy}>Sign in</button><button type="button" className={mode === 'sign-up' ? 'active' : ''} onClick={() => setMode('sign-up')} disabled={busy}>Create account</button></div>{mode === 'sign-in' && <form className="auth-form" onSubmit={submitSignIn}><AuthField icon={<Mail size={16}/>} label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" required/><AuthField icon={<KeyRound size={16}/>} label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Enter your password" required/><div className="auth-form-footer"><button type="button" className="link-button" onClick={resetPassword} disabled={busy}>Forgot password?</button><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></div><button type="button" className="hosted-ui-link" onClick={() => void startCognitoLogin()} disabled={busy}>Use Cognito Hosted UI instead</button></form>}{mode === 'sign-up' && <form className="auth-form" onSubmit={submitSignUp}><AuthField icon={<UserPlus size={16}/>} label="Full name" type="text" value={displayName} onChange={setDisplayName} autoComplete="name" placeholder="Jane Smith"/><AuthField icon={<ShieldCheck size={16}/>} label="Company / organisation" type="text" value={companyName} onChange={setCompanyName} autoComplete="organization" placeholder="Disraptor" required/><AuthField icon={<Mail size={16}/>} label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" required/><AuthField icon={<KeyRound size={16}/>} label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="14+ chars, upper, lower, number and symbol" required/><p className="auth-help">Your organisation is stored in PermissionHub and used for tenant isolation, user management and request numbering.</p><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button></form>}{mode === 'confirm' && <form className="auth-form" onSubmit={submitConfirmation}><button type="button" className="link-button left" onClick={() => setMode('sign-up')} disabled={busy}><ArrowLeft size={14}/> Back</button><AuthField icon={<Mail size={16}/>} label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" required/><AuthField icon={<ShieldCheck size={16}/>} label="Confirmation code" type="text" value={confirmCode} onChange={setConfirmCode} autoComplete="one-time-code" placeholder="123456" required/><div className="auth-form-footer"><button type="button" className="link-button" onClick={resendCode} disabled={busy}>Resend code</button><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Confirming…' : 'Confirm email'}</button></div></form>}</div>;
}

function AuthField({ icon, label, type, value, onChange, autoComplete, placeholder, required = false }: { icon: React.ReactNode; label: string; type: string; value: string; onChange: (value: string) => void; autoComplete: string; placeholder: string; required?: boolean }) {
  return <label className="auth-field"><span>{label}{required && <em>*</em>}</span><div>{icon}<input type={type} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} required={required}/></div></label>;
}

function DevelopmentLogin({ available, busy, users, login }: { available: boolean | undefined; busy: boolean; users: any[]; login: (userId: string) => void }) {
  if (available === undefined) return <div className="empty-state" aria-live="polite">Loading development users…</div>;
  if (!available) return <div className="empty-state">Development authentication is disabled. Set ENABLE_DEV_AUTH=true in a non-production environment.</div>;
  return <div className="dev-auth"><div><strong>Local development authentication</strong><span>SSO sign-in is currently disabled.</span></div>{users.map(user => <button key={user.id} disabled={busy} onClick={() => login(user.id)}><span><strong>{user.displayName}</strong><small>{user.email}</small></span><em>{user.roles.join(', ')}</em></button>)}</div>;
}

function authTitle(mode: AuthMode) {
  if (mode === 'sign-up') return 'Create your account';
  if (mode === 'confirm') return 'Confirm your email';
  return 'Sign in';
}
