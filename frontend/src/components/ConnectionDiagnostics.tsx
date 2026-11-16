import {useQuery} from '@tanstack/react-query';
import {api} from '../lib/api';
import type {AwsAccountContext} from '../types';
import {TechnicalDetails} from './ui';

export function ConnectionDiagnostics({tenantId,organizationName,selectedRecordId,account,accountsLoading}:{tenantId?:string;organizationName?:string;selectedRecordId?:string;account?:AwsAccountContext;accountsLoading:boolean}){
 const selected=Boolean(tenantId&&selectedRecordId&&account?.id===selectedRecordId&&account.tenantId===tenantId);
 const query=useQuery({queryKey:['aws-diagnostics',tenantId,selectedRecordId],queryFn:api.awsDiagnostics,enabled:selected,refetchOnMount:'always'});
 const data=query.data,matching=Boolean(data&&data.activeTenantId===tenantId&&data.activeAwsAccountRecordId===selectedRecordId&&data.activeAccountId===account?.accountId&&['AVAILABLE','REPAIR_REQUIRED'].includes(data.diagnosticStatus));
 let body;
 if(!selectedRecordId)body=<p>Connect and select an AWS account to see connection diagnostics for this organization.</p>;
 else if(accountsLoading||selected&&query.isPending)body=<p role="status">Loading selected-account diagnostics…</p>;
 else if(!selected)body=<p>The selected account is unavailable in this organization. Select an authorized AWS account to view diagnostics.</p>;
 else if(query.error)body=<div><p role="alert">Diagnostics could not be loaded. This does not change your saved connection.</p><button className="btn secondary" onClick={()=>void query.refetch()}>Retry diagnostics</button></div>;
 else if(!data||!matching)body=<p>No diagnostic data is available for the selected account. Refresh diagnostics after connecting and selecting the account.</p>;
 else body=<><p className="connection-diagnostics-note">Latest saved connection status, read from PermissionHub. This is not a new AWS credential test. Use Validate connection to perform a fresh check.</p><dl className="connection-diagnostics-grid"><Row label="Organization" value={organizationName??'Selected organization'}/><Row label="AWS account" value={`${account?.accountName} · ${data.activeAccountId}`}/><Row label="Region" value={data.region}/><Row label="Connection status" value={words(data.connectionStatus)}/><Row label="Authentication method" value={words(data.connectionType)}/><Row label="Last credential validation" value={date(data.lastValidation)}/><Row label="Last successful discovery" value={date(data.lastSuccessfulRead)}/><Row label="Last successful provisioning" value={date(data.lastSuccessfulProvision)}/>{typeof data.credentialsConfigured==='boolean'&&<Row label="Stored credentials" value={data.credentialsConfigured?'Configured':'Not configured'}/>}<Row label="Provisioning" value={data.provisioningEnabled?'Enabled — approvals and safety checks still apply':'Not enabled'}/>{data.lastErrorCode&&/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(data.lastErrorCode)&&<Row label="Last validation error code" value={data.lastErrorCode}/>}<Row label="Status retrieved" value={date(data.observedAt)}/></dl><button className="btn secondary" disabled={query.isFetching} onClick={()=>void query.refetch()}>{query.isFetching?'Refreshing diagnostics…':'Refresh diagnostics'}</button></>;
 return <TechnicalDetails title="Connection diagnostics" summary={!selectedRecordId?'No AWS account selected':'Latest saved connection status'}>{body}</TechnicalDetails>;
}
function Row({label,value}:{label:string;value?:string}){return <div><dt>{label}</dt><dd>{value??'Not available'}</dd></div>}
function words(value?:string){return value?.toLowerCase().replaceAll('_',' ').replace(/^\w/,letter=>letter.toUpperCase())}
function date(value?:string){if(!value)return 'Not yet recorded';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Not available':parsed.toLocaleString()}
