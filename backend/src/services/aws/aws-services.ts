import { STSClient,GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import {
 IAMClient,
 ListUsersCommand,
 GetUserCommand,
 ListRolesCommand,
 GetRoleCommand,
 ListPoliciesCommand,
 GetPolicyCommand,
 GetPolicyVersionCommand,
 ListAttachedUserPoliciesCommand,
 ListUserPoliciesCommand,
 ListAttachedRolePoliciesCommand,
 ListRolePoliciesCommand,
 ListEntitiesForPolicyCommand,
 SimulatePrincipalPolicyCommand,
 SimulateCustomPolicyCommand,
 AttachUserPolicyCommand,
 DetachUserPolicyCommand,
 AttachRolePolicyCommand,
 DetachRolePolicyCommand,
 CreatePolicyCommand,
 type Policy
} from '@aws-sdk/client-iam';
import { S3Client,ListBucketsCommand,GetBucketLocationCommand } from '@aws-sdk/client-s3';
import { RDSClient,DescribeDBInstancesCommand,DescribeDBClustersCommand } from '@aws-sdk/client-rds';
import { LambdaClient,ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { AccessAnalyzerClient,ValidatePolicyCommand } from '@aws-sdk/client-accessanalyzer';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { env,liveProvisioningEnabled } from '../../config/env.js';
import type { AwsAccountContext,DiscoveredResource,IamIdentity,IamPolicyDetail,IamPolicySummary,PolicyType,RiskAnalysis,SessionUser,TargetType } from '../../types.js';
import { analyzePolicyDocument,extractActions,extractResources,mockAccount,mockIdentities,mockPolicies,mockResources } from '../mock.service.js';
import { cache,cacheTtl } from '../cache.service.js';
import { awsConnectionBroker } from './connection-broker.service.js';

const region=env.AWS_REGION;
const cfg={region};

export class AwsConnectionService{
 private sts:STSClient;
 constructor(private context?:AwsAccountContext,private actor?:SessionUser){this.sts=new STSClient({region:context?.region??region})}
 async status(){
  if(env.AWS_LIVE_MODE==='false')return this.mockConnection('AWS live mode is disabled.');
  if(env.AWS_LIVE_MODE==='auto'&&!hasCredentialHint())return this.mockConnection('No AWS credential source was detected for the backend default provider chain.');
  try{
   if(this.context){const identity=await awsConnectionBroker.validate(this.context,this.actor);return {mode:'LIVE',...identity,credentialSource:this.context.connectionType,lastChecked:new Date().toISOString()}}
   const identity=await this.sts.send(new GetCallerIdentityCommand({}));
   return {mode:'LIVE',connected:true,accountId:identity.Account??'unknown',principalArn:identity.Arn??'unknown',region,credentialSource:this.credentialSource(),lastChecked:new Date().toISOString()};
  }catch(error:any){
   return {...this.mockConnection('No usable AWS credentials were found by the backend default provider chain.'),errorCode:error?.name};
  }
 }
 async test(){return this.status()}
 private mockConnection(message:string){return {mode:'MOCK',connected:false,accountId:this.context?.accountId??mockAccount.accountId,principalArn:mockAccount.principalArn,region:this.context?.region??region,credentialSource:'mock data',lastChecked:new Date().toISOString(),message}}
 private credentialSource(){
  if(process.env.AWS_PROFILE)return 'AWS_PROFILE';
  if(process.env.AWS_WEB_IDENTITY_TOKEN_FILE)return 'web identity';
  if(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI||process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI)return 'container credentials';
  if(process.env.AWS_ACCESS_KEY_ID&&process.env.AWS_SESSION_TOKEN)return 'environment temporary credentials';
  if(process.env.AWS_ACCESS_KEY_ID)return 'environment credentials';
  return 'default provider chain';
 }
}

function hasCredentialHint(){
 return Boolean(process.env.AWS_PROFILE||process.env.AWS_ACCESS_KEY_ID||process.env.AWS_WEB_IDENTITY_TOKEN_FILE||process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI||process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI||existsSync(join(homedir(),'.aws','credentials'))||existsSync(join(homedir(),'.aws','config')));
}

async function liveAvailable(context?:AwsAccountContext,actor?:SessionUser){return (await new AwsConnectionService(context,actor).status()).connected}

export class IamIdentityService{
 private iam:IAMClient;
 constructor(private context?:AwsAccountContext,private actor?:SessionUser){this.iam=context?awsConnectionBroker.getIamClient(context,'read',actor):new IAMClient(cfg)}
 async listUsers(search='',limit=100):Promise<IamIdentity[]>{if(!(await liveAvailable(this.context)))return filterIdentities(mockIdentities.filter(i=>i.type==='USER'),search);const users=await collectLimited(marker=>this.iam.send(new ListUsersCommand({Marker:marker,MaxItems:limit})),r=>r.Users??[],r=>r.Marker,limit);const detailed=await Promise.all(users.map(user=>this.toUser(user.UserName??'',user.Arn??'',user.Path??'/',user.CreateDate)));return filterIdentities(detailed,search)}
 async getUser(userName:string){if(!(await liveAvailable(this.context)))return mockIdentities.find(i=>i.type==='USER'&&i.name===userName);const user=await this.iam.send(new GetUserCommand({UserName:userName}));return this.toUser(userName,user.User?.Arn??'',user.User?.Path??'/',user.User?.CreateDate)}
 async listRoles(search='',includeServiceLinked=false,limit=100):Promise<IamIdentity[]>{if(!(await liveAvailable(this.context)))return filterIdentities(mockIdentities.filter(i=>i.type==='ROLE'&&(includeServiceLinked||!i.serviceLinked)),search);const roles=await collectLimited(marker=>this.iam.send(new ListRolesCommand({Marker:marker,MaxItems:limit})),r=>r.Roles??[],r=>r.Marker,limit);const visible=(includeServiceLinked?roles:roles.filter(role=>!(role.Path??'').startsWith('/aws-service-role/'))).slice(0,limit);const detailed=await Promise.all(visible.map(role=>this.toRole(role.RoleName??'',role.Arn??'',role.Path??'/',role.CreateDate,role.MaxSessionDuration,role.Description,role.AssumeRolePolicyDocument)));return filterIdentities(detailed,search)}
 async getRole(roleName:string){if(!(await liveAvailable(this.context)))return mockIdentities.find(i=>i.type==='ROLE'&&i.name===roleName);const role=await this.iam.send(new GetRoleCommand({RoleName:roleName}));return this.toRole(roleName,role.Role?.Arn??'',role.Role?.Path??'/',role.Role?.CreateDate,role.Role?.MaxSessionDuration)}
 private async toUser(name:string,arn:string,path:string,created?:Date):Promise<IamIdentity>{const attached=await collect(marker=>this.iam.send(new ListAttachedUserPoliciesCommand({UserName:name,Marker:marker})),r=>r.AttachedPolicies??[],r=>r.Marker);const inline=await collect(marker=>this.iam.send(new ListUserPoliciesCommand({UserName:name,Marker:marker})),r=>r.PolicyNames??[],r=>r.Marker);return {id:`user_${name}`,type:'USER',name,arn,path,createdAt:(created??new Date()).toISOString(),passwordEnabled:undefined,attachedPolicies:attached.map(p=>({policyName:p.PolicyName??'',policyArn:p.PolicyArn??''})),inlinePolicies:inline}}
 private async toRole(name:string,arn:string,path:string,created?:Date,maxSessionDuration?:number,description?:string,trustPolicy?:unknown):Promise<IamIdentity>{const [attached,inline]=await Promise.all([collect(marker=>this.iam.send(new ListAttachedRolePoliciesCommand({RoleName:name,Marker:marker})),r=>r.AttachedPolicies??[],r=>r.Marker).catch(()=>[]),collect(marker=>this.iam.send(new ListRolePoliciesCommand({RoleName:name,Marker:marker})),r=>r.PolicyNames??[],r=>r.Marker).catch(()=>[])]);return {id:`role_${name}`,type:'ROLE',name,arn,path,createdAt:(created??new Date()).toISOString(),description,maxSessionDuration,attachedPolicies:attached.map(p=>({policyName:p.PolicyName??'',policyArn:p.PolicyArn??''})),inlinePolicies:inline,serviceLinked:path.startsWith('/aws-service-role/'),trustPolicy}}
}

export class IamPolicyService{
 private iam:IAMClient;
 constructor(private context?:AwsAccountContext,private actor?:SessionUser){this.iam=context?awsConnectionBroker.getIamClient(context,'read',actor):new IAMClient(cfg)}
 private inflightFull=new Set<string>();
 async list(query:{scope?:string;search?:string;service?:string;accessLevel?:string;attached?:string;sort?:string;cursor?:string;limit?:number}):Promise<{items:IamPolicySummary[];nextCursor?:string;isComplete:boolean;loadedCount:number;cacheStatus:'HIT'|'MISS'|'PARTIAL';timing:Record<string,unknown>}>{
  const started=performance.now(),scope=this.toAwsScope(query.scope),limit=Math.min(Math.max(query.limit??100,1),100),marker=decodeCursor(query.cursor);
  const cacheKey=this.catalogueKey(scope,query.attached);
  const cachedFull=cache.get<IamPolicySummary[]>(cacheKey);
  if(cachedFull){
   const filtered=filterPolicies(cachedFull,query);
   const offset=Number(marker||0)||0;
   const items=filtered.slice(offset,offset+limit);
   const next=offset+limit<filtered.length?encodeCursor(String(offset+limit)):undefined;
   const timing=this.timing(started,{cacheStatus:'HIT',awsCalls:0,totalLoaded:cachedFull.length});
   devLog('iam.policy.catalogue.cacheHit',timing);
   return {items,nextCursor:next,isComplete:!next,loadedCount:Math.min(offset+items.length,filtered.length),cacheStatus:'HIT',timing};
  }
  if(!(await liveAvailable(this.context))){
   const filtered=filterPolicies(mockPolicies.map(policy=>({...policy,risk:this.preliminaryRisk(policy)})),query);
   const offset=Number(marker||0)||0,items=filtered.slice(offset,offset+limit),next=offset+limit<filtered.length?encodeCursor(String(offset+limit)):undefined;
   return {items,nextCursor:next,isComplete:!next,loadedCount:Math.min(offset+items.length,filtered.length),cacheStatus:'MISS',timing:this.timing(started,{mode:'MOCK',awsCalls:0,totalLoaded:filtered.length})};
  }
  const firstPageStart=performance.now();
  const response=await this.iam.send(new ListPoliciesCommand({Scope:scope as any,OnlyAttached:query.attached==='true'||undefined,Marker:marker,MaxItems:limit}));
  const items=(response.Policies??[]).map(policy=>this.baseSummary(policy,this.cachedOrPreliminaryRisk(policy)));
  const filtered=filterPolicies(items,query);
  const nextCursor=response.Marker?encodeCursor(response.Marker):undefined;
  this.completeCatalogueInBackground(scope,query.attached);
  const timing=this.timing(started,{cacheStatus:'MISS',firstPageMs:Math.round(performance.now()-firstPageStart),awsCalls:1,pages:1,totalLoaded:items.length,nextCursor:Boolean(nextCursor)});
  devLog('iam.policy.catalogue.firstPage',timing);
  return {items:filtered,nextCursor,isComplete:!nextCursor,loadedCount:items.length,cacheStatus:'MISS',timing};
 }
 async get(encodedArn:string):Promise<IamPolicyDetail|undefined>{
  const arn=decodeURIComponent(encodedArn);
  const started=performance.now();
  const detailKey=`policy-detail:${this.contextKey()}:${arn}`;
  const cached=cache.get<IamPolicyDetail>(detailKey);
  if(cached){devLog('iam.policy.detail.cacheHit',this.timing(started,{cacheStatus:'HIT',arn}));return cached}
  if(!(await liveAvailable(this.context)))return mockPolicies.find(p=>p.arn===arn);
  const policy=await this.iam.send(new GetPolicyCommand({PolicyArn:arn}));
  if(!policy.Policy)return undefined;
  const version=await this.iam.send(new GetPolicyVersionCommand({PolicyArn:arn,VersionId:policy.Policy.DefaultVersionId}));
  const document=parsePolicyDocument(version.PolicyVersion?.Document);
  const entities=await this.iam.send(new ListEntitiesForPolicyCommand({PolicyArn:arn}));
  const riskStart=performance.now();
  const risk=analyzePolicyDocument(document),actions=extractActions(document),resources=extractResources(document);
  cache.set(this.riskKey(policy.Policy),risk,cacheTtl.riskAnalysis);
  const detail={...this.baseSummary(policy.Policy,risk),document,statements:Array.isArray(document.Statement)?document.Statement:[document.Statement].filter(Boolean),actions,resources,conditions:conditions(document),attachedUsers:(entities.PolicyUsers??[]).map(u=>u.UserName??''),attachedRoles:(entities.PolicyRoles??[]).map(r=>r.RoleName??''),attachedGroups:(entities.PolicyGroups??[]).map(g=>g.GroupName??''),observations:risk.flags.length?risk.flags:['No broad risk indicators detected by application analysis']};
  cache.set(detailKey,detail,cacheTtl.policyDetail);
  devLog('iam.policy.detail.fetch',this.timing(started,{cacheStatus:'MISS',awsCalls:3,riskAnalysisMs:Math.round(performance.now()-riskStart),arn}));
  return detail;
 }
 invalidatePolicyCaches(policyArn?:string){cache.deletePrefix(`policy-catalogue:${this.contextKey()}:Local`);if(policyArn)cache.delete(`policy-detail:${this.contextKey()}:${policyArn}`)}
 private baseSummary(policy:Policy,risk:RiskAnalysis):IamPolicySummary{return {policyName:policy.PolicyName??'',arn:policy.Arn??'',policyId:policy.PolicyId,path:policy.Path,description:policy.Description,type:(policy.Arn?.includes(':aws:policy/')?'AWS_MANAGED':'CUSTOMER_MANAGED') as PolicyType,currentVersion:policy.DefaultVersionId??'v1',createdAt:(policy.CreateDate??new Date()).toISOString(),updatedAt:(policy.UpdateDate??new Date()).toISOString(),attachmentCount:policy.AttachmentCount??0,permissionsBoundaryUsageCount:policy.PermissionsBoundaryUsageCount,isAttachable:policy.IsAttachable,services:risk.services,accessLevels:risk.accessLevels,risk,deprecated:false}}
 private preliminaryRisk(policy:Partial<IamPolicySummary>|Policy):RiskAnalysis{const raw=policy as any;const name=raw.policyName??raw.PolicyName??'',description=raw.description??raw.Description??'';const text=`${name} ${description}`.toLowerCase();const services=serviceHints(text);const accessLevels=text.includes('readonly')||text.includes('read only')?['Read']:text.includes('fullaccess')||text.includes('administrator')||text.includes('admin')?['Permissions management','Write']:['Unknown'];const critical=text.includes('administratoraccess')||text.includes('iamfullaccess');const high=text.includes('fullaccess')||text.includes('poweruser');return {level:critical?'Critical':high?'High':'Moderate',flags:['Preliminary metadata-only analysis. Open policy for document-level risk analysis.'],services,accessLevels}}
 private cachedOrPreliminaryRisk(policy:Policy){return cache.get<RiskAnalysis>(this.riskKey(policy))??this.preliminaryRisk(policy)}
 private riskKey(policy:Policy){return `policy-risk:${this.contextKey()}:${policy.Arn}:${policy.DefaultVersionId}`}
 private toAwsScope(scope?:string){return scope==='CUSTOMER_MANAGED'?'Local':scope==='AWS_MANAGED'?'AWS':'All'}
 private catalogueKey(scope:string,attached?:string){return `policy-catalogue:${this.contextKey()}:${scope}:attached=${attached??'all'}`}
 private contextKey(){return this.context?`${this.context.tenantId}:${this.context.accountId}:${this.context.region}`:'default'}
 private completeCatalogueInBackground(scope:string,attached?:string){
  const key=this.catalogueKey(scope,attached);
  if(this.inflightFull.has(key))return;
  this.inflightFull.add(key);
  void (async()=>{
   const started=performance.now();let marker:undefined|string,pages=0,awsCalls=0;const items:IamPolicySummary[]=[];
   try{
    do{
     const response=await this.iam.send(new ListPoliciesCommand({Scope:scope as any,OnlyAttached:attached==='true'||undefined,Marker:marker,MaxItems:100}));
     awsCalls++;pages++;items.push(...(response.Policies??[]).map(policy=>this.baseSummary(policy,this.cachedOrPreliminaryRisk(policy))));
     marker=response.Marker;
    }while(marker);
    const deduped=[...new Map(items.map(item=>[item.arn,item])).values()].sort((a,b)=>a.policyName.localeCompare(b.policyName));
    cache.set(key,deduped,scope==='AWS'?cacheTtl.awsManagedCatalogue:cacheTtl.customerManagedCatalogue);
    devLog('iam.policy.catalogue.backgroundComplete',this.timing(started,{cacheStatus:'MISS',pages,awsCalls,totalLoaded:deduped.length}));
   }catch(error:any){devLog('iam.policy.catalogue.backgroundFailed',{error:sanitizeAwsError(error),pages,awsCalls,totalMs:Math.round(performance.now()-started)})}
   finally{this.inflightFull.delete(key)}
  })();
 }
 private timing(started:number,extra:Record<string,unknown>){return env.NODE_ENV==='production'?{}:{...extra,totalMs:Math.round(performance.now()-started)}}
}

export class AwsResourceService{
 private s3:S3Client;private rds:RDSClient;private lambda:LambdaClient;
 constructor(private context?:AwsAccountContext,private actor?:SessionUser){this.s3=context?awsConnectionBroker.getS3Client(context,actor):new S3Client(cfg);this.rds=context?awsConnectionBroker.getRdsClient(context,actor):new RDSClient(cfg);this.lambda=context?awsConnectionBroker.getLambdaClient(context,actor):new LambdaClient(cfg)}
 async all(){if(!(await liveAvailable(this.context)))return mockResources;const [s3,rds,lambda]=await Promise.all([this.s3Resources(),this.rdsResources(),this.lambdaResources()]);return [...s3,...rds,...lambda]}
 async s3Resources():Promise<DiscoveredResource[]>{if(!(await liveAvailable(this.context)))return mockResources.filter(r=>r.service==='S3');const buckets=await this.s3.send(new ListBucketsCommand({}));return Promise.all((buckets.Buckets??[]).map(async bucket=>{let bucketRegion='us-east-1';try{const loc=await this.s3.send(new GetBucketLocationCommand({Bucket:bucket.Name}));bucketRegion=loc.LocationConstraint||'us-east-1'}catch{}return {id:`s3_${bucket.Name}`,name:bucket.Name??'unknown',service:'S3',type:'Bucket',region:bucketRegion,arn:`arn:aws:s3:::${bucket.Name}`,status:'Available',tags:{}}}))}
 async rdsResources():Promise<DiscoveredResource[]>{if(!(await liveAvailable(this.context)))return mockResources.filter(r=>r.service==='RDS');const [instances,clusters]=await Promise.all([collect(marker=>this.rds.send(new DescribeDBInstancesCommand({Marker:marker})),r=>r.DBInstances??[],r=>r.Marker),collect(marker=>this.rds.send(new DescribeDBClustersCommand({Marker:marker})),r=>r.DBClusters??[],r=>r.Marker)]);const activeRegion=this.context?.region??region;return [...instances.map(db=>({id:`rds_${db.DBInstanceIdentifier}`,name:db.DBInstanceIdentifier??'unknown',service:'RDS' as const,type:'DB instance',region:activeRegion,arn:db.DBInstanceArn??'',status:db.DBInstanceStatus??'unknown',tags:{}})),...clusters.map(cluster=>({id:`rds_${cluster.DBClusterIdentifier}`,name:cluster.DBClusterIdentifier??'unknown',service:'RDS' as const,type:'DB cluster',region:activeRegion,arn:cluster.DBClusterArn??'',status:cluster.Status??'unknown',tags:{}}))]}
 async lambdaResources():Promise<DiscoveredResource[]>{if(!(await liveAvailable(this.context)))return mockResources.filter(r=>r.service==='Lambda');const functions=await collect(marker=>this.lambda.send(new ListFunctionsCommand({Marker:marker})),r=>r.Functions??[],r=>r.NextMarker);const activeRegion=this.context?.region??region;return functions.map(fn=>({id:`lambda_${fn.FunctionName}`,name:fn.FunctionName??'unknown',service:'Lambda',type:'Function',region:activeRegion,arn:fn.FunctionArn??'',status:fn.State??'Active',tags:{}}))}
}

export class IamSimulationService{
 private iam:IAMClient;constructor(private context?:AwsAccountContext,private actor?:SessionUser){this.iam=context?awsConnectionBroker.getIamClient(context,'read',actor):new IAMClient(cfg)}
 async simulate(input:{targetArn:string;actions?:string[];policyDocument?:Record<string,unknown>}){
  if(!(await liveAvailable(this.context)))return {mode:'MOCK',estimate:true,message:'Mock simulation estimates the requested actions would be allowed after approval.',results:(input.actions?.length?input.actions:['iam:AttachUserPolicy']).map(action=>({action,decision:'allowed-after-change'}))};
  if(input.policyDocument){const actions=extractActions(input.policyDocument);const response=await this.iam.send(new SimulateCustomPolicyCommand({PolicyInputList:[JSON.stringify(input.policyDocument)],ActionNames:actions.length?actions:['iam:AttachUserPolicy']}));return {mode:'SIMULATE',estimate:true,results:response.EvaluationResults??[]}}
  const response=await this.iam.send(new SimulatePrincipalPolicyCommand({PolicySourceArn:input.targetArn,ActionNames:input.actions?.length?input.actions:['iam:AttachUserPolicy','iam:AttachRolePolicy']}));
  return {mode:'SIMULATE',estimate:true,results:response.EvaluationResults??[]};
 }
}

export class IamPolicyValidationService{
 private analyzer:AccessAnalyzerClient;constructor(private context?:AwsAccountContext,private actor?:SessionUser){this.analyzer=context?awsConnectionBroker.getAccessAnalyzerClient(context,actor):new AccessAnalyzerClient(cfg)}
 async validate(document:Record<string,unknown>){
  const local=analyzePolicyDocument(document);
  if(!(await liveAvailable(this.context)))return {mode:'MOCK',findings:local.flags.map(flag=>({findingType:local.level==='Critical'||local.level==='High'?'SECURITY_WARNING':'WARNING',issueCode:flag,message:flag})),message:'Access Analyzer validation requires a connected AWS account. Returning local application analysis.'};
  try{
   const response=await this.analyzer.send(new ValidatePolicyCommand({policyDocument:JSON.stringify(document),policyType:'IDENTITY_POLICY'}));
   return {mode:'LIVE',findings:response.findings??[]};
  }catch(error:any){
   return {mode:'UNAVAILABLE',findings:local.flags.map(flag=>({findingType:'WARNING',issueCode:flag,message:flag})),message:sanitizeAwsError(error)};
  }
 }
}

export class IamProvisioningService{
 private iam:IAMClient;constructor(private context?:AwsAccountContext,private actor?:SessionUser,private requestId?:string){this.iam=context?awsConnectionBroker.getIamClient(context,'provision',actor,requestId):new IAMClient(cfg)}
 async attach(input:{targetType:TargetType;targetName:string;policyArn:string}){
  this.assertAllowed(input.policyArn,'attach');
  if(env.PROVISIONING_MODE==='MOCK')return {mode:'MOCK',operation:input.targetType==='USER'?'AttachUserPolicy':'AttachRolePolicy',changed:false,awsRequestId:`mock-${Date.now()}`,message:'Mock provisioning completed without changing AWS.'};
  if(env.PROVISIONING_MODE==='SIMULATE')return {mode:'SIMULATE',changed:false,message:'Simulation mode does not attach policies.'};
  if(!liveProvisioningEnabled)throw new Error('Live provisioning is disabled by server configuration.');
  const response=input.targetType==='USER'?await this.iam.send(new AttachUserPolicyCommand({UserName:input.targetName,PolicyArn:input.policyArn})):await this.iam.send(new AttachRolePolicyCommand({RoleName:input.targetName,PolicyArn:input.policyArn}));
  cache.deletePrefix(`policy-catalogue:${this.contextKey()}:Local`);cache.delete(`policy-detail:${this.contextKey()}:${input.policyArn}`);
  return {mode:'LIVE',operation:input.targetType==='USER'?'AttachUserPolicy':'AttachRolePolicy',changed:true,awsRequestId:response.$metadata.requestId};
 }
 async detach(input:{targetType:TargetType;targetName:string;policyArn:string}){
  this.assertAllowed(input.policyArn,'detach');
  if(env.PROVISIONING_MODE==='MOCK')return {mode:'MOCK',operation:input.targetType==='USER'?'DetachUserPolicy':'DetachRolePolicy',changed:false,awsRequestId:`mock-${Date.now()}`,message:'Mock revocation completed without changing AWS.'};
  if(env.PROVISIONING_MODE==='SIMULATE')return {mode:'SIMULATE',changed:false,message:'Simulation mode does not detach policies.'};
  if(!liveProvisioningEnabled)throw new Error('Live provisioning is disabled by server configuration.');
  const response=input.targetType==='USER'?await this.iam.send(new DetachUserPolicyCommand({UserName:input.targetName,PolicyArn:input.policyArn})):await this.iam.send(new DetachRolePolicyCommand({RoleName:input.targetName,PolicyArn:input.policyArn}));
  cache.deletePrefix(`policy-catalogue:${this.contextKey()}:Local`);cache.delete(`policy-detail:${this.contextKey()}:${input.policyArn}`);
  return {mode:'LIVE',operation:input.targetType==='USER'?'DetachUserPolicy':'DetachRolePolicy',changed:true,awsRequestId:response.$metadata.requestId};
 }
 async createCustomerPolicy(name:string,document:Record<string,unknown>){
  if(env.PROVISIONING_MODE!=='LIVE')return {mode:env.PROVISIONING_MODE,changed:false,policyArn:`arn:aws:iam::${env.AWS_ACCOUNT_ID}:policy/${name}`,message:'Policy creation skipped outside LIVE mode.'};
  if(!liveProvisioningEnabled)throw new Error('Live provisioning is disabled by server configuration.');
  const response=await this.iam.send(new CreatePolicyCommand({PolicyName:name,PolicyDocument:JSON.stringify(document)}));
  cache.deletePrefix(`policy-catalogue:${this.contextKey()}:Local`);
  return {mode:'LIVE',changed:true,policyArn:response.Policy?.Arn,awsRequestId:response.$metadata.requestId};
 }
 private assertAllowed(policyArn:string,operation:string){
  if(policyArn.endsWith('/AdministratorAccess'))throw new Error('AdministratorAccess provisioning is explicitly blocked.');
  if(!['attach','detach'].includes(operation))throw new Error('Unsupported provisioning operation.');
 }
 private contextKey(){return this.context?`${this.context.tenantId}:${this.context.accountId}:${this.context.region}`:'default'}
}

async function collect<T,R>(fn:(marker?:string)=>Promise<R>,items:(response:R)=>T[],next:(response:R)=>string|undefined){const output:T[]=[];let marker:undefined|string;do{const response=await fn(marker);output.push(...items(response));marker=next(response)}while(marker);return output}
async function collectLimited<T,R>(fn:(marker?:string)=>Promise<R>,items:(response:R)=>T[],next:(response:R)=>string|undefined,limit:number){const output:T[]=[];let marker:undefined|string;do{const response=await fn(marker);output.push(...items(response));marker=output.length>=limit?undefined:next(response)}while(marker);return output.slice(0,limit)}
function filterIdentities(items:IamIdentity[],search:string){const q=search.toLowerCase();return q?items.filter(item=>(item.name+item.arn+item.path).toLowerCase().includes(q)):items}
function filterPolicies<T extends IamPolicySummary>(items:T[],query:{search?:string;service?:string;accessLevel?:string;attached?:string;sort?:string}){let data=[...items];if(query.search){const q=query.search.toLowerCase();data=data.filter(p=>(p.policyName+p.arn+(p.description??'')).toLowerCase().includes(q))}if(query.service)data=data.filter(p=>p.services.includes(query.service!));if(query.accessLevel)data=data.filter(p=>p.accessLevels.includes(query.accessLevel!));if(query.attached==='false')data=data.filter(p=>p.attachmentCount===0);if(query.attached==='true')data=data.filter(p=>p.attachmentCount>0);data.sort(query.sort==='updated'?((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)):((a,b)=>a.policyName.localeCompare(b.policyName)));return data}
function parsePolicyDocument(raw:unknown):Record<string,unknown>{if(!raw)return {Version:'2012-10-17',Statement:[]};if(typeof raw==='object')return raw as Record<string,unknown>;const text=String(raw);try{return JSON.parse(decodeURIComponent(text))}catch{try{return JSON.parse(text)}catch{return {Version:'2012-10-17',Statement:[]}}}}
function conditions(document:Record<string,unknown>){const statements=Array.isArray(document.Statement)?document.Statement:[document.Statement].filter(Boolean);return statements.flatMap((s:any)=>s.Condition?[s.Condition]:[])}
function sanitizeAwsError(error:any){return [error?.name,error?.Code,error?.message].filter(Boolean).join(': ').replace(/(AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|AWS_SESSION_TOKEN)=[^,\s]+/g,'$1=[redacted]')||'AWS validation failed.'}
function encodeCursor(marker:string){return Buffer.from(JSON.stringify({marker}),'utf8').toString('base64url')}
function decodeCursor(cursor?:string){if(!cursor)return undefined;try{return JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')).marker as string|undefined}catch{return undefined}}
function devLog(event:string,meta:Record<string,unknown>){if(env.NODE_ENV!=='production')console.info(`[perf] ${event}`,redactMeta(meta))}
function redactMeta(meta:Record<string,unknown>){const output:Record<string,unknown>={};for(const [key,value] of Object.entries(meta)){const sensitive=key.toLowerCase().includes('secret')||key.toLowerCase().includes('token')||key.toLowerCase().includes('credential');output[key]=sensitive?'[redacted]':value}return output}
function serviceHints(text:string){const known=['s3','ec2','rds','lambda','iam','cloudwatch','cloudfront','route53','eks','ecs','kms','sns','sqs','apigateway','waf'];const normalized=text.toLowerCase();const found=known.filter(service=>normalized.includes(service));return found.length?found.map(service=>service==='apigateway'?'API Gateway':service.toUpperCase()):['Unknown']}
