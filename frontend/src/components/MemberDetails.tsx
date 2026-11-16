import {useCallback,useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api,type AccountAccess,type MemberDetails as Detail} from '../lib/api';
import {roleCapabilities,type Capability} from '../lib/authz';
import type {AppRole} from '../types';
import {useAuthStore} from '../store/auth';
import {Modal} from './ui';

const roles=['REQUESTER','ACCOUNT_APPROVER','OU_ADMIN','SECURITY_REVIEWER','PROVISIONER','ORGANISATION_ADMIN'];
const emptyAccess:AccountAccess={canView:false,canRequest:false,canApprove:false,canProvision:false,canRevoke:false};
const flags:{key:keyof AccountAccess;label:string;capability?:Capability}[]=[{key:'canView',label:'View account'},{key:'canRequest',label:'Request access',capability:'REQUEST_CREATE'},{key:'canApprove',label:'Approve requests',capability:'REQUEST_APPROVE'},{key:'canProvision',label:'Provision approved access',capability:'PROVISION_EXECUTE'},{key:'canRevoke',label:'Revoke grants',capability:'GRANT_REVOKE'}];
type Action={kind:'SAVE';accountId:string;access:AccountAccess}|{kind:'REMOVE';accountId:string}|{kind:'ROLE';role:string};

export function MemberDetails({membershipId,onClose}:{membershipId?:string;onClose:()=>void}){
 const session=useAuthStore(state=>state.session),setSession=useAuthStore(state=>state.setSession),tenantId=session?.user?.activeTenantId,client=useQueryClient();
 const [dirty,setDirty]=useState<Set<string>>(new Set());
 const markDirty=useCallback((id:string,value:boolean)=>setDirty(previous=>{if(previous.has(id)===value)return previous;const next=new Set(previous);if(value)next.add(id);else next.delete(id);return next}),[]);
 const details=useQuery({queryKey:['organization-member',tenantId,membershipId],queryFn:()=>api.memberDetails(membershipId!),enabled:Boolean(membershipId&&tenantId)});
 const action=useMutation({mutationFn:(input:Action)=>input.kind==='ROLE'?api.changeMember(membershipId!,input.role):input.kind==='SAVE'?api.setMemberAccountAccess(membershipId!,input.accountId,input.access):api.removeMemberAccountAccess(membershipId!,input.accountId),onSuccess:async()=>{
  await Promise.all([client.invalidateQueries({queryKey:['organization-member',tenantId,membershipId]}),client.invalidateQueries({queryKey:['organization-members']}),client.invalidateQueries({queryKey:['admin-directory']}),client.invalidateQueries({queryKey:['auth-context']})]);setSession(await api.session());
 }});
 function close(){if(action.isPending)return;if(dirty.size&&!confirm('Discard unsaved member account-access changes?'))return;setDirty(new Set());action.reset();onClose()}
 const member=details.data,editable=member?.status==='ACTIVE'&&roles.includes(member.role);
 return <Modal open={Boolean(membershipId)} onClose={close} title="Member details" subtitle={member?.user.displayName} wide><div>
  {details.isPending?<p role="status">Loading member details…</p>:details.error?<div><p role="alert">Unable to load this member in the selected organization.</p><button className="btn secondary" onClick={()=>void details.refetch()}>Retry member details</button></div>:member&&<>
   <dl className="member-profile-summary"><div><dt>Name</dt><dd>{member.user.displayName}</dd></div><div><dt>Email</dt><dd>{member.user.email}</dd></div><div><dt>Status</dt><dd>{member.status}</dd></div><div><dt>Application role</dt><dd>{member.role.replaceAll('_',' ')}</dd></div></dl>
   {editable&&<MemberRole key={`${member.id}:${member.role}`} role={member.role} busy={action.isPending} onSave={role=>{if(dirty.size&&!confirm('Discard unsaved account-access changes before changing the application role?'))return;action.mutate({kind:'ROLE',role})}}/>}
   <h3>AWS account access</h3><p>Application roles control available actions. Explicit account scopes control where those actions are allowed. These settings do not create or change AWS IAM permissions.</p>
   {!member.accounts.length?<p>No AWS accounts are configured in this organization.</p>:<div className="member-access-list">{member.accounts.map(account=><AccountGrant key={`${account.id}:${member.role}:${JSON.stringify(account.directScope)}`} account={account} role={member.role} editable={Boolean(editable)} busy={action.isPending} markDirty={markDirty} onSave={access=>action.mutate({kind:'SAVE',accountId:account.id,access})} onRemove={()=>{if(confirm(`Remove the direct grant for ${account.accountName}? Inherited access, if any, will remain.`))action.mutate({kind:'REMOVE',accountId:account.id})}}/>)}</div>}
  </>}
  {action.isPending&&<p role="status">Updating member access…</p>}{action.error&&<p role="alert" className="error-box">{action.error.message}</p>}
 </div></Modal>;
}
function MemberRole({role,busy,onSave}:{role:string;busy:boolean;onSave:(role:string)=>void}){const [selected,setSelected]=useState(role);return <form className="form-grid" onSubmit={event=>{event.preventDefault();onSave(selected)}}><label className="field"><span>Application role</span><select aria-label="Member application role" disabled={busy} value={selected} onChange={event=>setSelected(event.target.value)}>{roles.map(value=><option key={value}>{value}</option>)}</select></label><button className="btn secondary" disabled={busy||selected===role}>Save application role</button></form>}
function AccountGrant({account,role,editable,busy,markDirty,onSave,onRemove}:{account:Detail['accounts'][number];role:string;editable:boolean;busy:boolean;markDirty:(id:string,dirty:boolean)=>void;onSave:(access:AccountAccess)=>void;onRemove:()=>void}){
 const initial=account.directScope??emptyAccess,[access,setAccess]=useState(initial),changed=JSON.stringify(access)!==JSON.stringify(initial),capabilities=roleCapabilities[role as AppRole]??[];
 useEffect(()=>{markDirty(account.id,changed);return()=>markDirty(account.id,false)},[account.id,changed,markDirty]);
 return <article className="member-account-access"><h3>{account.accountName}</h3><small>{account.awsAccountNumber} · {account.region} · {account.connectionStatus.replaceAll('_',' ')}</small><p>{account.effective.canView?'Account access available':'No account access granted'}</p>
  {Object.values(account.inherited).some(Boolean)&&<p className="warning">Inherited access applies. Removing a direct grant will not remove organization, OU or separately assigned access.</p>}
  <p className="muted">Allowed actions: {flags.filter(flag=>account.effective[flag.key]).map(flag=>flag.label).join(', ')||'None'}</p>
  <form onSubmit={event=>{event.preventDefault();onSave(access)}}><fieldset disabled={busy||!editable} className="member-access-flags"><legend>Direct account grant</legend>{flags.map(flag=><label key={flag.key}><input type="checkbox" aria-label={`${flag.label} for ${account.accountName}`} checked={access[flag.key]} disabled={Boolean(flag.capability&&!capabilities.includes(flag.capability))} onChange={event=>{const checked=event.target.checked;setAccess(current=>flag.key==='canView'&&!checked?{...emptyAccess}:{...current,[flag.key]:checked,...(checked?{canView:true}:{})})}}/>{flag.label}</label>)}</fieldset><div className="modal-actions"><button className="btn secondary" disabled={busy||!editable||!changed}>Save account access</button>{account.directScope&&<button type="button" className="btn danger" disabled={busy||!editable} onClick={onRemove}>Remove direct grant</button>}</div></form>
 </article>;
}
