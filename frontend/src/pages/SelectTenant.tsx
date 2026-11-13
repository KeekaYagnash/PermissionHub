import {Building2} from 'lucide-react';
import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {Link} from 'react-router-dom';

export default function SelectTenant(){
 const session=useAuthStore(s=>s.session),setSession=useAuthStore(s=>s.setSession),navigate=useNavigate();
 const [companyName,setCompanyName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(session?.profileRequired)navigate('/complete-profile',{replace:true})},[session?.profileRequired,navigate]);
 useEffect(()=>{if(!session)void api.session().then(value=>{if(!value.authenticated)navigate('/login',{replace:true});else setSession(value)}).catch(()=>setError('Unable to load your memberships. Please sign in again.'))},[navigate,session,setSession]);
 const memberships=session?.user?.memberships.filter(item=>item.status==='ACTIVE')??[];
 async function select(tenantId?:string){
  if(busy)return;setBusy(true);setError('');
  try{const next=tenantId?await api.selectTenant(tenantId):await api.setOrganization(companyName.trim());setSession(next);navigate('/',{replace:true})}
  catch(error){setError(error instanceof Error?error.message:'Unable to save your organisation context. Please retry.')}finally{setBusy(false)}
 }
 return <main className="auth-page"><section className="auth-card"><div className="auth-intro"><Building2 size={28}/><h1>{memberships.length?'Select a tenant':'Set up your organisation'}</h1><p>{memberships.length?'Choose your company context. Only active memberships are shown.':'If an administrator added you, sign in with that verified email address. Otherwise, create your own organisation below.'}</p></div>
 {error&&<p role="alert" className="error-box">{error}</p>}
 <div className="tenant-options">{memberships.map(item=><button key={item.id} disabled={busy} onClick={()=>void select(item.tenantId)}><strong>{item.tenantName}</strong><span>{item.role.replaceAll('_',' ')}</span></button>)}</div>
 {sessionStorage.getItem('permissionhub.invitation')&&<Link to="/accept-invitation">Review your pending invitation</Link>}
 {!session?<p>Loading memberships…</p>:<details open={!memberships.length}><summary>{memberships.length?'Create another organisation':'Create your organisation'}</summary><form onSubmit={event=>{event.preventDefault();void select()}}><label className="field"><span>Company name</span><input value={companyName} onChange={event=>setCompanyName(event.target.value)} required minLength={2} maxLength={120} autoComplete="organization"/></label><button className="btn primary" disabled={busy||companyName.trim().length<2}>{busy?'Saving…':'Create organisation'}</button></form></details>}
 </section></main>;
}
