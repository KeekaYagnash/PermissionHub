import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {can} from '../lib/authz';
import {useAuthStore} from '../store/auth';
import { fuzzyIdentities } from '../lib/iam';
import { ErrorState, LoadingSkeleton, PageHeader, ResponsiveTable, SearchToolbar, type TableColumn } from '../components/ui';
import {MyAccessCard} from '../components/requestJourney';
import {isGrantedRequest,isOpenRequest,needsRequesterResponse} from '../lib/requestPresentation';
import type { IamIdentity,TargetType } from '../types';

export default function Identities(){
 const session=useAuthStore(state=>state.session),canViewAll=can(session,'IDENTITY_VIEW_ALL');
 const [type,setType]=useState<TargetType>('USER'),[selected,setSelected]=useState<IamIdentity>(),[search,setSearch]=useState(''),[includeServiceLinked,setIncludeServiceLinked]=useState(false);
 const myRequests=useQuery({queryKey:['requests','my-access'],queryFn:()=>api.requests(),enabled:!canViewAll});
 const users=useQuery({queryKey:['users'],queryFn:()=>api.users(),enabled:canViewAll});
 const roles=useQuery({queryKey:['roles',includeServiceLinked],queryFn:()=>api.roles('',includeServiceLinked),enabled:canViewAll});
 const activeQuery=type==='USER'?users:roles;
 const rows=useMemo(()=>fuzzyIdentities(type==='USER'?users.data?.data??[]:roles.data?.data??[],search,includeServiceLinked),[type,users.data,roles.data,search,includeServiceLinked]);
 const columns:TableColumn<IamIdentity>[]=type==='USER'?[
  {key:'name',header:'Name',priority:'high',render:i=><><strong>{i.name}</strong>{i.description&&<small>{i.description}</small>}</>},
  {key:'arn',header:'ARN',priority:'high',className:'mono wrap-cell',render:i=>i.arn},
  {key:'created',header:'Created',priority:'medium',render:i=>fmt(i.createdAt)},
  {key:'console',header:'Console access',priority:'medium',render:i=>consoleAccess(i)},
  {key:'managed',header:'Managed policies',priority:'medium',align:'right',render:i=>i.attachedPolicies.length},
  {key:'inline',header:'Inline policies',priority:'low',align:'right',render:i=>i.inlinePolicies.length}
 ]:[
  {key:'name',header:'Name',priority:'high',render:i=><><strong>{i.name}</strong>{i.description&&<small>{i.description}</small>}</>},
  {key:'arn',header:'ARN',priority:'high',className:'mono wrap-cell',render:i=>i.arn},
  {key:'path',header:'Path',priority:'medium',render:i=>i.path},
  {key:'created',header:'Created',priority:'low',render:i=>fmt(i.createdAt)},
  {key:'session',header:'Max session',priority:'medium',render:i=>i.maxSessionDuration?`${Math.round(i.maxSessionDuration/60)} min`:'Unknown'},
  {key:'managed',header:'Attached policies',priority:'medium',align:'right',render:i=>i.attachedPolicies.length}
 ];
 if(!canViewAll)return <MyAwsAccess isLoading={myRequests.isLoading} requests={myRequests.data?.data??[]}/>;
 return <div className="page">
  <PageHeader eyebrow="AWS identities" title="IAM users and roles" description="Read-only identity discovery for selecting request targets. Credential material is never requested or displayed."/>
  <div className="tabs"><button className={type==='USER'?'active':''} onClick={()=>{setType('USER');setSelected(undefined)}}>IAM users</button><button className={type==='ROLE'?'active':''} onClick={()=>{setType('ROLE');setSelected(undefined)}}>IAM roles</button></div>
  <SearchToolbar resultCount={rows.length}>
   <label className="search-field"><Search size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, ARN, path or description"/></label>
   {type==='ROLE'&&<label className="check-row"><input type="checkbox" checked={includeServiceLinked} onChange={event=>setIncludeServiceLinked(event.target.checked)}/>Include service-linked roles</label>}
  </SearchToolbar>
  <section className="split identity-page-layout">
   {activeQuery.isLoading?<LoadingSkeleton rows={8}/>:activeQuery.error?<ErrorState title="Could not load IAM identities" body={readError(activeQuery.error)} onRetry={()=>activeQuery.refetch()}/>:<ResponsiveTable rows={rows} columns={columns} getRowKey={row=>row.arn} selectedKey={selected?.arn} onRowClick={setSelected} emptyTitle="No identities found" emptyBody="Try another search or include service-linked roles." rowActionLabel="Inspect identity"/>}
   <aside className="panel policy-detail identity-inspector">{selected?<><h2>{selected.name}</h2><p className="mono wrap-cell">{selected.arn}</p><dl><div><dt>Path</dt><dd>{selected.path}</dd></div><div><dt>Created</dt><dd>{fmt(selected.createdAt)}</dd></div>{selected.type==='USER'?<div><dt>Console access</dt><dd>{consoleAccess(selected)}</dd></div>:<div><dt>Maximum session</dt><dd>{selected.maxSessionDuration?`${selected.maxSessionDuration} seconds`:'Unknown'}</dd></div>}<div><dt>Permission boundary</dt><dd>{selected.permissionBoundary??'No boundary reported'}</dd></div></dl><h3>Attached managed policies</h3><div className="chips">{selected.attachedPolicies.length?selected.attachedPolicies.map(p=><span key={p.policyArn}>{p.policyName}</span>):<span>None</span>}</div><h3>Inline policies</h3><div className="chips">{selected.inlinePolicies.length?selected.inlinePolicies.map(p=><span key={p}>{p}</span>):<span>None</span>}</div>{selected.tags&&<><h3>Tags</h3><div className="chips">{Object.entries(selected.tags).map(([key,value])=><span key={key}>{key}: {value}</span>)}</div></>}</>:<p className="muted">Select an identity to inspect existing managed policies, inline policies, tags and permission boundary metadata.</p>}</aside>
  </section>
 </div>;
}
function MyAwsAccess({isLoading,requests}:{isLoading:boolean;requests:any[]}){
 const active=requests.filter(isGrantedRequest).sort((a,b)=>Date.parse(b.submittedAt??b.createdAt)-Date.parse(a.submittedAt??a.createdAt));
 const open=requests.filter(request=>isOpenRequest(request)&&!isGrantedRequest(request));
 const responseNeeded=requests.filter(request=>needsRequesterResponse(request));
 return <div className="page">
  <PageHeader eyebrow="AWS identities" title="My AWS access" description="Your granted access and open permission requests for the selected AWS account." actions={<Link className="primary-action" to="/new-request">Request additional access</Link>}/>
  {isLoading?<LoadingSkeleton rows={6}/>:<>
   {responseNeeded.length>0&&<section className="panel attention-card warning"><h2>Action required</h2><p>{responseNeeded.length} request{responseNeeded.length===1?' needs':'s need'} more information before review can continue.</p><Link to="/requests?filter=Needs%20my%20response">View requests</Link></section>}
   <section className="panel"><div className="section-heading"><div><p className="eyebrow">Currently granted</p><h2>Active AWS access</h2></div><span>{active.length} grant{active.length===1?'':'s'}</span></div>{active.length?<div className="my-access-grid">{active.map(request=><MyAccessCard key={request.id} request={request}/>)}</div>:<div className="empty-state"><h2>No active AWS access found</h2><p>Approved and provisioned requests will appear here after access is granted.</p></div>}</section>
   <section className="panel"><div className="section-heading"><div><p className="eyebrow">In progress</p><h2>Open requests</h2></div><span>{open.length}</span></div>{open.length?<div className="access-list">{open.map(request=><article key={request.id} className="account-row"><span><strong>{request.title}</strong><small>{request.targetType}: {request.targetName}</small></span><em>{request.status}</em><Link to={`/requests/${request.id}`}>View</Link></article>)}</div>:<p className="muted">No open permission requests.</p>}</section>
  </>}
 </div>
}
function consoleAccess(identity:IamIdentity){if(identity.passwordEnabled===undefined)return <span title="IAM does not always expose console password status from list responses.">Unknown</span>;return identity.passwordEnabled?'Enabled':'Disabled'}
function fmt(value:string){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value))}
function readError(error:unknown){return (error as any)?.response?.data?.error?.message??(error as Error)?.message??'AWS identity discovery failed.'}
