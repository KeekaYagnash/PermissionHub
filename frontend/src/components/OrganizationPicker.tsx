import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {feedback} from '../store/feedback';
import {usePendingFeedback} from './Feedback';

export function OrganizationPicker(){
 const session=useAuthStore(state=>state.session),setSession=useAuthStore(state=>state.setSession),client=useQueryClient(),navigate=useNavigate();
 const busy=useAuthStore(state=>state.contextChanging),setBusy=useAuthStore(state=>state.setContextChanging),[error,setError]=useState('');
 const memberships=session?.user?.memberships.filter(item=>item.status==='ACTIVE')??[];
 usePendingFeedback(busy,'Updating organization…','organization-pending');
 async function change(tenantId:string){
  if(busy)return;setBusy(true);setError('');
  try{await client.cancelQueries();const next=await api.selectTenant(tenantId);client.clear();setSession(next);navigate('/',{replace:true});feedback.show('organization-change','Organization switched.','success')}
  catch{setError('Unable to update your organization. Your previous context is retained. Please retry.');feedback.show('organization-change','Organization could not be updated. Please retry.','error')}
  finally{setBusy(false)}
 }
 return <div className="organization-picker"><label className="field"><span>Organization</span><select aria-label="Active organization" disabled={busy} value={session?.user?.activeTenantId??''} onChange={event=>void change(event.target.value)}><option value="" disabled>Select organization</option>{memberships.map(item=><option key={item.id} value={item.tenantId}>{item.tenantName}</option>)}</select></label><div className="organization-picker-actions"><button className="link-button" disabled={busy} onClick={()=>navigate('/administration/organizations')}>Invitations</button></div>{busy&&<p role="status">Updating organization…</p>}{error&&<p className="field-error" role="alert">{error}</p>}</div>;
}

