import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {feedback} from '../store/feedback';
import {usePendingFeedback} from './Feedback';
import {Modal} from './ui';

export function OrganizationCreation(){
 const setSession=useAuthStore(state=>state.setSession),client=useQueryClient();
 const busy=useAuthStore(state=>state.contextChanging),setBusy=useAuthStore(state=>state.setContextChanging);
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
 usePendingFeedback(busy,'Updating organization…','organization-pending');
 async function create(){if(busy)return;setBusy(true);setError('');try{await client.cancelQueries();const session=await api.setOrganization(name.trim());client.clear();setSession(session);setName('');setOpen(false);feedback.show('organization-change','Organization created.','success')}catch{setError('Unable to create the organization. Check your connection and try again.')}finally{setBusy(false)}}
 function close(){if(busy)return;if(name.trim()&&!confirm('Discard the unsaved organization name?'))return;setOpen(false);setName('');setError('')}
 return <><button className="btn primary" disabled={busy} onClick={()=>setOpen(true)}>Add organization</button><Modal open={open} onClose={close} title="Add organization" subtitle="Create an organization with your verified PermissionHub identity."><form className="auth-form" aria-busy={busy} onSubmit={event=>{event.preventDefault();void create()}}><label className="field"><span>Company name</span><input required minLength={2} maxLength={120} autoComplete="organization" disabled={busy} value={name} onChange={event=>setName(event.target.value)}/></label><p>You will administer the new organization. Existing memberships and AWS accounts will not be moved.</p>{error&&<p className="error-box" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={close}>Cancel</button><button className="btn primary" disabled={busy||name.trim().length<2}>{busy?'Creating…':'Create organization'}</button></div></form></Modal></>;
}
