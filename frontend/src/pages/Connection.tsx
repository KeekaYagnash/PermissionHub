import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Connection(){
 const qc=useQueryClient();
 const {data}=useQuery({queryKey:['connection'],queryFn:api.connection});
 const test=useMutation({mutationFn:api.testConnection,onSuccess:()=>qc.invalidateQueries({queryKey:['connection']})});
 return <div className="page">
  <div className="page-header"><div><p className="eyebrow">Connection</p><h1>Backend AWS connection</h1><p>The frontend never asks for access keys. The backend uses the AWS SDK default credential provider chain and verifies the account with STS GetCallerIdentity.</p></div><button className="primary-action" onClick={()=>test.mutate()}>{test.isPending?'Testing':'Test AWS connection'}</button></div>
  <section className="overview-grid">
   <div className="panel wide">
    <div className="panel-title">Current status</div>
    <dl>
     <div><dt>Mode</dt><dd>{data?.mode}</dd></div><div><dt>Connected</dt><dd>{data?.connected?'Yes':'No'}</dd></div><div><dt>Account ID</dt><dd>{data?.accountId}</dd></div><div><dt>Principal ARN</dt><dd className="mono">{data?.principalArn}</dd></div><div><dt>Region</dt><dd>{data?.region}</dd></div><div><dt>Credential source</dt><dd>{data?.credentialSource}</dd></div><div><dt>Last checked</dt><dd>{data?.lastChecked?fmt(data.lastChecked):'Never'}</dd></div>
    </dl>
    {data?.message&&<p className="warning">{data.message}</p>}
   </div>
   <div className="panel">
    <div className="panel-title">Local setup</div>
    <pre>{`AWS_PROFILE=permissionhub-dev
AWS_REGION=af-south-1
PROVISIONING_MODE=MOCK`}</pre>
    <p className="muted">Credentials must stay outside this repository in your AWS CLI profile, environment, or temporary credential source.</p>
   </div>
   <div className="panel">
    <div className="panel-title">Live provisioning guard</div>
    <p>LIVE mode requires server-side `ENABLE_LIVE_PROVISIONING=true` and `PROVISIONING_CONFIRMATION=I_UNDERSTAND_THIS_CHANGES_AWS`.</p>
    <p className="warning">Use a dedicated sandbox account. Do not test against production.</p>
   </div>
  </section>
 </div>;
}
function fmt(value:string){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
