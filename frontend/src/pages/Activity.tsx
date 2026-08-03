import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { LoadingSkeleton, ResponsiveTable, StatusBadge, type TableColumn } from '../components/ui';
import type { AuditEvent } from '../types';

export default function Activity(){
 const {data,isLoading}=useQuery({queryKey:['activity'],queryFn:api.activity});
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
  <div className="page-header"><div><p className="eyebrow">Activity</p><h1>Audit history</h1><p>Connection tests, discovery, request lifecycle actions, provisioning, revocation, and expiry events.</p></div></div>
  {isLoading?<LoadingSkeleton rows={8}/>:<ResponsiveTable rows={data?.data??[]} columns={columns} getRowKey={event=>event.id} emptyTitle="No audit activity yet" emptyBody="Connection tests, request decisions and provisioning results will appear here."/>}
 </div>;
}
function fmt(value:string){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
