import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { fuzzyIdentities } from '../lib/iam';
import { ErrorState, LoadingSkeleton, ResponsiveTable, SearchToolbar, type TableColumn } from '../components/ui';
import type { IamIdentity,TargetType } from '../types';

export default function Identities(){
 const [type,setType]=useState<TargetType>('USER'),[selected,setSelected]=useState<IamIdentity>(),[search,setSearch]=useState(''),[includeServiceLinked,setIncludeServiceLinked]=useState(false);
 const users=useQuery({queryKey:['users'],queryFn:()=>api.users()});
 const roles=useQuery({queryKey:['roles',includeServiceLinked],queryFn:()=>api.roles('',includeServiceLinked)});
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
 return <div className="page">
  <div className="page-header"><div><p className="eyebrow">AWS identities</p><h1>IAM users and roles</h1><p>Read-only identity discovery for selecting request targets. Credential material is never requested or displayed.</p></div></div>
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
function consoleAccess(identity:IamIdentity){if(identity.passwordEnabled===undefined)return <span title="IAM does not always expose console password status from list responses.">Unknown</span>;return identity.passwordEnabled?'Enabled':'Disabled'}
function fmt(value:string){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value))}
function readError(error:unknown){return (error as any)?.response?.data?.error?.message??(error as Error)?.message??'AWS identity discovery failed.'}
