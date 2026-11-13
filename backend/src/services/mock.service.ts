import type { AuditEvent,DiscoveredResource,IamIdentity,IamPolicyDetail,PermissionGrant,PermissionRequest,RiskAnalysis } from '../types.js';

const now=Date.now();
export const mockAccount={accountId:'000000000000',principalArn:'arn:aws:iam::000000000000:user/mock-permissionhub-operator',region:'af-south-1',credentialSource:'mock data'};

export const appUsers=[
 {id:'usr_001',name:'Alex Morgan',email:'alex.morgan@example.local',role:'ADMINISTRATOR'},
 {id:'usr_002',name:'Priya Nair',email:'priya.nair@example.local',role:'MANAGER'},
 {id:'usr_003',name:'Maya Chen',email:'maya.chen@example.local',role:'ENGINEER'},
 {id:'usr_004',name:'Daniel Okafor',email:'daniel.okafor@example.local',role:'AUDITOR'}
];

export const mockIdentities:IamIdentity[]=[
 ['USER','maya.chen','/engineering/',true,undefined,['ReadOnlyAccess','AmazonS3ReadOnlyAccess'],[]],
 ['USER','daniel.okafor','/platform/',true,undefined,['CloudWatchReadOnlyAccess'],['PHLegacyDiagnostics']],
 ['USER','sophia.martinez','/finance/',false,undefined,['AmazonRDSReadOnlyAccess'],[]],
 ['USER','liam.wilson','/engineering/',true,undefined,['AWSLambda_ReadOnlyAccess'],[]],
 ['USER','noah.williams','/security/',false,undefined,['SecurityAudit'],[]],
 ['USER','amara.ndlovu','/data/',true,undefined,['AmazonS3ReadOnlyAccess'],[]],
 ['USER','owen.hughes','/support/',true,undefined,['CloudWatchLogsReadOnlyAccess'],[]],
 ['USER','ava.robinson','/devops/',false,undefined,['ViewOnlyAccess'],[]],
 ['ROLE','platform-readonly','/service-roles/',undefined,3600,['ReadOnlyAccess'],[]],
 ['ROLE','finance-report-runner','/automation/',undefined,7200,['AmazonS3ReadOnlyAccess'],['FinanceReportInlineRead']],
 ['ROLE','lambda-incident-invoker','/incident/',undefined,3600,['AWSLambdaRole'],[]],
 ['ROLE','rds-diagnostics','/database/',undefined,3600,['AmazonRDSReadOnlyAccess'],[]],
 ['ROLE','billing-exporter','/automation/',undefined,3600,['CloudWatchReadOnlyAccess'],[]],
 ['ROLE','security-auditor','/security/',undefined,43200,['SecurityAudit'],[]],
 ['ROLE','developer-sandbox-role','/sandbox/',undefined,3600,['PowerUserAccess'],[]],
 ['ROLE','deployment-observer','/platform/',undefined,3600,['ViewOnlyAccess'],[]],
 ['GROUP','DR_DevOps','/',undefined,undefined,['CloudWatchReadOnlyAccess','ViewOnlyAccess'],[]],
 ['GROUP','Finance_ReadOnly','/',undefined,undefined,['AmazonS3ReadOnlyAccess'],[]],
 ['GROUP','Platform_Engineering','/',undefined,undefined,['ReadOnlyAccess','AWSLambda_ReadOnlyAccess'],[]]
].map((row,index)=>({
 id:`identity_${index+1}`,
 type:row[0] as 'USER'|'ROLE'|'GROUP',
 name:row[1] as string,
 arn:`arn:aws:iam::000000000000:${row[0]==='USER'?'user':row[0]==='ROLE'?'role':'group'}${row[2]}${row[1]}`,
 path:row[2] as string,
 createdAt:new Date(now-(index+12)*86400000).toISOString(),
 description:row[0]==='ROLE'?`${row[1]} role used for sandbox permission-request testing`:`${row[1]} IAM user in the sandbox account`,
 passwordEnabled:row[0]==='USER'?row[3] as boolean|undefined:undefined,
 maxSessionDuration:row[4] as number|undefined,
 attachedPolicies:(row[5] as string[]).map(name=>({policyName:name,policyArn:`arn:aws:iam::aws:policy/${name}`})),
 inlinePolicies:row[6] as string[],
 serviceLinked:row[0]==='ROLE'&&String(row[2]).startsWith('/aws-service-role/'),
 users:row[0]==='GROUP'?['maya.chen','daniel.okafor','liam.wilson'].map(name=>({userName:name,arn:`arn:aws:iam::000000000000:user/${name}`})):undefined,
 userCount:row[0]==='GROUP'?3:undefined,
 tags:{Owner:String(row[1]).split('.')[0]??'platform',Environment:'Sandbox'},
 trustPolicy:row[0]==='ROLE'?{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{AWS:'arn:aws:iam::000000000000:root'},Action:'sts:AssumeRole'}]}:undefined
}));

const policyDocuments:Record<string,Record<string,unknown>>={
 ReadOnlyAccess:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['*:Describe*','*:Get*','*:List*'],Resource:'*'}]},
 AmazonS3ReadOnlyAccess:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['s3:Get*','s3:List*'],Resource:'*'}]},
 AmazonRDSReadOnlyAccess:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['rds:Describe*','rds:ListTagsForResource'],Resource:'*'}]},
 AWSLambda_ReadOnlyAccess:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['lambda:Get*','lambda:List*'],Resource:'*'}]},
 AWSLambdaRole:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['lambda:InvokeFunction'],Resource:'*'}]},
 CloudWatchReadOnlyAccess:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['cloudwatch:Get*','cloudwatch:List*','cloudwatch:Describe*'],Resource:'*'}]},
 CloudWatchLogsReadOnlyAccess:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['logs:Get*','logs:Describe*','logs:FilterLogEvents'],Resource:'*'}]},
 SecurityAudit:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['iam:Get*','iam:List*','cloudtrail:LookupEvents','config:Get*'],Resource:'*'}]},
 ViewOnlyAccess:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['*:Describe*','*:List*'],Resource:'*'}]},
 PowerUserAccess:{Version:'2012-10-17',Statement:[{Effect:'Allow',NotAction:['iam:*','organizations:*','account:*'],Resource:'*'}]},
 PHFinanceReportsRead:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['s3:ListBucket'],Resource:'arn:aws:s3:::finance-reports-dev'},{Effect:'Allow',Action:['s3:GetObject'],Resource:'arn:aws:s3:::finance-reports-dev/*'}]},
 PHLambdaInvokeInvoices:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['lambda:InvokeFunction'],Resource:'arn:aws:lambda:af-south-1:000000000000:function:invoice-processor-dev'}]}
};

function asArray(value:unknown):unknown[]{return Array.isArray(value)?value:value?[value]:[]}
export function extractActions(document:Record<string,unknown>){return asArray(document.Statement).flatMap((s:any)=>asArray(s.Action??s.NotAction)).map(String)}
export function extractResources(document:Record<string,unknown>){return asArray(document.Statement).flatMap((s:any)=>asArray(s.Resource??'*')).map(String)}

function classifyAccess(actions:string[]){
 const levels=new Set<string>();
 for(const action of actions){
  if(/(:\*|\*)$/.test(action))levels.add('Permissions management');
  else if(/(List|Describe|Get|Read|Lookup|Filter)/i.test(action))levels.add('Read');
  else if(/(Create|Put|Update|Delete|Attach|Detach|PassRole|AssumeRole|Invoke)/i.test(action))levels.add('Write');
  else levels.add('Unknown');
 }
 return [...levels];
}

export function analyzePolicyDocument(document:Record<string,unknown>):RiskAnalysis{
 const actions=extractActions(document),resources=extractResources(document),flags:string[]=[];
 if(actions.some(a=>a==='*'||a.endsWith(':*')))flags.push('Action wildcard');
 if(resources.includes('*'))flags.push('Resource wildcard');
 if(actions.some(a=>a==='*'||a==='iam:*'||a.toLowerCase().includes('administrator')))flags.push('Administrative access');
 if(actions.some(a=>a.startsWith('iam:')&&/(Create|Update|Put|Attach|Detach|Delete)/.test(a)))flags.push('IAM write permissions');
 if(actions.some(a=>/(Attach|Detach|Put|CreatePolicy|DeletePolicy|SetDefaultPolicyVersion)/.test(a)))flags.push('Permission-management actions');
 if(actions.some(a=>/(CreateAccessKey|UpdateAccessKey)/.test(a)))flags.push('Ability to create or update access keys');
 if(actions.includes('iam:PassRole'))flags.push('Ability to pass roles');
 if(actions.includes('sts:AssumeRole'))flags.push('Ability to assume roles');
 if(actions.some(a=>/(PutBucketPolicy|PutBucketAcl|PutPublicAccessBlock)/.test(a)))flags.push('Public resource configuration');
 if(actions.some(a=>/(Delete|Terminate|Drop)/.test(a)))flags.push('Destructive actions');
 if(actions.some(a=>/(Get|List|Describe|Read|Lookup|Filter)/.test(a)))flags.push('Data-read access');
 if(actions.some(a=>/(Put|Create|Update|Write|Invoke)/.test(a)))flags.push('Data-write access');
 const critical=flags.some(f=>['Administrative access','Ability to create or update access keys','Permission-management actions'].includes(f));
 const high=critical||flags.some(f=>['Action wildcard','IAM write permissions','Ability to pass roles','Public resource configuration','Destructive actions'].includes(f));
 const moderate=high||flags.some(f=>['Resource wildcard','Data-write access'].includes(f));
 return {level:critical?'Critical':high?'High':moderate?'Moderate':'Low',flags,services:[...new Set(actions.map(a=>a.split(':')[0]??'').filter((service):service is string=>Boolean(service)))],accessLevels:classifyAccess(actions)};
}

export const mockPolicies:IamPolicyDetail[]=Object.entries(policyDocuments).map(([name,document],index)=>{
 const custom=name.startsWith('PH'),risk=analyzePolicyDocument(document),actions=extractActions(document),resources=extractResources(document);
 return {
  policyName:name,
  arn:custom?`arn:aws:iam::000000000000:policy/${name}`:`arn:aws:iam::aws:policy/${name}`,
  description:custom?'Customer-managed test policy for PermissionHub development':'AWS-managed policy from the mock permission catalogue',
  type:custom?'CUSTOMER_MANAGED':'AWS_MANAGED',
  currentVersion:'v1',
  createdAt:new Date(now-(index+30)*86400000).toISOString(),
  updatedAt:new Date(now-(index+2)*43200000).toISOString(),
  attachmentCount:mockIdentities.filter(identity=>identity.attachedPolicies.some(policy=>policy.policyName===name)).length,
  services:risk.services,
  accessLevels:risk.accessLevels,
  risk,
  deprecated:false,
  document,
  statements:asArray(document.Statement),
  actions,
  resources,
  conditions:asArray(document.Statement).flatMap((s:any)=>s.Condition?[s.Condition]:[]),
  attachedUsers:mockIdentities.filter(i=>i.type==='USER'&&i.attachedPolicies.some(p=>p.policyName===name)).map(i=>i.name),
  attachedRoles:mockIdentities.filter(i=>i.type==='ROLE'&&i.attachedPolicies.some(p=>p.policyName===name)).map(i=>i.name),
  attachedGroups:[],
  observations:risk.flags.length?risk.flags:['No broad risk indicators detected by application analysis']
 };
});

export const mockResources:DiscoveredResource[]=[
 {id:'s3_1',name:'finance-reports-dev',service:'S3',type:'Bucket',region:'af-south-1',arn:'arn:aws:s3:::finance-reports-dev',status:'Available',tags:{Owner:'Finance',Environment:'Sandbox'}},
 {id:'s3_2',name:'engineering-artifacts-dev',service:'S3',type:'Bucket',region:'af-south-1',arn:'arn:aws:s3:::engineering-artifacts-dev',status:'Available',tags:{Owner:'Platform',Environment:'Sandbox'}},
 {id:'s3_3',name:'audit-exports-dev',service:'S3',type:'Bucket',region:'af-south-1',arn:'arn:aws:s3:::audit-exports-dev',status:'Available',tags:{Owner:'Security',Environment:'Sandbox'}},
 {id:'rds_1',name:'customer-ledger-dev',service:'RDS',type:'DB instance',region:'af-south-1',arn:'arn:aws:rds:af-south-1:000000000000:db:customer-ledger-dev',status:'Available',tags:{Owner:'Data',Environment:'Sandbox'}},
 {id:'rds_2',name:'finance-reports-cluster-dev',service:'RDS',type:'DB cluster',region:'af-south-1',arn:'arn:aws:rds:af-south-1:000000000000:cluster:finance-reports-cluster-dev',status:'Available',tags:{Owner:'Finance',Environment:'Sandbox'}},
 {id:'lambda_1',name:'invoice-processor-dev',service:'Lambda',type:'Function',region:'af-south-1',arn:'arn:aws:lambda:af-south-1:000000000000:function:invoice-processor-dev',status:'Active',tags:{Owner:'Billing',Environment:'Sandbox'}},
 {id:'lambda_2',name:'access-expiry-worker-dev',service:'Lambda',type:'Function',region:'af-south-1',arn:'arn:aws:lambda:af-south-1:000000000000:function:access-expiry-worker-dev',status:'Active',tags:{Owner:'Security',Environment:'Sandbox'}}
];

export const requests:PermissionRequest[]=[
 {id:'PR-1007',title:'Attach S3 read access for finance investigation',requester:'Maya Chen',approver:'Priya Nair',targetType:'USER',targetName:'maya.chen',targetArn:mockIdentities[0]!.arn,items:[{mode:'MANAGED_POLICY',policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],scope:{type:'RESOURCE',resources:['finance-reports-dev']},duration:'7 days',startDate:new Date(now-7200000).toISOString(),expiryDate:new Date(now+7*86400000).toISOString(),priority:'Medium',justification:'Finance reporting job failed and engineering needs read-only bucket access to compare generated report objects with source records.',status:'Pending approval',submittedAt:new Date(now-7200000).toISOString(),createdAt:new Date(now-7600000).toISOString(),timeline:[{label:'Draft created',timestamp:new Date(now-7600000).toISOString()},{label:'Submitted',timestamp:new Date(now-7200000).toISOString()}]},
 {id:'PR-1006',title:'Invoke invoice processor during incident window',requester:'Daniel Okafor',approver:'Priya Nair',targetType:'ROLE',targetName:'lambda-incident-invoker',targetArn:mockIdentities[10]!.arn,items:[{mode:'MANAGED_POLICY',policyName:'AWSLambdaRole',policyArn:'arn:aws:iam::aws:policy/service-role/AWSLambdaRole'}],scope:{type:'RESOURCE',resources:['invoice-processor-dev']},duration:'8 hours',startDate:new Date(now-86400000).toISOString(),expiryDate:new Date(now+6*3600000).toISOString(),priority:'High',justification:'Incident response needs temporary invoke access for replaying failed invoice events in the sandbox account.',status:'Provisioned',submittedAt:new Date(now-86400000).toISOString(),createdAt:new Date(now-86800000).toISOString(),timeline:[{label:'Draft created',timestamp:new Date(now-86800000).toISOString()},{label:'Submitted',timestamp:new Date(now-86400000).toISOString()},{label:'Approved',timestamp:new Date(now-82800000).toISOString()},{label:'Policy attached',timestamp:new Date(now-82600000).toISOString(),result:'MOCK'}]},
 {id:'PR-1005',title:'RDS diagnostics for customer ledger',requester:'Sophia Martinez',approver:'Priya Nair',targetType:'USER',targetName:'sophia.martinez',targetArn:mockIdentities[2]!.arn,items:[{mode:'MANAGED_POLICY',policyName:'AmazonRDSReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonRDSReadOnlyAccess'}],scope:{type:'RESOURCE',resources:['customer-ledger-dev']},duration:'1 day',startDate:new Date(now-3*86400000).toISOString(),expiryDate:new Date(now-2*86400000).toISOString(),priority:'Low',justification:'Database metrics and configuration review for sandbox migration validation.',status:'Expired',submittedAt:new Date(now-3*86400000).toISOString(),createdAt:new Date(now-3*86400000-600000).toISOString(),timeline:[{label:'Draft created',timestamp:new Date(now-3*86400000-600000).toISOString()},{label:'Submitted',timestamp:new Date(now-3*86400000).toISOString()},{label:'Approved',timestamp:new Date(now-3*86400000+3600000).toISOString()},{label:'Policy attached',timestamp:new Date(now-3*86400000+3700000).toISOString()},{label:'Access expiry',timestamp:new Date(now-2*86400000).toISOString()}]}
];

export const grants:PermissionGrant[]=[{id:'grant_1006',requestId:'PR-1006',targetType:'ROLE',targetName:'lambda-incident-invoker',targetArn:mockIdentities[10]!.arn,policyArn:'arn:aws:iam::aws:policy/service-role/AWSLambdaRole',attachedAt:new Date(now-82600000).toISOString(),expiresAt:new Date(now+6*3600000).toISOString(),provisioningResponse:{mode:'MOCK',operation:'AttachRolePolicy',requestId:'mock-attach-1006'}}];

export const auditEvents:AuditEvent[]=[
 {id:'evt_1',timestamp:new Date(now-7200000).toISOString(),actor:'Maya Chen',requestId:'PR-1007',targetArn:mockIdentities[0]!.arn,policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',action:'Request submitted',newState:{status:'Pending approval'},result:'SUCCESS'},
 {id:'evt_2',timestamp:new Date(now-3600000).toISOString(),actor:'System',action:'AWS connection test',awsAccountId:'000000000000',result:'INFO'},
 {id:'evt_3',timestamp:new Date(now-82600000).toISOString(),actor:'PermissionHub',requestId:'PR-1006',targetArn:mockIdentities[10]!.arn,policyArn:'arn:aws:iam::aws:policy/service-role/AWSLambdaRole',action:'Policy attached',newState:{status:'Provisioned'},result:'SUCCESS',awsRequestId:'mock-aws-request-1006'},
 {id:'evt_4',timestamp:new Date(now-2*86400000).toISOString(),actor:'Expiry worker',requestId:'PR-1005',targetArn:mockIdentities[2]!.arn,policyArn:'arn:aws:iam::aws:policy/AmazonRDSReadOnlyAccess',action:'Access expired',newState:{status:'Expired'},result:'SUCCESS'}
];

export const managers=appUsers.filter(user=>user.role==='MANAGER'||user.role==='ADMINISTRATOR');
export const supportedActions=['s3:ListBucket','s3:GetObject','rds:DescribeDBInstances','rds:DescribeDBClusters','lambda:InvokeFunction'];
