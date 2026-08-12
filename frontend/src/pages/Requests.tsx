import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { permissionLabel, requestSearchText, scopeLabel, sortRequests } from '../lib/requestQueue';
import { EmptyState, LoadingSkeleton, PageHeader, ResponsiveTable, RiskBadge, SearchToolbar, StatusBadge, type TableColumn } from '../components/ui';
import { can } from '../lib/authz';
import { useAuthStore } from '../store/auth';
import { accountLabel, expiringSoon, isClosedRequest, isGrantedRequest, isOpenRequest, needsRequesterResponse, requestRisk } from '../lib/requestPresentation';
import type { PermissionRequest } from '../types';

const sortOptions=[
 {value:'submitted-desc',label:'Newest submitted'},
 {value:'submitted-asc',label:'Oldest submitted'},
 {value:'title-asc',label:'Title A-Z'},
 {value:'status-asc',label:'Status A-Z'}
];

export default function Requests(){
 const session=useAuthStore(state=>state.session),userId=session?.user?.id,canViewAll=can(session,'REQUEST_VIEW_ALL'),canReview=can(session,'REQUEST_REVIEW');
 const [params,setParams]=useSearchParams(),navigate=useNavigate();
 const [search,setSearch]=useState(''),[sort,setSort]=useState('submitted-desc');
 const tabs=canViewAll?['All','Needs review','Provisioning','Granted','Closed']:canReview?['Needs my attention','Reviewed','My requests']:['All','Open','Granted','Closed','Needs my response'];
 const active=params.get('filter')??params.get('status')??tabs[0]!;
 const {data,isLoading}=useQuery({queryKey:['requests','list'],queryFn:()=>api.requests()});
 const rows=useMemo(()=>{
  const term=search.trim().toLowerCase();
  return (data?.data??[])
   .filter(request=>filterForPersona(request,active,{userId,canReview,canViewAll}))
   .filter(request=>!term||requestSearchText(request).includes(term))
   .sort((a,b)=>sortRequests(a,b,sort));
 },[data,active,search,sort,userId,canReview,canViewAll]);
 const columns:TableColumn<PermissionRequest>[]=[
  {key:'id',header:'Request',priority:'high',render:r=><Link to={`/requests/${r.id}`} className="request-title-cell"><span className="mono link">{r.id}</span><strong>{permissionLabel(r)}</strong><small>{r.title}</small></Link>},
  {key:'account',header:'AWS account',priority:'high',render:r=><><strong>{accountLabel(r)}</strong><small>{scopeLabel(r)}</small></>},
  {key:'requester',header:'Requested by',priority:canViewAll||canReview?'medium':'low',render:r=>canViewAll||canReview?r.requester:<span className="muted">You</span>},
  {key:'target',header:'Target',priority:'medium',render:r=><><strong>{r.targetName}</strong><small>{r.targetType}</small></>},
  {key:'risk',header:'Risk',priority:'medium',render:r=><RiskBadge risk={requestRisk(r)}/>},
  {key:'status',header:'Status',priority:'high',render:r=><StatusBadge status={r.status}/>},
  {key:'duration',header:'Duration',priority:'medium',render:r=><><span>{r.duration}</span>{r.expiryDate&&<small>Expires {fmt(r.expiryDate)}</small>}</>},
  {key:'submitted',header:'Submitted',priority:'low',render:r=>fmt(r.submittedAt)}
 ];
 const title=canViewAll?'Requests':canReview?'Requests':'My Requests';
 return <div className="page">
  <PageHeader eyebrow="Requests" title={title} description={canViewAll?'Review all access requests, provisioning work, and completed grants.':canReview?'Start with requests that need your decision, then review your own request history.':'Track your access requests, approval progress, granted access, and closed requests.'} actions={<Link className="primary-action" to="/new-request">New request</Link>}/>
  <SearchToolbar resultCount={rows.length}>
   <label className="search-field"><Search size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search request, permission, account, target or approver"/></label>
   <select value={sort} onChange={event=>setSort(event.target.value)} aria-label="Sort requests">{sortOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
  </SearchToolbar>
  <div className="filter-row segmented" aria-label="Request filters">{tabs.map(filter=><button className={active===filter?'active':''} onClick={()=>setParams(filter===tabs[0]?{}:{filter})} key={filter}>{filter}</button>)}</div>
  {isLoading?<LoadingSkeleton rows={8}/>:rows.length?<ResponsiveTable rows={rows} columns={columns} getRowKey={row=>row.id} onRowClick={row=>navigate(`/requests/${row.id}`)} emptyTitle="No matching requests" emptyBody="Try another search or status filter." rowActionLabel="Open request"/>:<EmptyState title={emptyTitle(active,canReview,canViewAll)} body={emptyBody(active,canReview,canViewAll)}/>}
 </div>;
}
function filterForPersona(request:PermissionRequest,active:string,{userId,canReview,canViewAll}:{userId?:string;canReview:boolean;canViewAll:boolean}){
 if(active==='All'||active==='My requests')return active==='All'||request.requesterUserId===userId||!canReview&&!canViewAll;
 if(active==='Open')return isOpenRequest(request);
 if(active==='Granted')return isGrantedRequest(request);
 if(active==='Closed')return isClosedRequest(request);
 if(active==='Needs my response')return needsRequesterResponse(request,userId);
 if(active==='Needs my attention'||active==='Needs review')return request.status==='Pending approval'||request.status==='More information required';
 if(active==='Reviewed')return ['Approved','Rejected','Provisioned','Expired','Revoked'].includes(request.status);
 if(active==='Provisioning')return ['Approved','Provisioning','Provisioning failed'].includes(request.status);
 if(active==='Expiring')return expiringSoon(request);
 return request.status===active;
}
function emptyTitle(active:string,canReview:boolean,canViewAll:boolean){if(active.includes('attention')||active.includes('review'))return "You're all caught up.";if(!canReview&&!canViewAll)return 'No requests yet.';return 'No matching requests.'}
function emptyBody(active:string,canReview:boolean,canViewAll:boolean){if(active.includes('attention')||active.includes('review'))return 'No requests currently require your approval.';if(!canReview&&!canViewAll)return 'Request AWS access when you need temporary or permanent permissions.';return 'Try another search or status filter.'}
function fmt(value?:string){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value)):'Draft'}
