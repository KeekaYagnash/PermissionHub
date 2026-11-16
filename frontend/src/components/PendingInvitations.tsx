import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {Modal} from './ui';

export function PendingInvitations(){
 const session=useAuthStore(state=>state.session),setSession=useAuthStore(state=>state.setSession),client=useQueryClient(),navigate=useNavigate();
 const [selected,setSelected]=useState<{id:string;organizationName:string;role:string}>();
 const invitations=useQuery({queryKey:['my-invitations',session?.user?.id],queryFn:api.pendingInvitations,enabled:Boolean(session?.authenticated&&session.user?.emailVerified)});
 const action=useMutation({mutationFn:async({id,accept}:{id:string;accept:boolean})=>accept?api.acceptPendingInvitation(id):api.declineInvitation(id),onSuccess:async(result,_variables)=>{setSelected(undefined);await client.cancelQueries();client.clear();if('authenticated' in result){setSession(result);navigate('/',{replace:true})}}});
 return <section className="pending-invitations" aria-label="Pending invitations"><h2>Pending invitations</h2><p className="muted">Invitations are separate from memberships. Only invitations for your verified email are shown.</p>
  {!session?.user?.emailVerified?<p>Verify your email to view invitations, or use the invitation link from your email.</p>:invitations.isPending?<p role="status">Loading invitations…</p>:invitations.error?<p role="alert">Invitations could not be loaded. <button className="link-button" onClick={()=>void invitations.refetch()}>Retry</button></p>:!invitations.data?.length?<p>No pending invitations.</p>:invitations.data.map(item=><article className="pending-invitation" key={item.id}><div><strong>{item.organizationName}</strong><small>{item.role.replaceAll('_',' ')} · Expires {new Date(item.expiresAt).toLocaleDateString()}</small></div><button className="btn secondary" disabled={action.isPending} onClick={()=>{action.reset();setSelected(item)}}>Review invitation</button></article>)}
  <Modal open={Boolean(selected)} onClose={()=>{if(!action.isPending)setSelected(undefined)}} title="Review organization invitation" subtitle={selected?.organizationName}>
   <p>Join as <strong>{selected?.role.replaceAll('_',' ')}</strong>? This grants application membership, not AWS credentials.</p>
   {action.error&&<p role="alert" className="error-box">Unable to update this invitation. It may have expired or been revoked. Refresh and try again.</p>}
   <div className="modal-actions"><button className="btn secondary" disabled={action.isPending} onClick={()=>selected&&action.mutate({id:selected.id,accept:false})}>Decline invitation</button><button className="btn primary" disabled={action.isPending} onClick={()=>selected&&action.mutate({id:selected.id,accept:true})}>{action.isPending?'Updating invitation…':'Accept invitation'}</button></div>
  </Modal>
 </section>;
}
