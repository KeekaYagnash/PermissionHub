import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {onboardingDestination} from '../lib/onboarding';
export default function CompleteProfile(){const navigate=useNavigate(),setSession=useAuthStore(s=>s.setSession);const [name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void api.session().then(session=>{if(!session.authenticated)navigate('/login',{replace:true});else if(!session.profileRequired)navigate(onboardingDestination(session),{replace:true});else setSession(session)}).catch(()=>setError('Sign in again to finish your profile.'))},[navigate,setSession]);
 async function save(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const session=await api.saveProfile(name.trim());setSession(session);navigate(onboardingDestination(session),{replace:true})}catch(e){setError(e instanceof Error?e.message:'Profile could not be saved.')}finally{setBusy(false)}}
 return <main className="auth-page"><section className="auth-card"><h1>Complete your profile</h1><p>What name should your organisation see?</p>{error&&<p className="error-box" role="alert">{error}</p>}<form className="auth-form" onSubmit={e=>void save(e)}><label className="field"><span>Full name</span><input value={name} autoComplete="name" required minLength={2} maxLength={120} onChange={e=>setName(e.target.value)}/></label><button className="btn primary" disabled={busy}>{busy?'Saving…':'Continue'}</button></form></section></main>;
}
