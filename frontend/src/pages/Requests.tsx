import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { filterRequest, permissionLabel, requestSearchText, scopeLabel, sortRequests } from '../lib/requestQueue';
import { EmptyState, LoadingSkeleton, ResponsiveTable, SearchToolbar, StatusBadge, type TableColumn } from '../components/ui';
import type { PermissionRequest } from '../types';

const filters=['All','My requests','Awaiting my approval','Approved','Provisioned','Rejected','Expiring'];
const sortOptions=[
 {value:'submitted-desc',label:'Newest submitted'},
 {value:'submitted-asc',label:'Oldest submitted'},
 {value:'title-asc',label:'Title A-Z'},
 {value:'status-asc',label:'Status A-Z'}
];

export default function Requests(){
 const [params,setParams]=useSearchParams(),navigate=useNavigate();
 const [search,setSearch]=useState(''),[sort,setSort]=useState('submitted-desc');
 const active=params.get('filter')??'All';
 const apiStatus=['Approved','Provisioned','Rejected'].includes(active)?active:undefined;
 const {data,isLoading}=useQuery({queryKey:['requests',apiStatus],queryFn:()=>api.requests(apiStatus?{status:apiStatus}:{})});
 const rows=useMemo(()=>{
  const term=search.trim().toLowerCase();
  return (data?.data??[])
   .filter(request=>filterRequest(request,active))
   .filter(request=>!term||requestSearchText(request).includes(term))
   .sort((a,b)=>sortRequests(a,b,sort));
 },[data,active,search,sort]);
 const columns:TableColumn<PermissionRequest>[]=[
  {key:'id',header:'Request ID',priority:'high',render:r=><Link to={`/requests/${r.id}`} className="mono link">{r.id}</Link>},
  {key:'title',header:'Title',priority:'high',render:r=><Link to={`/requests/${r.id}`} className="row-title">{r.title}</Link>},
  {key:'target',header:'Target',priority:'high',render:r=><><strong>{r.targetName}</strong><small>{r.targetType}</small></>},
  {key:'permission',header:'Permission',priority:'medium',render:r=><span className="truncate-cell">{permissionLabel(r)}</span>},
  {key:'scope',header:'Scope',priority:'medium',render:r=><span className="truncate-cell">{scopeLabel(r)}</span>},
  {key:'duration',header:'Duration',priority:'medium',render:r=>r.duration},
  {key:'status',header:'Status',priority:'high',render:r=><StatusBadge status={r.status}/>},
  {key:'approver',header:'Approver',priority:'medium',render:r=>r.approver},
  {key:'requester',header:'Requester',priority:'low',render:r=>r.requester},
  {key:'submitted',header:'Submitted',priority:'low',render:r=>fmt(r.submittedAt)}
 ];
 return <div className="page">
  <div className="page-header"><div><p className="eyebrow">Requests</p><h1>Permission request queue</h1><p>Search, review and act on IAM permission requests without leaving the request workflow.</p></div><Link className="primary-action" to="/new-request">New request</Link></div>
  <SearchToolbar resultCount={rows.length}>
   <label className="search-field"><Search size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search ID, title, target, permission, scope or approver"/></label>
   <select value={sort} onChange={event=>setSort(event.target.value)} aria-label="Sort requests">{sortOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
  </SearchToolbar>
  <div className="filter-row segmented" aria-label="Request status filters">{filters.map(filter=><button className={active===filter?'active':''} onClick={()=>setParams(filter==='All'?{}:{filter})} key={filter}>{filter}</button>)}</div>
  {isLoading?<LoadingSkeleton rows={8}/>:rows.length?<ResponsiveTable rows={rows} columns={columns} getRowKey={row=>row.id} onRowClick={row=>navigate(`/requests/${row.id}`)} emptyTitle="No matching requests" emptyBody="Try another search or status filter." rowActionLabel="View request"/>:<EmptyState title="No matching requests" body="Try another search or status filter."/>}
 </div>;
}
function fmt(value?:string){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value)):'Draft'}
