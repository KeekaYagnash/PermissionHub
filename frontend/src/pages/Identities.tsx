import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Link,useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {can} from '../lib/authz';
import {useAuthStore} from '../store/auth';
import { fuzzyIdentities } from '../lib/iam';
import { Badge,Button, ErrorState, LoadingSkeleton, Modal, PageHeader, ResponsiveTable, SearchToolbar, TechnicalDetails, type TableColumn } from '../components/ui';
import {MyAccessCard} from '../components/requestJourney';
import {isGrantedRequest,isOpenRequest,needsRequesterResponse} from '../lib/requestPresentation';
import type { IamIdentity,TargetType } from '../types';

export default function Identities(){
 const session=useAuthStore(state=>state.session),canViewAll=can(session,'IDENTITY_VIEW_ALL');
 const navigate=useNavigate();
 const [type,setType]=useState<TargetType>('USER'),[selected,setSelected]=useState<IamIdentity>(),[search,setSearch]=useState(''),[includeServiceLinked,setIncludeServiceLinked]=useState(false);
 const activeAccountRecordId=session?.user?.activeAwsAccountRecordId??session?.user?.activeAccountId;
 const myRequests=useQuery({queryKey:['requests','my-access'],queryFn:()=>api.requests(),enabled:!canViewAll});
 const users=useQuery({queryKey:['users',activeAccountRecordId],queryFn:()=>api.users(),enabled:canViewAll});
 const roles=useQuery({queryKey:['roles',activeAccountRecordId,includeServiceLinked],queryFn:()=>api.roles('',includeServiceLinked),enabled:canViewAll});
 const userDetail=useQuery({queryKey:['identity','user',activeAccountRecordId,selected?.name],queryFn:()=>api.user(selected!.name),enabled:canViewAll&&selected?.type==='USER'&&Boolean(selected?.name),staleTime:5*60*1000});
 const roleDetail=useQuery({queryKey:['identity','role',activeAccountRecordId,selected?.name],queryFn:()=>api.role(selected!.name),enabled:canViewAll&&selected?.type==='ROLE'&&Boolean(selected?.name),staleTime:5*60*1000});
 const activeQuery=type==='USER'?users:roles;
 const rows=useMemo(()=>fuzzyIdentities(type==='USER'?users.data?.data??[]:roles.data?.data??[],search,includeServiceLinked),[type,users.data,roles.data,search,includeServiceLinked]);
 const columns:TableColumn<IamIdentity>[]=type==='USER'?[
  {key:'name',header:'Name',priority:'high',render:i=><><strong>{i.name}</strong><small className="mono wrap-cell">{i.arn}</small>{i.description&&<small>{i.description}</small>}</>},
  {key:'created',header:'Created',priority:'medium',render:i=>fmt(i.createdAt)},
  {key:'managed',header:'Managed policies',priority:'medium',align:'right',render:i=>i.attachedPolicies.length},
  {key:'inline',header:'Inline policies',priority:'medium',align:'right',render:i=>i.inlinePolicies.length},
  {key:'console',header:'Console access',priority:'medium',render:i=>consoleAccess(i)}
 ]:[
  {key:'name',header:'Role name',priority:'high',render:i=><><strong>{i.name}</strong>{i.description&&<small>{i.description}</small>}<small className="mono wrap-cell">{i.arn}</small></>},
  {key:'path',header:'Path',priority:'medium',render:i=>i.path},
  {key:'created',header:'Created',priority:'medium',render:i=>fmt(i.createdAt)},
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
  {activeQuery.isLoading?<LoadingSkeleton rows={8}/>:activeQuery.error?<ErrorState title="Could not load IAM identities" body={readError(activeQuery.error)} onRetry={()=>activeQuery.refetch()}/>:<ResponsiveTable rows={rows} columns={columns} getRowKey={row=>row.arn} selectedKey={selected?.arn} onRowClick={setSelected} emptyTitle="No identities found" emptyBody="Try another search or include service-linked roles." rowActionLabel="Inspect identity"/>}
  <IdentityDetailsModal identity={selected} detail={selected?.type==='USER'?userDetail:roleDetail} onClose={()=>setSelected(undefined)} onRequest={(identity)=>navigate(`/new-request?targetType=${identity.type}&targetName=${encodeURIComponent(identity.name)}&targetArn=${encodeURIComponent(identity.arn)}`)}/>
 </div>;
}

function IdentityDetailsModal({identity,detail,onClose,onRequest}:{identity?:IamIdentity;detail:ReturnType<typeof useQuery<any>>;onClose:()=>void;onRequest:(identity:IamIdentity)=>void}) {
 const resolved=detail.data?.arn===identity?.arn?detail.data as IamIdentity:undefined;
 const data=identity;
 const label=data?.type==='ROLE'?'IAM Role':data?.type==='GROUP'?'IAM Group':'IAM User';
 const loading=Boolean(identity)&&!resolved&&detail.isFetching;
 return <Modal open={Boolean(identity)} onClose={onClose} title={identity?.name ?? `${label} details`} subtitle={identity?.arn} eyebrow={`${label} details`} closeLabel={`Close ${label.toLowerCase()} details`} wide>
  {!data?<LoadingSkeleton rows={4}/>:<div className="entity-detail">
   <div className="entity-detail-title"><div><h2>{data.name}</h2><p className="mono wrap-cell">{data.arn}</p></div><div className="entity-badges"><Badge tone="info">{label}</Badge></div></div>
   {loading?<LoadingSkeleton rows={5}/>:detail.error&&!resolved?<div className="error-panel"><strong>Unable to load {label.toLowerCase()} details</strong><span>{readError(detail.error)}</span><Button variant="secondary" onClick={()=>detail.refetch()}>Retry</Button></div>:<IdentityDetailContent data={resolved??data} onClose={onClose} onRequest={onRequest}/>}
  </div>}
 </Modal>
}
function IdentityDetailContent({data,onClose,onRequest}:{data:IamIdentity;onClose:()=>void;onRequest:(identity:IamIdentity)=>void}) {
 return <>
   <section className="entity-section"><h3>Overview</h3><dl className="detail-grid">
    <div><dt>Name</dt><dd>{data.name}</dd></div>
    <div><dt>ARN</dt><dd className="mono wrap-cell">{data.arn}</dd></div>
    <div><dt>Path</dt><dd>{data.path}</dd></div>
    <div><dt>Created</dt><dd>{fmt(data.createdAt)}</dd></div>
    {data.type==='USER'?<div><dt>Console access</dt><dd>{consoleAccess(data)}</dd></div>:<div><dt>Maximum session duration</dt><dd>{data.maxSessionDuration?`${Math.round(data.maxSessionDuration/60)} min`:'Unknown'}</dd></div>}
    <div><dt>Permission boundary</dt><dd>{data.permissionBoundary??'No boundary reported'}</dd></div>
    {data.description&&<div><dt>Description</dt><dd>{data.description}</dd></div>}
   </dl></section>
   <section className="entity-section"><h3>Permissions</h3><div className="entity-list-block"><strong>Managed policies <span>{data.attachedPolicies.length}</span></strong>{data.attachedPolicies.length?<div className="chips">{data.attachedPolicies.map(policy=><span key={policy.policyArn}>{policy.policyName}</span>)}</div>:<p className="muted">No attached managed policies.</p>}</div><div className="entity-list-block"><strong>Inline policies <span>{data.inlinePolicies.length}</span></strong>{data.inlinePolicies.length?<div className="chips">{data.inlinePolicies.map(policy=><span key={policy}>{policy}</span>)}</div>:<p className="muted">No inline policies.</p>}</div></section>
   {data.type==='USER'&&<section className="entity-section"><h3>Groups</h3>{data.users?.length?<div className="chips">{data.users.map(user=><span key={user.userName}>{user.userName}</span>)}</div>:<p className="muted">Group membership is not reported by this response.</p>}</section>}
   {data.type==='ROLE'&&data.trustPolicy!==undefined&&<TechnicalDetails title="Trust relationship" summary="Assume role policy document"><pre>{JSON.stringify(data.trustPolicy,null,2)}</pre></TechnicalDetails>}
   {data.tags&&Object.keys(data.tags).length>0&&<TechnicalDetails title="Tags" summary={`${Object.keys(data.tags).length} tag${Object.keys(data.tags).length===1?'':'s'}`}><dl className="detail-grid">{Object.entries(data.tags).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></TechnicalDetails>}
   <TechnicalDetails title="Technical details" summary="Raw discovered identity metadata"><pre>{JSON.stringify(data,null,2)}</pre></TechnicalDetails>
   <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={()=>onRequest(data)}>Request additional access</Button></div>
  </>
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
