import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { LoadingSkeleton, PageHeader, ResponsiveTable, SearchToolbar, StatusBadge, TechnicalDetails, type TableColumn } from '../components/ui';
import type { AuditEvent } from '../types';

export default function Activity(){
 const [search,setSearch]=useState(''),[result,setResult]=useState(''),[action,setAction]=useState('');
 const {data,isLoading}=useQuery({queryKey:['activity'],queryFn:api.activity});
 const events=data?.data??[];
 const filtered=useMemo(()=>events.filter(event=>{
  const text=[event.actor,event.action,event.requestId,event.targetArn,event.policyArn,event.awsRequestId,event.errorCode].filter(Boolean).join(' ').toLowerCase();
  return (!search.trim()||text.includes(search.trim().toLowerCase()))&&(!result||event.result===result)&&(!action||event.action===action);
 }),[events,search,result,action]);
 const actions=[...new Set(events.map(event=>event.action))].sort();
 const columns:TableColumn<AuditEvent>[]=[
  {key:'timestamp',header:'Timestamp',priority:'high',render:event=>fmt(event.timestamp)},
  {key:'actor',header:'Actor',priority:'medium',render:event=>event.actor},
  {key:'action',header:'Action',priority:'high',render:event=>event.action},
  {key:'request',header:'Request',priority:'high',render:event=>event.requestId??'-'},
  {key:'target',header:'Target ARN',priority:'medium',className:'mono wrap-cell',render:event=>event.targetArn??'-'},
  {key:'policy',header:'Policy ARN',priority:'low',className:'mono wrap-cell',render:event=>event.policyArn??'-'},
  {key:'result',header:'Result',priority:'high',render:event=><StatusBadge status={event.result}/>},
  {key:'aws',header:'AWS request ID',priority:'low',render:event=>event.awsRequestId??'-'}
 ];
 return <div className="page">
  <PageHeader eyebrow="Activity" title="Audit history" description="Search connection, discovery, request lifecycle, provisioning, revocation and expiry events."/>
  <SearchToolbar resultCount={filtered.length}>
   <label className="search-field"><input aria-label="Search activity" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search activity"/></label>
   <select value={action} onChange={event=>setAction(event.target.value)} aria-label="Filter by action"><option value="">All actions</option>{actions.map(item=><option key={item}>{item}</option>)}</select>
   <select value={result} onChange={event=>setResult(event.target.value)} aria-label="Filter by result"><option value="">All results</option><option>SUCCESS</option><option>FAILED</option><option>INFO</option></select>
   {(search||action||result)&&<button className="btn btn-secondary" onClick={()=>{setSearch('');setAction('');setResult('')}}>Clear filters</button>}
  </SearchToolbar>
  {isLoading?<LoadingSkeleton rows={8}/>:<>
   <ResponsiveTable rows={filtered} columns={columns} getRowKey={event=>event.id} emptyTitle={events.length?'No activity matches these filters.':'No audit activity yet'} emptyBody={events.length?'Clear filters or broaden the search.':'Connection tests, request decisions and provisioning results will appear here.'}/>
   {filtered.length>0&&<TechnicalDetails title="Raw audit metadata" summary="Collapsed troubleshooting view"><pre>{JSON.stringify(filtered.slice(0,20),null,2)}</pre></TechnicalDetails>}
  </>}
 </div>;
}
function fmt(value:string){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
