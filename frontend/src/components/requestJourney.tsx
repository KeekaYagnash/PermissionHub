import { Check,Clock,ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PermissionRequest } from '../types';
import { accountLabel,approvalStages,formatDate,requestRisk,shortDate,statusPresentation } from '../lib/requestPresentation';
import { permissionLabel } from '../lib/requestQueue';
import { StatusBadge } from './ui';

export function AttentionCard({label,value,to,description}:{label:string;value:number|string;to:string;description?:string}){return <Link className="attention-card" to={to}><span>{label}</span><strong>{value}</strong>{description&&<small>{description}</small>}</Link>}

export function RequestMiniList({requests,empty,showRequester=false}:{requests:PermissionRequest[];empty:string;showRequester?:boolean}){
 if(!requests.length)return <p className="muted">{empty}</p>;
 return <div className="request-mini-list">{requests.map(request=><Link to={`/requests/${request.id}`} key={request.id}><span><strong>{request.id}</strong><small>{permissionLabel(request)}</small></span><em>{accountLabel(request)}</em>{showRequester&&<em>{request.requester}</em>}<span className={`risk ${requestRisk(request).toLowerCase()}`}>{requestRisk(request)}</span><StatusBadge status={request.status}/><time>{shortDate(request.submittedAt??request.createdAt)}</time></Link>)}</div>;
}

export function MyAccessCard({request}:{request:PermissionRequest}){const grantedAt=request.timeline.find(item=>/attached|completed|approved/i.test(item.label))?.timestamp??request.submittedAt;return <article className="my-access-card"><div><strong>{accountLabel(request)}</strong><small>{request.targetType}: {request.targetName}</small></div><p>{permissionLabel(request)}</p><span className="status success">Active</span><dl><div><dt>Granted</dt><dd>{formatDate(grantedAt)}</dd></div><div><dt>Expires</dt><dd>{request.expiryDate?formatDate(request.expiryDate):'No automatic expiry'}</dd></div></dl><Link to={`/requests/${request.id}`}>View access <ExternalLink size={13}/></Link></article>}

export function ApprovalTimeline({request}:{request:PermissionRequest}){return <ol className="approval-timeline">{approvalStages(request).map((stage,index)=>{const stateClass=stage.state==='complete'?'done':stage.state==='active'?'current':stage.state==='failed'?'blocked':'';return <li key={stage.label} className={stateClass}><i>{stage.state==='complete'?<Check size={14}/>:stage.state==='active'?<Clock size={14}/>:stage.state==='failed'?'!':index+1}</i><div><strong>{stage.label}</strong><small>{stage.detail?stage.detail.includes('T')?formatDate(stage.detail):stage.detail:'Waiting'}</small></div></li>})}</ol>}

export function RequestHeaderSummary({request}:{request:PermissionRequest}){const status=statusPresentation(request.status);return <div className="request-header-summary"><div><Link to="/requests" className="back-link">Requests</Link><h1>{request.id}</h1><p>{request.title}</p></div><div><StatusBadge status={request.status}/><small>{status.description}</small></div></div>}
