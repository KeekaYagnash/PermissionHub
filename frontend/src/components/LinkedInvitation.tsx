import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {Modal} from './ui';

/** Keep the actual invitation proof until an authenticated acceptance succeeds. */
export function LinkedInvitation({proof,onResolved}:{proof:string;onResolved:()=>void}){
 const session=useAuthStore(state=>state.session),setSession=useAuthStore(state=>state.setSession),client=useQueryClient(),[open,setOpen]=useState(false);
 const invitation=useQuery({queryKey:['invitation-link',proof],queryFn:()=>api.inspectInvitation(proof),enabled:Boolean(proof&&session?.user?.emailVerified),retry:false});
 const accept=useMutation({mutationFn:()=>api.acceptInvitation(proof),onSuccess:async result=>{setSession(result);sessionStorage.removeItem('permissionhub.invitation');setOpen(false);onResolved();await client.cancelQueries();client.clear()}});
 return <section className="panel linked-invitation" aria-label="Email invitation"><h2>Your email invitation</h2>
  {!session?.user?.emailVerified?<p>Verify your email address before accepting this invitation.</p>:invitation.isFetching?<p role="status">Checking your email invitation…</p>:invitation.error?<><p role="alert">{invitation.error.message}</p><p>Use the invited, verified email address. For expired, revoked or used links, ask your organization administrator for a fresh invitation, or check your memberships above.</p><button className="btn secondary" onClick={()=>void invitation.refetch()}>Check invitation again</button><Link className="btn secondary" to="/profile">Review signed-in account</Link></>:invitation.data?<><p>Join <strong>{invitation.data.organizationName}</strong> as {invitation.data.role.replaceAll('_',' ')}.</p><button className="btn primary" onClick={()=>{accept.reset();setOpen(true)}}>Review email invitation</button></>:null}
  <button className="link-button" disabled={accept.isPending} onClick={()=>{sessionStorage.removeItem('permissionhub.invitation');onResolved()}}>Dismiss email link</button>
  <Modal open={open} onClose={()=>{if(!accept.isPending)setOpen(false)}} title="Accept email invitation" subtitle={invitation.data?.organizationName}>
   <p>Accept membership as <strong>{invitation.data?.role.replaceAll('_',' ')}</strong>? AWS account access is still controlled separately.</p>
   {accept.error&&<p className="error-box" role="alert">{accept.error.message} Your invitation link has been kept so you can retry or request a replacement.</p>}
   <div className="modal-actions"><button className="btn secondary" disabled={accept.isPending} onClick={()=>setOpen(false)}>Cancel</button><button className="btn primary" disabled={accept.isPending} onClick={()=>accept.mutate()}>{accept.isPending?'Joining organization…':'Accept and join organization'}</button></div>
  </Modal>
 </section>;
}
