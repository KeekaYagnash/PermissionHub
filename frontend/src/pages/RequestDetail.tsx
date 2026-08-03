import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Button, LoadingSkeleton, StatusBadge } from '../components/ui';
import { useAuthStore } from '../store/auth';

export default function RequestDetail(){
 const {id=''}=useParams(),qc=useQueryClient();
 const permissions=useAuthStore(state=>state.session?.user?.permissions??[]),canApprove=permissions.includes('approveRequest'),canProvision=permissions.includes('provisionRequest'),canRevoke=permissions.includes('revokeGrant');
 const {data,isLoading}=useQuery({queryKey:['request',id],queryFn:()=>api.request(id),enabled:Boolean(id)});
 const [comment,setComment]=useState('');
 const reload=async()=>{await Promise.all([qc.invalidateQueries({queryKey:['request',id]}),qc.invalidateQueries({queryKey:['requests']}),qc.invalidateQueries({queryKey:['activity']})])};
 const action=(fn:()=>Promise<unknown>)=>useMutation({mutationFn:fn,onSuccess:reload});
 const approve=action(()=>api.approve(id,comment));
 const reject=action(()=>api.reject(id,comment));
 const info=action(()=>api.requestInfo(id,comment));
 const simulate=useMutation({mutationFn:()=>api.simulate(id),onSuccess:reload});
 const provision=useMutation({mutationFn:()=>api.provision(id),onSuccess:reload});
 const revoke=useMutation({mutationFn:()=>api.revoke(id),onSuccess:reload});
 const approveAndProvision=useMutation({mutationFn:async()=>{await api.approve(id,comment);return api.provision(id)},onSuccess:reload});
 const busy=approve.isPending||reject.isPending||info.isPending||simulate.isPending||provision.isPending||revoke.isPending||approveAndProvision.isPending;
 const error=[approve,reject,info,simulate,provision,revoke,approveAndProvision].find(m=>m.isError)?.error;
 if(isLoading||!data)return <div className="page"><LoadingSkeleton rows={8}/></div>;
 const pending=['Pending approval','More information required'].includes(data.status);
 const approved=data.status==='Approved';
 const activeGrant=['Provisioned','Expired'].includes(data.status);
 const needsComment=comment.trim().length<2;
 return <div className="page detail-page">
  <div className="detail-header"><div><Link to="/requests" className="back-link">Requests</Link><h1>{data.id}</h1><p>{data.title}</p></div><StatusBadge status={data.status}/></div>
  <section className="detail-layout">
   <article className="detail-main">
    <div className="request-meta summary-cards">
     <RequestSummaryCard label="Requester" value={data.requester}/>
     <RequestSummaryCard label="Approver" value={data.approver}/>
     <RequestSummaryCard label="Target identity" value={`${data.targetType} · ${data.targetName}`}/>
     <RequestSummaryCard label="Submitted" value={fmt(data.submittedAt)}/>
    </div>
    <section className="panel"><h2>Business justification</h2><p>{data.justification}</p>{data.notes&&<><h3>Optional notes</h3><p>{data.notes}</p></>}</section>
    <section className="panel"><h2>Requested access</h2><div className="chips">{data.items.map(item=><span key={item.policyArn??item.actions?.join()}>{item.policyName??item.actions?.join(', ')}</span>)}</div></section>
    <section className="panel"><h2>Resource scope</h2><p>{data.scope.type==='ALL'?'All applicable resources':data.scope.resources.join(', ')||data.scope.arn}</p><h3>Timing</h3><dl className="detail-dl"><div><dt>Duration</dt><dd>{data.duration}</dd></div><div><dt>Starts</dt><dd>{fmt(data.startDate)}</dd></div><div><dt>Expires</dt><dd>{data.expiryDate?fmt(data.expiryDate):'No automatic expiry'}</dd></div></dl></section>
    <section className="panel"><h2>Permission change preview</h2><div className="preview-grid"><div><h3>Before</h3>{data.preview?.before.managedPolicies.map(p=><p key={p.policyArn}>{p.policyName}</p>)}{data.preview?.before.inlinePolicies.map(p=><p key={p}>{p} inline</p>)||<p className="muted">No inline policies reported.</p>}</div><div><h3>Requested change</h3>{data.preview?.change.policiesToAttach.map(p=><p key={p.policyArn??p.policyName}>{p.policyName??p.actions?.join(', ')}</p>)}<p>{data.preview?.awsOperation}</p><small>Simulation is an estimate, not a guarantee of final live authorization.</small></div><div><h3>After</h3>{data.preview?.after.managedPolicies.map(p=><p key={p.policyArn}>{p.policyName}</p>)}{data.preview?.after.riskFlags.map(flag=><p className="risk-text" key={flag}>{flag}</p>)}</div></div>{data.items.some(i=>i.generatedPolicyDocument)&&<><h3>Generated policy document</h3><pre>{JSON.stringify(data.items.find(i=>i.generatedPolicyDocument)?.generatedPolicyDocument,null,2)}</pre></>}</section>
    {Boolean(data.simulationResult)&&<section className="panel"><h2>Simulation results</h2><pre>{JSON.stringify(data.simulationResult,null,2)}</pre></section>}
    {Boolean(data.provisioningResult)&&<section className="panel"><h2>Provisioning result</h2><pre>{JSON.stringify(data.provisioningResult,null,2)}</pre></section>}
   </article>
   <aside className="panel side-panel approval-panel">
    <h2>Review and provisioning</h2>
    <p className="muted">Approve/reject decisions and provisioning calls are recorded in the audit timeline. Real IAM changes still require the guarded backend provisioning mode.</p>
    <label className="field"><span>Review comment</span><textarea value={comment} onChange={event=>setComment(event.target.value)} placeholder="Add context for reject or information requests. Optional for approval."/><small>Required for Reject and Request information.</small></label>
    <div className="approval-actions">
     {canApprove&&<Button onClick={()=>approve.mutate()} disabled={busy||!pending}>Approve</Button>}
     {canApprove&&canProvision&&<Button variant="secondary" className="strong-secondary" onClick={()=>approveAndProvision.mutate()} disabled={busy||!pending}>Approve and provision</Button>}
     <Button variant="secondary" onClick={()=>simulate.mutate()} disabled={busy}>Run simulation</Button>
     {canProvision&&<Button variant="secondary" onClick={()=>provision.mutate()} disabled={busy||!approved}>Provision approved change</Button>}
     {canApprove&&<Button variant="ghost" onClick={()=>info.mutate()} disabled={busy||needsComment||data.status!=='Pending approval'}>Request information</Button>}
     {canApprove&&<Button variant="danger" onClick={()=>reject.mutate()} disabled={busy||needsComment||!pending}>Reject</Button>}
     {canRevoke&&<Button variant="danger" onClick={()=>revoke.mutate()} disabled={busy||!activeGrant}>Revoke grant</Button>}
    </div>
    {busy&&<p className="muted">Updating request lifecycle...</p>}
    {error&&<p className="warning">{readError(error)}</p>}
    <h2>Timeline</h2><ol className="timeline">{data.timeline.map((event,index)=><li key={`${event.label}${index}`}><i/><div><strong>{event.label}</strong><span>{fmt(event.timestamp)}{event.result?` · ${event.result}`:''}</span></div></li>)}</ol>
   </aside>
  </section>
 </div>;
}
function RequestSummaryCard({label,value}:{label:string;value:string}){return <div><span>{label}</span><strong>{value}</strong></div>}
function fmt(value?:string){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not submitted'}
function readError(error:unknown){return (error as any)?.response?.data?.error?.message??(error as Error)?.message??'Request action failed.'}
