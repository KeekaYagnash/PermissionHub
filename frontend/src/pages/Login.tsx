import {useEffect,useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {cognitoEnabled,completeCognitoLogin,configuredProviders,confirmCognitoPasswordReset,confirmCognitoSignUp,emailNeedsVerification,ensureAccessToken,resendCognitoConfirmation,requestEmailVerification,signInWithCognito,signUpWithCognito,startCognitoLogin,startCognitoPasswordReset,verifyEmailAttribute} from '../lib/cognito';
import {onboardingDestination} from '../lib/onboarding';

type Mode='sign-in'|'sign-up'|'confirm'|'reset'|'verify';
export default function Login(){
 const [mode,setMode]=useState<Mode>('sign-in'),[email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[users,setUsers]=useState<{id:string;displayName:string;email:string;roles:string[]}[]>([]),[devAvailable,setDevAvailable]=useState(false),[loading,setLoading]=useState(true);
 const navigate=useNavigate(),setSession=useAuthStore(s=>s.setSession);
 async function finish(){
  if(emailNeedsVerification()){setMode('verify');setNotice('Verify your email address before joining or creating an organisation.');return}
  const linking=sessionStorage.getItem('permissionhub.identityLink');
  if(linking){await api.acceptIdentityLink(linking);sessionStorage.removeItem('permissionhub.identityLink')}
  const session=await api.session();setSession(session);navigate(onboardingDestination(session),{replace:true});
 }
 useEffect(()=>{
  let active=true;
  async function load(){try{
   if(cognitoEnabled()){
    const params=new URLSearchParams(location.search);if(params.has('error'))throw new Error(params.get('error_description')||'Identity provider sign-in was cancelled.');
    const authCode=params.get('code');
    if(authCode){await completeCognitoLogin(authCode,params.get('state'));history.replaceState(null,'','/auth/callback')}
    if(await ensureAccessToken()){if(active)await finish()}
   }else{const session=await api.session();if(!active)return;setSession(session);if(session.authenticated){navigate(onboardingDestination(session),{replace:true});return}setDevAvailable(session.devAuthAvailable);if(session.devAuthAvailable)setUsers(await api.developmentUsers())}
  }catch(e){if(active)setError(message(e))}finally{if(active)setLoading(false)}}
  void load();return()=>{active=false};
  // The callback transaction is single-use and is intentionally processed once.
 },[]);
 async function submit(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');try{
  if(mode==='sign-up'){await signUpWithCognito({email,password,displayName:name});setPassword('');setMode('confirm');setNotice('Check your email for a verification code.');}
  else if(mode==='confirm'){await confirmCognitoSignUp(email,code);setCode('');setMode('sign-in');setNotice('Email verified. Sign in to continue.');}
  else if(mode==='reset'){await confirmCognitoPasswordReset(email,code,password);setPassword('');setCode('');setMode('sign-in');setNotice('Password updated. Sign in with your new password.');}
  else if(mode==='verify'){await verifyEmailAttribute(code);setCode('');await finish();}
  else{await signInWithCognito(email,password);setPassword('');await finish()}
 }catch(e){setError(message(e))}finally{setBusy(false)}}
 async function perform(work:()=>Promise<void>,success:string){setBusy(true);setError('');try{await work();setNotice(success)}catch(e){setError(message(e))}finally{setBusy(false)}}
 const titles:Record<Mode,string>={'sign-in':'Sign in','sign-up':'Create your account',confirm:'Verify your email',reset:'Reset your password',verify:'Verify your email'};
 return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">PH</span><div><strong>PermissionHub</strong><small>Multi-account AWS permission governance</small></div></div><div className="auth-intro"><ShieldCheck size={28}/><h1>{cognitoEnabled()?titles[mode]:'Development sign in'}</h1><p>{sessionStorage.getItem('permissionhub.invitation')?'Sign in or create an account using the invited email address. Your invitation will be kept while you verify your identity.':'Securely manage your organisation and AWS permission requests.'}</p></div>
 {error&&<div className="error-box" role="alert">{error}{error.includes('original method')&&<button className="link-button" onClick={()=>{sessionStorage.removeItem('permissionhub.identityLink');setError('');setMode('sign-in')}}>Return to original sign-in method</button>}</div>}{notice&&<div className="success-box" role="status">{notice}</div>}
 {loading?<p>Checking sign-in…</p>:cognitoEnabled()?<>
 {['sign-in','sign-up'].includes(mode)&&<div className="auth-tabs"><button className={mode==='sign-in'?'active':''} onClick={()=>{setMode('sign-in');setError('')}}>Sign in</button><button className={mode==='sign-up'?'active':''} onClick={()=>{setMode('sign-up');setError('')}}>Create account</button></div>}
 <form className="auth-form" onSubmit={event=>void submit(event)}>
 {mode==='sign-up'&&<label className="field"><span>Full name</span><input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>}
 {mode!=='verify'&&<label className="field"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
 {['sign-in','sign-up','reset'].includes(mode)&&<label className="field"><span>{mode==='reset'?'New password':'Password'}</span><input aria-label={mode==='reset'?'New password':'Password'} type="password" required minLength={mode==='sign-in'?undefined:14} autoComplete={mode==='sign-in'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/>{mode!=='sign-in'&&<small>At least 14 characters, including uppercase, lowercase, a number and a symbol.</small>}</label>}
 {['confirm','reset','verify'].includes(mode)&&<label className="field"><span>Verification code</span><input required autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></label>}
 <button className="btn primary" disabled={busy}>{busy?'Please wait…':mode==='sign-in'?'Sign in':mode==='sign-up'?'Create account':mode==='reset'?'Set new password':'Verify email'}</button>
 {mode==='sign-in'&&<><button className="link-button" type="button" disabled={busy||!email} onClick={()=>void perform(async()=>{await startCognitoPasswordReset(email);setMode('reset')},'If the account exists, a reset code has been sent.')}>Forgot password?</button><button className="link-button" type="button" disabled={busy||!email} onClick={()=>{setMode('confirm');setNotice('Enter your email confirmation code, or request a new one.')}}>Verify an existing signup</button></>}
 {mode==='confirm'&&<button type="button" className="link-button" disabled={busy||!email} onClick={()=>void perform(()=>resendCognitoConfirmation(email),'A new confirmation code has been requested.')}>Resend verification code</button>}
 {mode==='verify'&&<button type="button" className="link-button" disabled={busy} onClick={()=>void perform(requestEmailVerification,'A verification code has been sent.')}>Send verification code</button>}
 {!['sign-in','sign-up'].includes(mode)&&<button type="button" className="link-button" onClick={()=>{setMode('sign-in');setError('')}}>Back to sign in</button>}
 </form>
 {['sign-in','sign-up'].includes(mode)&&<div className="tenant-options">{configuredProviders().map(p=><button key={p.name} disabled={busy} onClick={()=>void perform(()=>startCognitoLogin(p.name),'Redirecting…')}>Continue with {p.label}</button>)}<button disabled={busy} onClick={()=>void perform(()=>startCognitoLogin(),'Redirecting…')}>Use Cognito hosted sign in</button></div>}
 </>:devAvailable?<div className="dev-auth"><p>Local development authentication</p>{users.map(user=><button key={user.id} disabled={busy} onClick={()=>void perform(async()=>{const session=await api.developmentLogin(user.id);setSession(session);navigate(onboardingDestination(session),{replace:true})},'Signed in')}><strong>{user.displayName}</strong><small>{user.email}</small></button>)}</div>:<p>Development authentication is disabled. Configure Cognito for deployed sign-in, or explicitly enable local development authentication.</p>}
 </section></main>;
}
function message(error:unknown){if(error instanceof Error)return error.message;return 'Unable to complete authentication. Please try again.'}
