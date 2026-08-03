import { Building2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export default function SelectTenant(){const session=useAuthStore(s=>s.session),setSession=useAuthStore(s=>s.setSession),navigate=useNavigate();useEffect(()=>{if(!session)api.session().then(value=>{if(!value.authenticated)navigate('/login',{replace:true});else setSession(value)})},[navigate,session,setSession]);const memberships=session?.user?.memberships.filter(item=>item.status==='ACTIVE')??[];async function select(tenantId:string){const next=await api.selectTenant(tenantId);setSession(next);navigate('/',{replace:true})}return <main className="auth-page"><section className="auth-card"><div className="auth-intro"><Building2 size={28}/><h1>Select a tenant</h1><p>Choose the company context for this session. Only active memberships are shown.</p></div><div className="tenant-options">{memberships.map(item=><button key={item.id} onClick={()=>select(item.tenantId)}><strong>{item.tenantName}</strong><span>{item.role.replaceAll('_',' ')}</span></button>)}</div>{!session&&<p>Loading memberships…</p>}</section></main>}
