import { useEffect,useMemo,useRef,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Link,useSearchParams } from 'react-router-dom';
import { AlertTriangle,Check,ChevronRight,Clock,FileJson,FileKey2,KeyRound,RefreshCw,Search,ShieldCheck,UserRound,UsersRound,X } from 'lucide-react';
import { api } from '../lib/api';
import { actionCatalogue,calculateExpiry,fuzzyIdentities,fuzzyPolicies,fuzzyResources,riskForPolicies,validateApprovalDeadline,validateArnList,validatePolicyJson,type AccessDuration,type RequestPriority } from '../lib/iam';
import { canOpenWizardStep, shouldShowScheduledStartInput, unlockNextWizardStep } from '../lib/wizard';
import type { AwsResource,IamIdentity,IamPolicySummary,TargetType } from '../types';

const steps=['Target type','Target identity','Permissions','Scope access','Request details','Review'];
const durationOptions:AccessDuration[]=['1 hour','8 hours','1 day','7 days','30 days','Custom','Permanent'];
const priorityOptions:{value:RequestPriority;hint:string}[]=[
 {value:'Normal',hint:'Standard planned work'},
 {value:'High',hint:'Time-sensitive project or incident'},
 {value:'Urgent',hint:'Active incident or outage'}
];
const defaultPolicy=JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['s3:ListBucket'],Resource:['arn:aws:s3:::example-bucket']}]},null,2);

export default function NewRequest(){
 const [params]=useSearchParams(),qc=useQueryClient();
 const [step,setStep]=useState(1),[maxUnlocked,setMaxUnlocked]=useState(1),[toast,setToast]=useState<string>(),[submitted,setSubmitted]=useState<any>();
 const panelRef=useRef<HTMLElement>(null);
 const [targetType,setTargetType]=useState<TargetType>(),[target,setTarget]=useState<IamIdentity>();
 const [identitySearch,setIdentitySearch]=useState(''),[includeServiceLinked,setIncludeServiceLinked]=useState(false);
 const [permissionTab,setPermissionTab]=useState<'AWS_MANAGED'|'EXISTING'|'CUSTOM'>('AWS_MANAGED');
 const [policySearch,setPolicySearch]=useState(''),[serviceFilter,setServiceFilter]=useState(''),[accessFilter,setAccessFilter]=useState(''),[riskFilter,setRiskFilter]=useState('');
 const [selectedPolicies,setSelectedPolicies]=useState<IamPolicySummary[]>([]),[selectedExisting,setSelectedExisting]=useState<string>(),[selectedActions,setSelectedActions]=useState<string[]>(['s3:ListBucket']);
 const [customJson,setCustomJson]=useState(defaultPolicy),[jsonMode,setJsonMode]=useState<'visual'|'json'>('visual'),[validatedPolicy,setValidatedPolicy]=useState(false);
 const [scopeType,setScopeType]=useState<'ALL'|'RESOURCE'|'ARN'>('ALL'),[resourceSearch,setResourceSearch]=useState(''),[resourceService,setResourceService]=useState(''),[resourceRegion,setResourceRegion]=useState(''),[selectedResources,setSelectedResources]=useState<AwsResource[]>([]),[manualArn,setManualArn]=useState('');
 const requestedAt=useMemo(()=>new Date().toISOString(),[]);
 const defaultApprovalBy=useMemo(()=>localDateTime(new Date(Date.now()+24*3600000)),[]);
 const [details,setDetails]=useState({title:'',approvalRequiredBy:defaultApprovalBy,duration:'7 days' as AccessDuration,accessStartMode:'after-approval' as 'after-approval'|'scheduled',scheduledStart:'',customExpiry:'',priority:'Normal' as RequestPriority,approver:'',justification:'',notes:'',permanentAck:false});
 const users=useQuery({queryKey:['users'],queryFn:()=>api.users(),enabled:targetType==='USER'});
 const roles=useQuery({queryKey:['roles',includeServiceLinked],queryFn:()=>api.roles('',includeServiceLinked),enabled:targetType==='ROLE'});
 const policies=useQuery({queryKey:['policies','request'],queryFn:()=>api.policies({pageSize:100})});
 const awsResources=useQuery({queryKey:['resources'],queryFn:api.resources});
 const approvers=useQuery({queryKey:['approvers'],queryFn:api.approvers});
 const policyValidation=useMutation({mutationFn:(document:Record<string,unknown>)=>api.validatePolicy(document),onSuccess:()=>{setValidatedPolicy(true);setToast('Policy validated. Access Analyzer findings are shown in review when available.')}});
 const create=useMutation({mutationFn:api.createRequest,onSuccess:async request=>{const submittedRequest=await api.submitRequest(request.id);setSubmitted(submittedRequest);setToast(`Request ${submittedRequest.id} submitted for approval.`);await Promise.all([qc.invalidateQueries({queryKey:['requests']}),qc.invalidateQueries({queryKey:['activity']})])}});
 const preselected=params.get('policyArn');

 useEffect(()=>{const policy=(policies.data?.data??[]).find(item=>item.arn===preselected);if(policy&&!selectedPolicies.some(item=>item.arn===policy.arn))setSelectedPolicies([policy])},[policies.data,preselected,selectedPolicies]);
 useEffect(()=>{setTarget(undefined);setIdentitySearch('');if(targetType)setMaxUnlocked(current=>Math.min(current,2))},[targetType]);
 useEffect(()=>{if(step>2&&!target)setMaxUnlocked(current=>Math.min(current,2))},[target,step]);
 useEffect(()=>{panelRef.current?.scrollIntoView({behavior:'smooth',block:'start'});window.setTimeout(()=>panelRef.current?.querySelector('h2')?.focus(),80)},[step]);
 useEffect(()=>{if(!details.approver&&approvers.data?.[0])setDetails(current=>({...current,approver:approvers.data[0].name}))},[approvers.data,details.approver]);
 useEffect(()=>{if(jsonMode==='visual')setCustomJson(JSON.stringify(buildVisualPolicy(),null,2))},[selectedActions,scopeType,selectedResources,manualArn,jsonMode]);

 const identities=targetType==='USER'?users.data?.data??[]:targetType==='ROLE'?roles.data?.data??[]:[];
 const identityError=targetType==='USER'?users.error:targetType==='ROLE'?roles.error:undefined;
 const identityLoading=targetType==='USER'?users.isLoading:targetType==='ROLE'?roles.isLoading:false;
 const filteredIdentities=useMemo(()=>fuzzyIdentities(identities,identitySearch,includeServiceLinked),[identities,identitySearch,includeServiceLinked]);
 const allPolicies=policies.data?.data??[];
 const existingPolicyArns=new Set(target?.attachedPolicies.map(policy=>policy.policyArn)??[]);
 const filteredPolicies=useMemo(()=>{
  let list=fuzzyPolicies(allPolicies,policySearch).filter(policy=>policy.type==='AWS_MANAGED');
  if(serviceFilter)list=list.filter(policy=>policy.services.includes(serviceFilter));
  if(accessFilter)list=list.filter(policy=>policy.accessLevels.includes(accessFilter));
  if(riskFilter)list=list.filter(policy=>policy.risk.level===riskFilter);
  return list;
 },[allPolicies,policySearch,serviceFilter,accessFilter,riskFilter]);
 const serviceOptions=[...new Set(allPolicies.flatMap(policy=>policy.services))].filter(Boolean);
 const accessOptions=[...new Set(allPolicies.flatMap(policy=>policy.accessLevels))].filter(Boolean);
 const relevantServices=selectedPolicies.length?selectedPolicies.flatMap(policy=>policy.services):selectedActions.map(action=>action.split(':')[0]??'');
 const filteredResources=useMemo(()=>{
  let list=fuzzyResources(awsResources.data??[],resourceSearch);
  if(resourceService)list=list.filter(resource=>resource.service===resourceService);
  if(resourceRegion)list=list.filter(resource=>resource.region===resourceRegion);
  if(relevantServices.includes('s3'))list.sort((a,b)=>(a.service==='S3'?-1:0)-(b.service==='S3'?-1:0));
  if(relevantServices.includes('lambda'))list.sort((a,b)=>(a.service==='Lambda'?-1:0)-(b.service==='Lambda'?-1:0));
  if(relevantServices.includes('rds'))list.sort((a,b)=>(a.service==='RDS'?-1:0)-(b.service==='RDS'?-1:0));
  return list;
 },[awsResources.data,resourceSearch,resourceService,resourceRegion,relevantServices.join('|')]);
 const policyJsonValidation=validatePolicyJson(customJson);
 const arnValidation=validateArnList(manualArn,relevantServices.filter(Boolean));
 const accessStartIso=details.accessStartMode==='scheduled'&&details.scheduledStart?new Date(details.scheduledStart).toISOString():new Date().toISOString();
 const expiresAt=calculateExpiry(details.duration,accessStartIso,details.customExpiry);
 const validation=validateAll();
 const canNext=step<6?stepValid(step):validation.blocking.length===0;

 function stepValid(n:number){
  if(n===1)return Boolean(targetType);
  if(n===2)return Boolean(target);
  if(n===3)return selectedPermissionItems().length>0&&(!customModeActive()||policyJsonValidation.valid);
  if(n===4)return scopeType==='ALL'||(scopeType==='RESOURCE'&&selectedResources.length>0)||(scopeType==='ARN'&&arnValidation.arns.length>0&&arnValidation.errors.length===0);
  if(n===5)return fieldErrors().length===0;
  return true;
 }
 function selectedPermissionItems(){
  if(permissionTab==='AWS_MANAGED')return selectedPolicies.map(policy=>({mode:'MANAGED_POLICY' as const,policyName:policy.policyName,policyArn:policy.arn}));
  if(permissionTab==='EXISTING'&&selectedExisting){const policy=target?.attachedPolicies.find(item=>item.policyArn===selectedExisting);return [{mode:'SPECIFIC_ACTIONS' as const,policyName:`Clone ${policy?.policyName??'attached policy'}`,actions:selectedActions,generatedPolicyDocument:buildVisualPolicy()}]}
  if(permissionTab==='CUSTOM'&&policyJsonValidation.document)return [{mode:'SPECIFIC_ACTIONS' as const,actions:selectedActions,generatedPolicyDocument:policyJsonValidation.document as Record<string,unknown>}];
  return [];
 }
 function customModeActive(){return permissionTab==='CUSTOM'||permissionTab==='EXISTING'}
 function buildVisualPolicy(){return {Version:'2012-10-17',Statement:[{Effect:'Allow',Action:selectedActions,Resource:scopeType==='ARN'?arnValidation.arns:scopeType==='RESOURCE'?selectedResources.map(resource=>resource.arn):'*',...(expiresAt&&customModeActive()?{Condition:{DateLessThan:{'aws:CurrentTime':expiresAt}}}:{})}]}}
 function fieldErrors(){const errors:string[]=[];if(details.title.trim().length<5)errors.push('Request title must be at least 5 characters.');const approvalError=validateApprovalDeadline(details.approvalRequiredBy);if(approvalError)errors.push(approvalError);if(details.accessStartMode==='scheduled'&&!details.scheduledStart)errors.push('Scheduled start is required when access starts at a scheduled time.');if(details.scheduledStart&&Date.parse(details.scheduledStart)<Date.parse(requestedAt))errors.push('Scheduled start cannot be earlier than the requested time.');if(details.duration==='Custom'&&!details.customExpiry)errors.push('Custom duration requires an access expiry date and time.');if(details.duration==='Permanent'&&!details.permanentAck)errors.push('Permanent access requires explicit acknowledgement.');if(!details.approver)errors.push('Approver is required.');if(details.justification.trim().length<20)errors.push('Business justification must explain the task and need for access.');return errors}
 function validateAll(){const blocking:string[]=[];if(!target)blocking.push('Select an IAM user or role.');if(!selectedPermissionItems().length)blocking.push('Select or build the permissions to request.');if(customModeActive()&&!policyJsonValidation.valid)blocking.push(...policyJsonValidation.errors);if(scopeType==='ARN'&&arnValidation.errors.length)blocking.push(...arnValidation.errors);blocking.push(...fieldErrors());const warnings=[...policyJsonValidation.warnings];if(scopeType==='ALL'&&(riskForPolicies(selectedPolicies)==='High'||riskForPolicies(selectedPolicies)==='Critical'||selectedActions.some(action=>action.endsWith(':*'))))warnings.push('All applicable resources combined with high-risk or wildcard access needs careful review.');if(selectedPolicies.some(policy=>existingPolicyArns.has(policy.arn)))warnings.push('One or more requested policies are already attached to this identity.');return {blocking,warnings}}
 function submit(){
  const payload={title:details.title,targetType:targetType!,targetName:target!.name,targetArn:target!.arn,items:selectedPermissionItems(),scope:{type:scopeType,resources:selectedResources.map(resource=>resource.name),arn:manualArn||undefined},duration:details.duration,startDate:accessStartIso,expiryDate:expiresAt,priority:details.priority,approver:details.approver,justification:details.justification,notes:details.notes||undefined};
  create.mutate(payload);
 }
 function goBack(){setStep(current=>Math.max(1,current-1))}
 function goNext(){if(!canNext)return;const unlocked=unlockNextWizardStep(step,maxUnlocked,steps.length);setMaxUnlocked(unlocked.nextMaxUnlocked);setStep(unlocked.nextStep)}
 function goToStep(next:number){if(canOpenWizardStep(next,maxUnlocked))setStep(next)}
 function toggleResource(resource:AwsResource){setSelectedResources(current=>current.some(item=>item.arn===resource.arn)?current.filter(item=>item.arn!==resource.arn):[...current,resource])}
 function togglePolicy(policy:IamPolicySummary){setSelectedPolicies(current=>current.some(item=>item.arn===policy.arn)?current.filter(item=>item.arn!==policy.arn):[...current,policy])}
 function toggleAction(action:string){setSelectedActions(current=>current.includes(action)?current.filter(item=>item!==action):[...current,action])}

 if(submitted)return <div className="page success-page" aria-live="polite"><div className="panel success-panel"><ShieldCheck size={30}/><h1>Request submitted</h1><p>{submitted.id} is now waiting for approval.</p><dl><div><dt>Target</dt><dd>{submitted.targetType} · {submitted.targetName}</dd></div><div><dt>Requested change</dt><dd>{submitted.items.map((item:any)=>item.policyName??item.actions?.join(', ')).join(', ')}</dd></div><div><dt>Status</dt><dd>{submitted.status}</dd></div><div><dt>Submitted</dt><dd>{formatDate(submitted.submittedAt)}</dd></div></dl><Link className="primary-action" to={`/requests/${submitted.id}`}>View request <ChevronRight size={16}/></Link></div></div>;

 return <div className="page request-workflow">
  <div className="page-header"><div><p className="eyebrow">New request</p><h1>Request an IAM permission change</h1><p>Select the identity, permissions, scope, timing and justification. AWS changes are not made until the request is approved and provisioned.</p></div></div>
  {toast&&<div className="toast" role="status"><Check size={15}/>{toast}<button onClick={()=>setToast(undefined)} aria-label="Dismiss notification"><X size={14}/></button></div>}
  <div className="wizard">
   <div className="mobile-step-header" aria-live="polite"><span>Step {step} of {steps.length}</span><strong>{steps[step-1]}</strong><i style={{width:`${(step/steps.length)*100}%`}}/></div>
   <aside className="step-nav" aria-label="Request steps"><ol>{steps.map((label,index)=>{const n=index+1,done=n<maxUnlocked&&stepValid(n),available=canOpenWizardStep(n,maxUnlocked);return <li key={label}><button aria-current={step===n?'step':undefined} className={`${step===n?'active':''} ${done?'done':''} ${!available?'disabled':''}`} onClick={()=>goToStep(n)} disabled={!available}><span>{done?<Check size={14}/>:n}</span><strong>{label}</strong></button></li>})}</ol></aside>
   <section className="panel request-panel" ref={panelRef}>
    {step===1&&<StepSection title="Choose target type" help="Pick the IAM principal that will receive the requested access.">
     <div className="choice-grid" role="radiogroup" aria-label="Target type">
      <SelectableCard selected={targetType==='USER'} icon={<UserRound/>} title="IAM user" help="Attach permissions directly to a named IAM user." onClick={()=>setTargetType('USER')}/>
      <SelectableCard selected={targetType==='ROLE'} icon={<UsersRound/>} title="IAM role" help="Attach permissions to an assumable IAM role." onClick={()=>setTargetType('ROLE')}/>
     </div>
    </StepSection>}

    {step===2&&<StepSection title={`Choose ${targetType==='USER'?'IAM user':'IAM role'}`} help="Search already loaded identities. Role listing uses ListRoles pagination and hides service-linked roles by default.">
     <Toolbar><label className="search-field"><Search size={15}/><input value={identitySearch} onChange={event=>setIdentitySearch(event.target.value)} placeholder="Search name, ARN, path or description"/></label>{targetType==='ROLE'&&<label className="check-row"><input type="checkbox" checked={includeServiceLinked} onChange={event=>setIncludeServiceLinked(event.target.checked)}/>Include service-linked roles</label>}<button onClick={()=>targetType==='USER'?users.refetch():roles.refetch()}><RefreshCw size={14}/>Retry</button></Toolbar>
     <p className="list-count">{filteredIdentities.length} {targetType==='USER'?'users':'roles'} loaded{target&&<button onClick={()=>setTarget(undefined)}>Clear selection</button>}</p>
     {identityLoading&&<SkeletonRows/>}
     {identityError&&<ErrorPanel title="Could not load IAM identities" error={identityError}/>}
     {!identityLoading&&!identityError&&!filteredIdentities.length&&<EmptyState title="No identities found" body="Try a different search or include service-linked roles."/>}
     <div className="identity-table" role="table" aria-label={`${targetType==='USER'?'IAM user':'IAM role'} selection`}><div className="identity-table-head" role="row"><span>Selection</span><span>Name</span><span>ARN</span><span>Path</span><span>Created</span><span>{targetType==='USER'?'Console':'Max session'}</span><span>Policies</span></div>{filteredIdentities.map(identity=><button key={identity.arn} className={target?.arn===identity.arn?'selected':''} onClick={()=>setTarget(identity)} aria-pressed={target?.arn===identity.arn} role="row"><span className={target?.arn===identity.arn?'select-check checked':'select-check'}>{target?.arn===identity.arn&&<Check size={14}/>}</span><strong>{identity.name}{identity.description&&<small>{identity.description}</small>}</strong><code title={identity.arn}>{identity.arn}</code><span>{identity.path}</span><span>{formatDate(identity.createdAt)}</span><span>{identity.type==='USER'?`Console: ${identity.passwordEnabled===undefined?'unknown':identity.passwordEnabled?'enabled':'disabled'}`:`${Math.round((identity.maxSessionDuration??0)/60)||'unknown'} min`}</span><span>{identity.attachedPolicies.length} attached</span></button>)}</div>
    </StepSection>}

    {step===3&&<StepSection title="Choose permissions" help="Request an AWS-managed policy, modify existing access by creating a customer-managed proposal, or build a custom policy.">
     <div className="tabs permission-tabs">{(['AWS_MANAGED','EXISTING','CUSTOM'] as const).map(tab=><button key={tab} className={permissionTab===tab?'active':''} onClick={()=>setPermissionTab(tab)}>{tab==='AWS_MANAGED'?'AWS managed policy':tab==='EXISTING'?'Existing attached policy':'Custom policy'}</button>)}</div>
     {permissionTab==='AWS_MANAGED'&&<>
      <Toolbar sticky><label className="search-field"><Search size={15}/><input value={policySearch} onChange={event=>setPolicySearch(event.target.value)} placeholder="Search s3 read, lambda execute, cloud wach"/></label><select value={serviceFilter} onChange={event=>setServiceFilter(event.target.value)}><option value="">All services</option>{serviceOptions.map(item=><option key={item}>{item}</option>)}</select><select value={accessFilter} onChange={event=>setAccessFilter(event.target.value)}><option value="">All access</option>{accessOptions.map(item=><option key={item}>{item}</option>)}</select><select value={riskFilter} onChange={event=>setRiskFilter(event.target.value)}><option value="">All risk</option>{['Low','Moderate','High','Critical'].map(item=><option key={item}>{item}</option>)}</select></Toolbar>
      <p className="list-count">{selectedPolicies.length} selected</p>
      <div className="policy-list">{filteredPolicies.slice(0,80).map(policy=><label key={policy.arn} className={selectedPolicies.some(item=>item.arn===policy.arn)?'selected':''}><input type="checkbox" checked={selectedPolicies.some(item=>item.arn===policy.arn)} onChange={()=>togglePolicy(policy)}/><span><strong>{policy.policyName}</strong><small>{policy.description}</small><code>{policy.arn}</code></span><em className={`risk ${policy.risk.level.toLowerCase()}`} title={policy.risk.flags.join(', ')||'No broad risk indicators detected'}>{policy.risk.level}</em>{existingPolicyArns.has(policy.arn)&&<b>Already attached</b>}</label>)}</div>
      <SelectedSummary title="Selected policies" items={selectedPolicies.map(policy=>policy.policyName)}/>
     </>}
     {permissionTab==='EXISTING'&&<div className="existing-policy-flow"><p className="warning">AWS-managed policies are immutable. To change one, PermissionHub creates a proposed customer-managed policy based on the selected access instead of modifying AWS-managed policy content.</p><div className="policy-list">{target?.attachedPolicies.map(policy=><label key={policy.policyArn} className={selectedExisting===policy.policyArn?'selected':''}><input type="radio" checked={selectedExisting===policy.policyArn} onChange={()=>setSelectedExisting(policy.policyArn)}/><span><strong>{policy.policyName}</strong><code>{policy.policyArn}</code><small>Managed policy · clone to customer-managed proposal</small></span></label>)}{target?.inlinePolicies.map(policy=><label key={policy} className={selectedExisting===policy?'selected':''}><input type="radio" checked={selectedExisting===policy} onChange={()=>setSelectedExisting(policy)}/><span><strong>{policy}</strong><small>Inline policy · proposed replacement document</small></span></label>)}</div><ActionPicker selected={selectedActions} onToggle={toggleAction}/></div>}
     {permissionTab==='CUSTOM'&&<div className="custom-policy"><div className="tabs"><button className={jsonMode==='visual'?'active':''} onClick={()=>setJsonMode('visual')}>Visual editor</button><button className={jsonMode==='json'?'active':''} onClick={()=>setJsonMode('json')}>JSON editor</button></div>{jsonMode==='visual'&&<ActionPicker selected={selectedActions} onToggle={toggleAction}/>}<label className="field full"><span>Policy JSON</span><textarea className="json-editor" value={customJson} onChange={event=>{setJsonMode('json');setValidatedPolicy(false);setCustomJson(event.target.value)}} spellCheck={false}/></label><div className="button-row"><button onClick={()=>setCustomJson(JSON.stringify(policyJsonValidation.document??JSON.parse(defaultPolicy),null,2))}><FileJson size={14}/>Format</button><button onClick={()=>navigator.clipboard?.writeText(customJson)}>Copy</button><button onClick={()=>{setCustomJson(defaultPolicy);setValidatedPolicy(false)}}>Reset</button><button onClick={()=>policyJsonValidation.document&&policyValidation.mutate(policyJsonValidation.document as Record<string,unknown>)} disabled={!policyJsonValidation.valid}>Validate with backend</button></div><ValidationList errors={policyJsonValidation.errors} warnings={[...policyJsonValidation.warnings,...((policyValidation.data?.findings??[]).map((finding:any)=>finding.message??finding.issueCode) as string[])]}/></div>}
    </StepSection>}

    {step===4&&<StepSection title="Scope access" help="Select all applicable resources, choose discovered AWS resources, or enter one or more specific ARNs.">
     <div className="choice-grid compact"><SelectableCard selected={scopeType==='ALL'} icon={<ShieldCheck/>} title="All applicable resources" help="Use * or policy-defined resource scope." onClick={()=>setScopeType('ALL')}/><SelectableCard selected={scopeType==='RESOURCE'} icon={<FileKey2/>} title="Specific AWS resource" help="Choose discovered S3, RDS or Lambda resources." onClick={()=>setScopeType('RESOURCE')}/><SelectableCard selected={scopeType==='ARN'} icon={<KeyRound/>} title="Specific ARN" help="Enter one or more ARNs when discovery cannot identify the target." onClick={()=>setScopeType('ARN')}/></div>
     {scopeType==='ALL'&&validation.warnings.some(item=>item.includes('All applicable'))&&<p className="warning">All applicable resources is broad for the selected permissions. Review the risk indicators before submitting.</p>}
     {scopeType==='RESOURCE'&&<><Toolbar sticky><label className="search-field"><Search size={15}/><input value={resourceSearch} onChange={event=>setResourceSearch(event.target.value)} placeholder="Search resource name, ARN, region or tag"/></label><select value={resourceService} onChange={event=>setResourceService(event.target.value)}><option value="">All services</option>{['S3','RDS','Lambda'].map(item=><option key={item}>{item}</option>)}</select><select value={resourceRegion} onChange={event=>setResourceRegion(event.target.value)}><option value="">All regions</option>{[...new Set((awsResources.data??[]).map(resource=>resource.region))].map(item=><option key={item}>{item}</option>)}</select></Toolbar><SelectedSummary title="Selected resources" items={selectedResources.map(resource=>resource.name)}/><div className="resource-grid">{filteredResources.map(resource=><label key={resource.arn} className={selectedResources.some(item=>item.arn===resource.arn)?'selected':''}><input type="checkbox" checked={selectedResources.some(item=>item.arn===resource.arn)} onChange={()=>toggleResource(resource)}/><span><strong>{resource.name}</strong><small>{resource.service} · {resource.region}</small><code>{resource.arn}</code><small>{Object.entries(resource.tags).map(([k,v])=>`${k}: ${v}`).join(' · ')}</small></span></label>)}</div></>}
     {scopeType==='ARN'&&<label className="field full"><span>Specific ARN values</span><textarea value={manualArn} onChange={event=>setManualArn(event.target.value)} placeholder="arn:aws:s3:::finance-reports-dev&#10;arn:aws:s3:::finance-reports-dev/*"/>{arnValidation.errors.map(error=><small className="field-error" key={error}>{error}</small>)}</label>}
    </StepSection>}

    {step===5&&<StepSection title="Request details" help="Timing controls how long approved access remains active. Managed-policy attachments are expired by backend grant cleanup metadata, not by editing AWS-managed policies.">
     <div className="form-grid labeled"><Field label="Request title" help="Example: S3 read access for finance reconciliation" error={details.title&&details.title.length<5?'Use at least 5 characters.':undefined}><input value={details.title} onChange={event=>setDetails({...details,title:event.target.value})} placeholder="S3 read access for finance reconciliation"/></Field><Field label="Requested on" help="Recorded automatically in ISO format."><input className="readonly-input" value={formatDate(requestedAt)} readOnly/></Field><Field label="Approval required by" error={validateApprovalDeadline(details.approvalRequiredBy)}><input type="datetime-local" min={localDateTime(new Date())} value={details.approvalRequiredBy} onChange={event=>setDetails({...details,approvalRequiredBy:event.target.value})}/></Field><Field label="Access duration" help="Controls how long approved access remains active."><select value={details.duration} onChange={event=>setDetails({...details,duration:event.target.value as AccessDuration})}>{durationOptions.map(item=><option key={item}>{item}</option>)}</select></Field><Field label="Access starts" help="Default is immediately after approval."><select value={details.accessStartMode} onChange={event=>setDetails({...details,accessStartMode:event.target.value as any})}><option value="after-approval">Immediately after approval</option><option value="scheduled">At a scheduled date and time</option></select></Field>{shouldShowScheduledStartInput(details.accessStartMode)?<Field label="Scheduled start" error={details.scheduledStart&&Date.parse(details.scheduledStart)<Date.parse(requestedAt)?'Scheduled start cannot be earlier than the requested time.':undefined}><input type="datetime-local" min={localDateTime(new Date(requestedAt))} value={details.scheduledStart} onChange={event=>setDetails({...details,scheduledStart:event.target.value})}/></Field>:<div className="readonly-field"><span>Scheduled start</span><div>Starts immediately after approval.</div></div>}{details.duration==='Custom'&&<Field label="Access expires" error={!details.customExpiry?'Custom duration requires an expiry.':undefined}><input type="datetime-local" value={details.customExpiry} onChange={event=>setDetails({...details,customExpiry:event.target.value})}/></Field>}<Field label="Calculated expiry"><input className="readonly-input" value={expiresAt?`${formatDate(expiresAt)} — ${details.duration} after access begins.`:'No automatic expiry'} readOnly/></Field><Field label="Priority"><select value={details.priority} onChange={event=>setDetails({...details,priority:event.target.value as RequestPriority})}>{priorityOptions.map(item=><option key={item.value} value={item.value}>{item.value} - {item.hint}</option>)}</select></Field><Field label="Approver" error={!details.approver?'Choose an approver.':undefined}>{approvers.data?.length?<select value={details.approver} onChange={event=>setDetails({...details,approver:event.target.value})}><option value="">Select approver</option>{(approvers.data??[]).map((approver:any)=><option key={approver.id} value={approver.name}>{approver.name}</option>)}</select>:<div className="warning">No approvers are configured in the application data.</div>}</Field><Field label="Business justification" help={`Explain the task, project or incident and why these permissions are necessary. ${details.justification.length} characters used.`} error={details.justification&&details.justification.length<20?'Provide a stronger justification.':undefined} full><textarea value={details.justification} onChange={event=>setDetails({...details,justification:event.target.value})}/></Field><Field label="Optional notes" full><textarea value={details.notes} onChange={event=>setDetails({...details,notes:event.target.value})}/></Field></div>{details.duration==='Permanent'&&<label className="warning ack"><input type="checkbox" checked={details.permanentAck} onChange={event=>setDetails({...details,permanentAck:event.target.checked})}/>I acknowledge permanent access has no automatic expiry and requires stronger business justification.</label>}
    </StepSection>}

    {step===6&&<StepSection title="Review permission request" help="Resolve blocking validation issues before submission. The proposed AWS operation will run only after approval and provisioning.">
     <div className="readiness"><span className={validation.blocking.length?'status rejected':'status approved'}>{validation.blocking.length?'Not ready':'Ready to submit'}</span>{validation.blocking.length>0&&<ValidationList errors={validation.blocking} warnings={validation.warnings}/>}</div>
     <div className="review-grid"><SummaryCard title="Target"><p>{target?.type} · {target?.name}</p><code>{target?.arn}</code><small>Region context: backend AWS connection</small></SummaryCard><SummaryCard title="Current access"><p>{target?.attachedPolicies.map(policy=>policy.policyName).join(', ')||'No direct managed policies'}</p><small>Inline: {target?.inlinePolicies.join(', ')||'none'}</small><small>Boundary: {target?.permissionBoundary??'Unavailable'}</small></SummaryCard><SummaryCard title="Requested change"><p>{permissionTab==='AWS_MANAGED'?'Add managed policy':permissionTab==='EXISTING'?'Create customer-managed proposal':'Create policy'}</p><small>{targetType==='USER'?'AttachUserPolicy':'AttachRolePolicy'}</small></SummaryCard><SummaryCard title="Permissions"><p>{selectedPolicies.map(policy=>policy.policyName).join(', ')||selectedActions.join(', ')}</p><span className={`risk ${riskForPolicies(selectedPolicies).toLowerCase()}`}>{riskForPolicies(selectedPolicies)}</span></SummaryCard><SummaryCard title="Resource scope"><p>{scopeType==='ALL'?'All applicable resources':selectedResources.map(resource=>resource.name).join(', ')||arnValidation.arns.join(', ')}</p></SummaryCard><SummaryCard title="Timing"><p>{details.duration}</p><small>Requested: {formatDate(requestedAt)}</small><small>Approval by: {formatDate(details.approvalRequiredBy)}</small><small>Expiry: {expiresAt?formatDate(expiresAt):'Permanent'}</small></SummaryCard><SummaryCard title="Business details"><p>{details.title}</p><small>{details.priority} · {details.approver}</small><p>{details.justification}</p></SummaryCard></div>
     {customModeActive()&&<div className="diff-panel"><h3>Proposed policy document</h3><pre>{JSON.stringify(permissionTab==='CUSTOM'?policyJsonValidation.document:buildVisualPolicy(),null,2)}</pre></div>}
     {create.isError&&<p className="warning">{readError(create.error)}</p>}<button className="primary-action submit-button" onClick={submit} disabled={create.isPending||validation.blocking.length>0}>{create.isPending?'Submitting request':'Submit request'}</button>
    </StepSection>}

    <footer className="wizard-actions"><button onClick={goBack} disabled={step===1}>Back</button>{step<6&&<button onClick={goNext} disabled={!canNext}>Continue</button>}</footer>
   </section>
  </div>
 </div>;
}

function StepSection({title,help,children}:{title:string;help:string;children:React.ReactNode}){return <div className="step-section"><h2 tabIndex={-1}>{title}</h2><p>{help}</p>{children}</div>}
function Toolbar({children,sticky=false}:{children:React.ReactNode;sticky?:boolean}){return <div className={sticky?'toolbar sticky':'toolbar'}>{children}</div>}
function SelectableCard({selected,icon,title,help,onClick}:{selected:boolean;icon:React.ReactNode;title:string;help:string;onClick:()=>void}){return <button type="button" className={selected?'select-card selected':'select-card'} onClick={onClick} aria-pressed={selected}><span className="select-card-icon">{icon}</span><strong>{title}</strong><small>{help}</small>{selected&&<em><Check size={14}/><span className="sr-only">Selected</span></em>}</button>}
function Field({label,help,error,children,full=false}:{label:string;help?:string;error?:string;children:React.ReactNode;full?:boolean}){return <label className={full?'field full':'field'}><span>{label}</span>{children}{help&&<small>{help}</small>}{error&&<small className="field-error">{error}</small>}</label>}
function ValidationList({errors,warnings}:{errors:string[];warnings:string[]}){return <div className="validation-list" aria-live="polite">{errors.map(error=><p className="field-error" key={error}><AlertTriangle size={14}/>{error}</p>)}{warnings.map(warning=><p className="warning-line" key={warning}><AlertTriangle size={14}/>{warning}</p>)}</div>}
function EmptyState({title,body}:{title:string;body:string}){return <div className="empty-state"><strong>{title}</strong><span>{body}</span></div>}
function ErrorPanel({title,error}:{title:string;error:unknown}){return <div className="error-panel"><strong>{title}</strong><span>{readError(error)}</span></div>}
function SkeletonRows(){return <div className="skeleton-list">{[1,2,3,4].map(item=><i key={item}/>)}</div>}
function SelectedSummary({title,items}:{title:string;items:string[]}){if(!items.length)return null;return <div className="selected-summary"><strong>{title}</strong>{items.map(item=><span key={item}>{item}</span>)}</div>}
function ActionPicker({selected,onToggle}:{selected:string[];onToggle:(action:string)=>void}){const [query,setQuery]=useState('');const actions=useMemo(()=>{if(!query)return actionCatalogue;return actionCatalogue.filter(item=>(item.action+item.description+item.keywords.join(' ')).toLowerCase().includes(query.toLowerCase().replace('execute','invoke')))},[query]);return <div className="action-picker"><label className="search-field"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search actions by service, name or description"/></label>{actions.map(item=><label key={item.action} className={selected.includes(item.action)?'selected':''}><input type="checkbox" checked={selected.includes(item.action)} onChange={()=>onToggle(item.action)}/><span><strong>{item.action}</strong><small>{item.description}</small></span></label>)}</div>}
function SummaryCard({title,children}:{title:string;children:React.ReactNode}){return <section className="summary-card"><h3>{title}</h3>{children}</section>}
function localDateTime(date:Date){const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16)}
function formatDate(value?:string){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Unavailable'}
function readError(error:unknown){return (error as any)?.response?.data?.error?.message??(error as Error)?.message??'Action failed.'}
