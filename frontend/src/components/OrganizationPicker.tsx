import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {feedback} from '../store/feedback';
import {usePendingFeedback} from './Feedback';
import {Modal} from './ui';

export function OrganizationPicker(){
 const session=useAuthStore(state=>state.session),setSession=useAuthStore(state=>state.setSession),client=useQueryClient(),navigate=useNavigate();
 const busy=useAuthStore(state=>state.contextChanging),setBusy=useAuthStore(state=>state.setContextChanging);
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
 const memberships=session?.user?.memberships.filter(item=>item.status==='ACTIVE')??[];
 usePendingFeedback(busy,'Updating organization…','organization-pending');
 async function change(tenantId?:string){
  if(busy)return;setBusy(true);setError('');
  try{
   // Cancel/clear old-tenant caches before exposing the next tenant's screens.
   await client.cancelQueries();
   const next=tenantId?await api.selectTenant(tenantId):await api.setOrganization(name.trim());
   client.clear();setSession(next);setOpen(false);setName('');navigate('/',{replace:true});
   feedback.show('organization-change',tenantId?'Organization switched.':'Organization created.','success');
  }catch{setError('Unable to update your organization. Your previous context is retained. Please retry.');feedback.show('organization-change','Organization could not be updated. Please retry.','error');}
  finally{setBusy(false)}
 }
 function close(){if(busy)return;if(name.trim()&&!confirm('Discard the unsaved organization name?'))return;setOpen(false);setName('');setError('');}
 return <div className="organization-picker">
  <label className="field"><span>Organization</span><select aria-label="Active organization" disabled={busy} value={session?.user?.activeTenantId??''} onChange={event=>void change(event.target.value)}><option value="" disabled>Select organization</option>{memberships.map(item=><option key={item.id} value={item.tenantId}>{item.tenantName}</option>)}</select></label>
  <div className="organization-picker-actions"><button className="link-button" disabled={busy} onClick={()=>{setError('');setOpen(true)}}>Add organization</button><button className="link-button" disabled={busy} onClick={()=>navigate('/select-tenant')}>Invitations</button></div>
  {busy&&<p role="status">Updating organization…</p>}{error&&!open&&<p className="field-error" role="alert">{error}</p>}
  <Modal open={open} onClose={close} title="Add organization" subtitle="Create another organization using your verified PermissionHub identity.">
   <form className="auth-form" aria-busy={busy} onSubmit={event=>{event.preventDefault();void change()}}>
    <label className="field"><span>Company name</span><input required minLength={2} maxLength={120} autoComplete="organization" value={name} disabled={busy} onChange={event=>setName(event.target.value)}/></label>
    <p className="muted">You will become its organization administrator. Existing memberships and AWS accounts stay with their current organizations.</p>
    {error&&<p className="error-box" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={close}>Cancel</button><button className="btn primary" disabled={busy||name.trim().length<2}>{busy?'Creating…':'Create organization'}</button></div>
   </form>
  </Modal>
 </div>;
}

