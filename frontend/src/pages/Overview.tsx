import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight,PlugZap } from 'lucide-react';
import { api } from '../lib/api';

export default function Overview(){
 const connection=useQuery({queryKey:['connection'],queryFn:api.connection});
 const requests=useQuery({queryKey:['requests'],queryFn:()=>api.requests()});
 const activity=useQuery({queryKey:['activity'],queryFn:api.activity});
 const list=requests.data?.data??[];
 const count=(status:string)=>list.filter(r=>r.status===status).length;
 const needs=list.filter(r=>['Pending approval','Provisioning failed'].includes(r.status)||r.status==='Provisioned'&&r.expiryDate&&Date.parse(r.expiryDate)<Date.now()+86400000);
 return <div className="page">
  <div className="page-header">
   <div><p className="eyebrow">Operational overview</p><h1>AWS permission requests</h1><p>Request, approve, preview, attach, and revoke IAM managed policies through a guarded backend workflow.</p></div>
   <Link className="primary-action" to="/new-request">New permission request <ArrowRight size={16}/></Link>
  </div>
  <section className="overview-grid">
   <div className="panel connection-panel">
    <div className="panel-title"><PlugZap size={17}/>Connection</div>
    <dl>
     <div><dt>Status</dt><dd>{connection.data?.connected?'Connected':'Disconnected'}</dd></div>
     <div><dt>Account ID</dt><dd>{connection.data?.accountId}</dd></div>
     <div><dt>Principal ARN</dt><dd className="mono">{connection.data?.principalArn}</dd></div>
     <div><dt>Region</dt><dd>{connection.data?.region}</dd></div>
     <div><dt>Last checked</dt><dd>{fmt(connection.data?.lastChecked)}</dd></div>
    </dl>
   </div>
   <div className="panel">
    <div className="panel-title">Request summary</div>
    <div className="summary-list">
     {['Pending approval','Approved','Provisioned','Rejected'].map(status=><Link to={`/requests?status=${encodeURIComponent(status)}`} key={status}><span>{status}</span><strong>{count(status)}</strong></Link>)}
    </div>
   </div>
   <div className="panel">
    <div className="panel-title">Needs attention</div>
    <div className="attention-list">{needs.length?needs.slice(0,5).map(r=><Link to={`/requests/${r.id}`} key={r.id}><strong>{r.id}</strong><span>{r.title}</span><em>{r.status}</em></Link>):<p className="muted">No pending approval, failed provisioning, or near-expiry items.</p>}</div>
   </div>
   <div className="panel wide">
    <div className="panel-title">Recent activity</div>
    <div className="activity-list">{(activity.data?.data??[]).slice(0,8).map(event=><div key={event.id}><time>{fmt(event.timestamp)}</time><strong>{event.action}</strong><span>{event.actor}{event.requestId?` · ${event.requestId}`:''}</span></div>)}</div>
   </div>
  </section>
 </div>;
}

function fmt(value?:string){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not checked'}
