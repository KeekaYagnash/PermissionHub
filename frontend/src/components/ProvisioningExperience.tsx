import {useEffect,useMemo,useState} from 'react';
import {Check,ChevronDown,Clock3,ExternalLink,LoaderCircle,RotateCcw,ShieldCheck,TriangleAlert,X} from 'lucide-react';
import {Button} from './ui';
import type {AuditEvent,ConnectionStatus,PermissionRequest,PlannedOperation} from '../types';

type StepState='success'|'running'|'warning'|'failed'|'pending';
type ProvisioningStep={title:string;state:StepState;description:string;details:{label:string;value:string;mono:boolean}[]};
type ProvisioningOperationResult={operation?:string;changed?:boolean;idempotent?:boolean;policyArn?:string;awsRequestId?:string;message?:string};
export type ProvisioningPayload={
 mode?:string;executed?:boolean;safe?:boolean;message?:string;targetAccount?:string;targetPrincipal?:string;
 plannedOperations?:PlannedOperation[];validationResults?:unknown[];results?:ProvisioningOperationResult[];
 executionTimeMs?:number;callerArn?:string;cloudTrail?:{eventTime?:string;requestId?:string;eventId?:string};
 accessAnalyzer?:unknown;awsResponses?:unknown;requestIds?:string[];
};
export type ProvisioningEnvelope={request?:{id?:string;status?:string;provisioningResult?:unknown};provisioning?:ProvisioningPayload;grants?:{policyArn?:string;grantedPolicyArn?:string;attachedAt?:string}[]};

interface Props{
 request:PermissionRequest;
 envelope?:ProvisioningEnvelope;
 connection?:ConnectionStatus;
 auditEvents?:AuditEvent[];
 inProgress?:boolean;
 failure?:{message:string;code?:string;correlationId?:string};
 canRevoke?:boolean;
 revokePending?:boolean;
 onRevoke?:()=>void;
}

export function ProvisioningExperience({request,envelope,connection,auditEvents=[],inProgress=false,failure,canRevoke=false,revokePending=false,onRevoke}:Props){
 const persisted=isRecord(request.provisioningResult)?request.provisioningResult as ProvisioningPayload:undefined;
 const provisioning=envelope?.provisioning??persisted;
 const visible=inProgress||Boolean(provisioning)||Boolean(failure);
 const executed=Boolean(provisioning?.executed);
 const [activeStep,setActiveStep]=useState(0);
 useEffect(()=>{if(!inProgress){setActiveStep(0);return}const timer=window.setInterval(()=>setActiveStep(value=>Math.min(value+1,7)),850);return()=>window.clearInterval(timer)},[inProgress]);
 const model=useMemo(()=>buildModel(request,envelope,provisioning,connection,auditEvents,failure),[request,envelope,provisioning,connection,auditEvents,failure]);
 if(!visible)return null;
 const stateFor=(index:number,preferred:StepState):StepState=>inProgress?(index<activeStep?'success':index===activeStep?'running':'pending'):failure&&index===model.failedStep?'failed':preferred;
 return <section className="provisioning-experience" aria-live="polite" aria-busy={inProgress}>
  <article className={`provisioning-summary ${failure?'failed':inProgress?'running':executed?'success':'warning'}`}>
   <div className="provisioning-summary-title">{failure?<X/>:inProgress?<LoaderCircle className="spin"/>:executed?<ShieldCheck/>:<TriangleAlert/>}<div><span>Provisioning status</span><h2>{failure?'Provisioning Failed':inProgress?'Provisioning in progress':executed?'Provisioning Successful':provisioning?.mode==='dry-run'?'Provisioning Dry-run Complete':'Provisioning Not Executed'}</h2><p>{failure?.message??(inProgress?'PermissionHub is applying the approved IAM change. Keep this page open.':executed?'AWS confirmed the approved permission change.':provisioning?.message??'No AWS permission change was made.')}</p></div></div>
   <dl>{model.summary.map(item=><div key={item.label}><dt>{item.label}</dt><dd title={item.value}>{item.value}</dd></div>)}</dl>
  </article>

  <article className="panel provisioning-timeline-panel">
   <div className="section-heading"><div><p className="eyebrow">AWS operation</p><h2>Provisioning Status</h2></div>{inProgress&&<span className="running-label"><LoaderCircle className="spin"/> Running</span>}</div>
   <ol className="provisioning-timeline">
    {model.steps.map((step,index)=><li key={step.title} className={`provision-step ${stateFor(index,step.state)}`} style={{'--step-index':index} as React.CSSProperties}>
     <span className="provision-step-marker" aria-label={stateLabel(stateFor(index,step.state))}>{stepIcon(stateFor(index,step.state))}</span>
     <div><div className="provision-step-title"><strong>{step.title}</strong><span>{stateLabel(stateFor(index,step.state))}</span></div><p>{step.description}</p>{step.details.length>0&&<dl>{step.details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd className={detail.mono?'mono':undefined}>{detail.value}</dd></div>)}</dl>}</div>
    </li>)}
   </ol>
  </article>

  {!inProgress&&!failure&&executed&&<>
   <PermissionChanges request={request} policyName={model.policyName}/>
   <article className="permission-granted-card">
    <div className="permission-granted-title"><Check/><div><p className="eyebrow">Access active</p><h2>Permission Successfully Granted</h2></div></div>
    <dl>{model.grantSummary.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    <div className="permission-granted-actions"><a className="btn btn-secondary" href={model.iamUrl} target="_blank" rel="noreferrer">View in IAM <ExternalLink size={14}/></a><a className="btn btn-secondary" href={model.cloudTrailUrl} target="_blank" rel="noreferrer">View CloudTrail <ExternalLink size={14}/></a>{canRevoke&&onRevoke&&<Button variant="danger" disabled={revokePending} onClick={onRevoke}><RotateCcw size={14}/>{revokePending?'Revoking…':'Revoke Permission'}</Button>}</div>
   </article>
  </>}

  <TechnicalDetails request={request} envelope={envelope} provisioning={provisioning} auditEvents={auditEvents}/>
 </section>
}

function PermissionChanges({request,policyName}:{request:PermissionRequest;policyName:string}){
 const before=request.preview?.before.managedPolicies??[],after=request.preview?.after.managedPolicies??[];
 const resulting=after.some(policy=>policy.policyName===policyName)?after:[...after,{policyName,policyArn:''}];
 const existing=new Set(before.map(policy=>policy.policyArn||policy.policyName));
 return <article className="panel permission-diff"><div className="section-heading"><div><p className="eyebrow">Effective attachment</p><h2>Permission Changes</h2></div></div><div className="permission-diff-grid"><div><h3>Before</h3>{before.length?before.map(policy=><PolicyRow key={policy.policyArn||policy.policyName} name={policy.policyName}/>):<p className="muted">No directly attached managed policies were reported.</p>}</div><div><h3>After</h3>{resulting.map(policy=>{const added=!existing.has(policy.policyArn||policy.policyName);return <PolicyRow key={`${policy.policyArn||policy.policyName}-${added}`} name={policy.policyName} added={added}/>})}</div></div></article>
}

function PolicyRow({name,added=false}:{name:string;added?:boolean}){return <p className={added?'policy-change added':'policy-change'}><Check size={14}/><span>{name}</span>{added&&<em>New</em>}</p>}

function TechnicalDetails({request,envelope,provisioning,auditEvents}:{request:PermissionRequest;envelope?:ProvisioningEnvelope;provisioning?:ProvisioningPayload;auditEvents:AuditEvent[]}){
 const generated=request.items.filter(item=>item.generatedPolicyDocument).map(item=>({policyName:item.generatedPolicyName,document:item.generatedPolicyDocument}));
 const requestIds=unique([...(provisioning?.requestIds??[]),...(provisioning?.results??[]).map(result=>result.awsRequestId),provisioning?.cloudTrail?.requestId]);
 const awsAuditResponses=auditEvents.filter(event=>event.requestId===request.id&&event.action.startsWith('IAM_POLICY_')).map(event=>({action:event.action,result:event.result,response:event.newState}));
 return <details className="panel technical-details"><summary><ChevronDown size={16}/><span>Technical Details</span><small>Troubleshooting data</small></summary><div className="technical-details-body"><TechnicalBlock title="Provision request" value={request}/><TechnicalBlock title="Generated Policy JSON" value={generated.length===1?generated[0]:generated}/><TechnicalBlock title="AWS Responses" value={provisioning?.awsResponses??(awsAuditResponses.length?awsAuditResponses:provisioning?.results??[])}/><TechnicalBlock title="Access Analyzer output" value={provisioning?.accessAnalyzer??provisioning?.validationResults??'Detailed findings were not included in this response.'}/><TechnicalBlock title="Raw Provision Result" value={envelope??provisioning}/><TechnicalBlock title="Request IDs" value={{awsRequestIds:requestIds,cloudTrailEventId:provisioning?.cloudTrail?.eventId??null}}/></div></details>
}

function TechnicalBlock({title,value}:{title:string;value:unknown}){return <section><h3>{title}</h3><pre>{JSON.stringify(value,null,2)}</pre></section>}

function buildModel(request:PermissionRequest,envelope:ProvisioningEnvelope|undefined,provisioning:ProvisioningPayload|undefined,connection:ConnectionStatus|undefined,auditEvents:AuditEvent[],failure:Props['failure']){
 const operations=provisioning?.plannedOperations??request.reviewCapabilities?.plannedOperations??[];
 const generated=request.items.find(item=>item.generatedPolicyDocument),statements=statementList(generated?.generatedPolicyDocument),actions=statements.flatMap(statement=>stringList(statement.Action));
 const creationAudit=auditEvents.find(event=>event.requestId===request.id&&event.action==='IAM_POLICY_CREATED'),attachmentAudit=auditEvents.find(event=>event.requestId===request.id&&event.action.includes('IAM_POLICY_ATTACHED'));
 const auditedCreation=operationResult(creationAudit?.newState),auditedAttachment=operationResult(attachmentAudit?.newState);
 const grant=envelope?.grants?.[0],attachResult=provisioning?.results?.find(result=>result.operation?.startsWith('Attach'))??auditedAttachment??provisioning?.results?.at(-1),createResult=provisioning?.results?.find(result=>result.operation==='CreatePolicy')??auditedCreation;
 const policyName=generated?.generatedPolicyName??request.items[0]?.policyName??operations.find(item=>item.policyName)?.policyName??'Approved policy';
 const policyArn=grant?.grantedPolicyArn??grant?.policyArn??createResult?.policyArn??request.items[0]?.policyArn??derivedPolicyArn(request,policyName);
 const requestId=attachResult?.awsRequestId??createResult?.awsRequestId??provisioning?.requestIds?.at(-1)??provisioning?.cloudTrail?.requestId??'Not returned';
 const completedAt=grant?.attachedAt??lastTimelineTime(request,'AWS operation completed')??lastTimelineTime(request,'Provisioned');
 const elapsed=executionTime(request,provisioning);
 const accountName=request.reviewContext?.accountName??'Selected AWS account',accountNumber=request.reviewContext?.awsAccountNumber??provisioning?.targetAccount??'Not returned',region=request.reviewContext?.region??connection?.region??'Not returned';
 const analyzerState:StepState=provisioning?.accessAnalyzer||provisioning?.validationResults?'success':'warning',cloudTrailState:StepState=provisioning?.cloudTrail?.eventId?'success':'pending';
 const reused=Boolean(createResult?.idempotent),created=Boolean(createResult?.changed),creationDescription=reused?'A matching PermissionHub policy already existed and was reused.':created?'AWS created the customer-managed policy.':'The customer-managed policy was created or a matching policy was safely reused.';
 const executed=Boolean(provisioning?.executed),baseState:StepState=failure||!executed?'pending':'success';
 const steps:ProvisioningStep[]=[
  {title:'Connected to AWS Account',state:baseState,description:'PermissionHub used the selected account connection.',details:[detail('Account name',accountName),detail('Account ID',accountNumber,true),detail('Region',region)]},
  {title:'Validated AWS Credentials',state:baseState,description:'STS GetCallerIdentity verified the active backend credentials.',details:[detail('Operation','STS GetCallerIdentity'),detail('Caller ARN',provisioning?.callerArn??connection?.principalArn??'Verified by backend; ARN not returned',true)]},
  {title:'Located Target Identity',state:baseState,description:`Confirmed the target ${request.targetType==='USER'?'IAM user':'IAM role'} exists.`,details:[detail('Target',request.targetName),detail('ARN',request.targetArn,true)]},
  {title:'Generated IAM Policy',state:baseState,description:'Built the approved customer-managed policy document.',details:[detail('Policy name',policyName),detail('Statements',String(statements.length)),detail('Actions',String(actions.length))]},
  {title:'AWS Access Analyzer Validation',state:failure?'pending':analyzerState,description:analyzerState==='warning'?'Validation passed the provisioning gate; detailed findings were not returned.':'Policy validation output is available in Technical Details.',details:[]},
  {title:reused?'Existing policy reused':created?'Created Customer Managed Policy':'Customer Managed Policy Ready',state:baseState,description:creationDescription,details:[detail('Policy ARN',policyArn,true),detail('AWS request ID',createResult?.awsRequestId??'Not returned',true)]},
  {title:'Attached Policy',state:baseState,description:attachResult?.idempotent?'The policy was already attached; no duplicate attachment was made.':`Attached to IAM ${request.targetType==='USER'?'User':'Role'}.`,details:[detail('Target name',request.targetName),detail('Target ARN',request.targetArn,true),detail('AWS request ID',attachResult?.awsRequestId??'Not returned',true)]},
  {title:'CloudTrail Event',state:failure?'pending':cloudTrailState,description:cloudTrailState==='success'?'CloudTrail event details were returned.':'CloudTrail event pending.',details:provisioning?.cloudTrail?[detail('Event time',formatDate(provisioning.cloudTrail.eventTime)),detail('Request ID',provisioning.cloudTrail.requestId??'Not returned',true),detail('Event ID',provisioning.cloudTrail.eventId??'Pending',true)]:[]},
  {title:executed?'Provisioning Complete':'Provisioning Not Executed',state:failure?'failed':executed?'success':'warning',description:failure?.message??(executed?'Provisioning completed successfully.':provisioning?.message??'No AWS changes were made.'),details:[detail('Completed',formatDate(completedAt)),detail('Execution time',elapsed)]},
 ];
 return {steps,failedStep:8,policyName,summary:[detail('Execution time',elapsed),detail('AWS account',`${accountName} · ${accountNumber}`),detail('Target identity',request.targetName),detail('Policy name',policyName),detail('AWS request ID',requestId)],grantSummary:[detail('AWS Account',accountName),detail('Target',request.targetName),detail('Policy',policyName),detail('Provisioned',formatDate(completedAt)),detail('Execution Time',elapsed)],iamUrl:iamConsoleUrl(request),cloudTrailUrl:`https://${region}.console.aws.amazon.com/cloudtrail/home?region=${encodeURIComponent(region)}#/events`};
}

function detail(label:string,value:string,mono=false){return {label,value,mono}}
function stateLabel(state:StepState){return state==='success'?'Success':state==='running'?'Running':state==='warning'?'Warning':state==='failed'?'Failed':'Pending'}
function stepIcon(state:StepState){return state==='success'?<Check/>:state==='running'?<LoaderCircle className="spin"/>:state==='warning'?<TriangleAlert/>:state==='failed'?<X/>:<Clock3/>}
function statementList(document?:Record<string,unknown>){if(!document)return[];const value=document.Statement;return (Array.isArray(value)?value:value?[value]:[]).filter(isRecord)}
function stringList(value:unknown){return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):typeof value==='string'?[value]:[]}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)}
function operationResult(value:unknown):ProvisioningOperationResult|undefined{if(!isRecord(value))return undefined;const nested=isRecord(value.result)?value.result:value;return nested as ProvisioningOperationResult}
function unique(values:(string|undefined)[]){return [...new Set(values.filter((value):value is string=>Boolean(value)))]}
function derivedPolicyArn(request:PermissionRequest,name:string){const account=request.reviewContext?.awsAccountNumber;return account?`arn:aws:iam::${account}:policy/permissionhub/${name}`:'Not returned'}
function lastTimelineTime(request:PermissionRequest,label:string){return [...request.timeline].reverse().find(item=>item.label.toLowerCase().includes(label.toLowerCase()))?.timestamp}
function executionTime(request:PermissionRequest,provisioning?:ProvisioningPayload){if(provisioning?.executionTimeMs!=null)return formatDuration(provisioning.executionTimeMs);const start=lastTimelineTime(request,'Provisioning started'),end=lastTimelineTime(request,'AWS operation completed');return start&&end?formatDuration(Math.max(0,Date.parse(end)-Date.parse(start))):'Not returned'}
function formatDuration(ms:number){return ms<1000?`${ms} ms`:`${(ms/1000).toFixed(1)} seconds`}
function formatDate(value?:string){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Pending'}
function iamConsoleUrl(request:PermissionRequest){const kind=request.targetType==='USER'?'users':'roles';return `https://console.aws.amazon.com/iam/home#/${kind}/details/${encodeURIComponent(request.targetName)}`}
