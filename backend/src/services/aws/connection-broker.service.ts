import { AccessAnalyzerClient } from '@aws-sdk/client-accessanalyzer';
import { IAMClient,ListPoliciesCommand,ListRolesCommand,ListUsersCommand } from '@aws-sdk/client-iam';
import { OrganizationsClient } from '@aws-sdk/client-organizations';
import { S3Client } from '@aws-sdk/client-s3';
import { RDSClient } from '@aws-sdk/client-rds';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { STSClient,AssumeRoleCommand,GetCallerIdentityCommand,type AssumeRoleCommandInput } from '@aws-sdk/client-sts';
import type { AwsCredentialIdentity } from '@smithy/types';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import type { AwsAccountContext,SessionUser } from '../../types.js';
import { ApiError } from '../../utils/http.js';
import { authorization } from '../authorization.service.js';
import { identityDomain } from '../identity-domain.service.js';
import { securityAudit } from '../security-audit.service.js';
import { secretResolver,type SecretResolver } from './secret-resolver.service.js';

export type ConnectionMode='READ'|'PROVISION';
type CachedCredentials={credentials:AwsCredentialIdentity;expiresAt:number};
type BrokerDeps={stsFactory?:(region:string,credentials?:AwsCredentialIdentity)=>STSClient;secretResolver?:SecretResolver;now?:()=>number};

export function buildRoleArn(accountId:string,roleName:string,rolePath=''){
 const cleanPath=rolePath.replace(/^\/+|\/+$/g,'');
 return `arn:aws:iam::${accountId}:role/${cleanPath?`${cleanPath}/`:''}${roleName}`;
}
export function sanitiseSourceIdentity(value:string){return value.replace(/[^A-Za-z0-9+=,.@_-]/g,'-').replace(/^-+/,'').slice(0,64)||'permissionhub-user'}
export function sanitiseSessionTag(value:string){return value.replace(/[^\p{L}\p{Z}\p{N}_.:/=+\-@]/gu,'-').slice(0,256)}
export function buildAssumeRoleInput(context:AwsAccountContext,mode:ConnectionMode,actor:SessionUser|undefined,externalId:string|undefined,requestId:string|undefined,now=Date.now()):AssumeRoleCommandInput{
 const roleArn=mode==='PROVISION'?context.provisionRoleArn:context.readRoleArn;
 if(!roleArn)throw new ApiError(422,`No ${mode.toLowerCase()} role is configured for this account.`,mode==='READ'?'READ_ROLE_REQUIRED':'PROVISION_ROLE_REQUIRED');
 const source=sanitiseSourceIdentity(requestId??actor?.id??'service');
 const prefix=sanitiseSourceIdentity(env.AWS_ROLE_SESSION_PREFIX).slice(0,24);
 const tags=[
  ['PermissionHubTenant',context.tenantId],['PermissionHubUser',actor?.id],['PermissionHubRequest',requestId],['PermissionHubMode',mode]
 ].filter((item):item is [string,string]=>Boolean(item[1])).map(([Key,Value])=>({Key,Value:sanitiseSessionTag(Value)}));
 return {RoleArn:roleArn,RoleSessionName:`${prefix}-${source}-${now.toString(36)}`.slice(0,64),DurationSeconds:env.AWS_ASSUME_ROLE_DURATION_SECONDS,ExternalId:externalId,SourceIdentity:source,Tags:tags};
}

export class AwsConnectionBroker {
 private readonly credentials=new Map<string,CachedCredentials>();
 private readonly stsFactory:NonNullable<BrokerDeps['stsFactory']>;
 private readonly secrets:SecretResolver;
 private readonly now:()=>number;
 constructor(deps:BrokerDeps={}){this.stsFactory=deps.stsFactory??((region,credentials)=>new STSClient({region,credentials}));this.secrets=deps.secretResolver??secretResolver;this.now=deps.now??Date.now}
 async validateLocalCredentialSource(region=env.AWS_REGION){try{const response=await this.stsFactory(region).send(new GetCallerIdentityCommand({}));return {success:true,accountId:response.Account,principalArn:response.Arn,region,credentialSource:'AWS SDK default provider chain',checkedAt:new Date(this.now()).toISOString()}}catch(error){const safe=sanitiseAwsConnectionError(error);throw new ApiError(safe.status,safe.message,safe.code)}}

 async validateAccountConnection(actor:SessionUser,accountId:string,mode:ConnectionMode='READ',validationOnly=false){
  const context=this.authorisedAccount(actor,accountId,mode);
  this.audit(context,actor,'AWS_CONNECTION_VALIDATION_STARTED','INFO',{mode});
  try{
   const credentials=await this.credentialsFor(context,mode,actor,undefined,mode==='READ',validationOnly);
   const identity=await this.validateIdentity(context,credentials,mode);
   context.connectionStatus='CONNECTED';context.lastValidatedAt=new Date(this.now()).toISOString();
   if(mode==='READ')context.lastSuccessfulReadAt=context.lastValidatedAt;else context.lastSuccessfulProvisionAt=context.lastValidatedAt;
   context.lastErrorCode=undefined;context.lastErrorMessage=undefined;
   this.persistStatus(context,mode,true);
   this.audit(context,actor,mode==='READ'?'AWS_CONNECTION_VALIDATED':'AWS_PROVISION_ROLE_VALIDATED','SUCCESS',{mode,principalArn:identity.principalArn});
   return {...identity,connected:true,mode,connectionStatus:context.connectionStatus,lastValidatedAt:context.lastValidatedAt};
  }catch(error){
   const safe=sanitiseAwsConnectionError(error);context.connectionStatus='ERROR';context.lastErrorCode=safe.code;context.lastErrorMessage=safe.message;
   this.persistStatus(context,mode,false);
   this.audit(context,actor,'AWS_CONNECTION_FAILED','FAILED',{mode,errorCode:safe.code});throw new ApiError(safe.status,safe.message,safe.code);
  }
 }
 async testReadCapabilities(actor:SessionUser,accountId:string){
  const context=this.authorisedAccount(actor,accountId,'READ');
  const credentials=await this.credentialsFor(context,'READ',actor);
  await this.validateIdentity(context,credentials,'READ');
  const iam=new IAMClient({region:context.region,credentials});
  const capability=async(command:ListUsersCommand|ListRolesCommand|ListPoliciesCommand)=>{try{await iam.send(command as never);return {available:true}}catch(error){const safe=sanitiseAwsConnectionError(error);return {available:false,errorCode:safe.code,message:safe.message}}};
  const [users,roles,policies]=await Promise.all([capability(new ListUsersCommand({MaxItems:1})),capability(new ListRolesCommand({MaxItems:1})),capability(new ListPoliciesCommand({Scope:'AWS',MaxItems:1}))]);
  this.audit(context,actor,'AWS_DISCOVERY_PERFORMED','SUCCESS',{capabilities:{users:users.available,roles:roles.available,policies:policies.available}});
  return {accountValidated:true,iamUsersReadable:users.available,iamRolesReadable:roles.available,policiesReadable:policies.available,policyValidationAvailable:false,provisionRoleConfigured:Boolean(context.provisionRoleArn),details:{users,roles,policies}};
 }
 async getReadCredentials(actor:SessionUser,accountId:string){const context=this.authorisedAccount(actor,accountId,'READ');return this.credentialsFor(context,'READ',actor)}
 async getProvisionCredentials(actor:SessionUser,requestId:string,accountId?:string){
  if(!accountId)throw new ApiError(422,'A request-scoped AWS account is required.','AWS_ACCOUNT_REQUIRED');
  const context=this.authorisedAccount(actor,accountId,'PROVISION');return this.credentialsFor(context,'PROVISION',actor,requestId,false);
 }
 async getIamClientFor(actor:SessionUser,accountId:string,mode:ConnectionMode='READ',requestId?:string){const context=this.authorisedAccount(actor,accountId,mode);return new IAMClient({region:context.region,credentials:await this.credentialsFor(context,mode,actor,requestId)})}
 async getOrganizationsClientFor(actor:SessionUser,organisationId:string){
  const organisation=identityDomain.organisationsFor(actor).find(item=>item.id===organisationId||item.organisationId===organisationId);
  if(!organisation||!authorization.canViewOrganisation(actor,organisation.id))throw new ApiError(403,'AWS Organisation access is not permitted.','AWS_ORGANISATION_FORBIDDEN');
  const account=identityDomain.accountsFor(actor).find(item=>item.organisationId===organisation.id&&item.organisationDiscoveryRoleArn)||identityDomain.accountsFor(actor).find(item=>item.organisationId===organisation.id);
  if(!account)throw new ApiError(422,'No Organisation discovery connection is configured.','ORGANISATION_CONNECTION_REQUIRED');
  return new OrganizationsClient({region:account.organisationsRegion??env.AWS_ORGANISATIONS_REGION,credentials:await this.credentialsFor(account,'READ',actor)});
 }
 async getAccessAnalyzerClientFor(actor:SessionUser,accountId:string,region?:string){const context=this.authorisedAccount(actor,accountId,'READ');return new AccessAnalyzerClient({region:region??context.region,credentials:await this.credentialsFor(context,'READ',actor)})}

 // Context-based methods retain the existing service contract. Route middleware has already authorised these contexts.
 getOrganisationClient(context:AwsAccountContext,actor?:SessionUser){return new OrganizationsClient(this.clientConfig(context,'READ',actor,undefined,context.organisationsRegion??env.AWS_ORGANISATIONS_REGION))}
 getIamClient(context:AwsAccountContext,purpose:'read'|'provision'='read',actor?:SessionUser,requestId?:string){return new IAMClient(this.clientConfig(context,purpose==='read'?'READ':'PROVISION',actor,requestId))}
 getS3Client(context:AwsAccountContext,actor?:SessionUser){return new S3Client(this.clientConfig(context,'READ',actor))}
 getRdsClient(context:AwsAccountContext,actor?:SessionUser){return new RDSClient(this.clientConfig(context,'READ',actor))}
 getLambdaClient(context:AwsAccountContext,actor?:SessionUser){return new LambdaClient(this.clientConfig(context,'READ',actor))}
 getAccessAnalyzerClient(context:AwsAccountContext,actor?:SessionUser){return new AccessAnalyzerClient(this.clientConfig(context,'READ',actor))}
 async validate(context:AwsAccountContext,actor?:SessionUser,mode:ConnectionMode='READ'){const credentials=await this.credentialsFor(context,mode,actor);return this.validateIdentity(context,credentials,mode)}
 invalidateAccount(tenantId:string,accountId:string){for(const key of this.credentials.keys())if(key.startsWith(`${tenantId}:${accountId}:`))this.credentials.delete(key)}

 private authorisedAccount(actor:SessionUser,accountId:string,mode:ConnectionMode){
  const context=identityDomain.account(actor,accountId);
  if(!context||context.tenantId!==actor.activeTenantId||!authorization.canViewAccount(actor,context.id))throw new ApiError(403,'AWS account access is not permitted.','AWS_ACCOUNT_FORBIDDEN');
  if(context.connectionStatus==='DISABLED')throw new ApiError(409,'This AWS account connection is disabled.','AWS_CONNECTION_DISABLED');
  if(mode==='PROVISION'&&!authorization.canProvisionInAccount(actor,context.id))throw new ApiError(403,'Provisioning access is not permitted for this AWS account.','PROVISIONING_FORBIDDEN');
  return context;
 }
 private clientConfig(context:AwsAccountContext,mode:ConnectionMode,actor?:SessionUser,requestId?:string,region=context.region){return ['DEFAULT_CHAIN','LOCAL_DEVELOPMENT','LOCAL_DEFAULT_CREDENTIALS'].includes(context.connectionType)?{region}:{region,credentials:()=>this.credentialsFor(context,mode,actor,requestId)} as const}
 private async credentialsFor(context:AwsAccountContext,mode:ConnectionMode,actor?:SessionUser,requestId?:string,useCache=true,validationOnly=false):Promise<AwsCredentialIdentity>{
  if(mode==='PROVISION'&&!validationOnly){
   if(!env.CROSS_ACCOUNT_PROVISIONING_ENABLED)throw new ApiError(403,'Cross-account provisioning is disabled.','CROSS_ACCOUNT_PROVISIONING_DISABLED');
   if(!context.provisioningEnabled)throw new ApiError(403,'Provisioning is disabled for this AWS account.','ACCOUNT_PROVISIONING_DISABLED');
  }
  if(['DEFAULT_CHAIN','LOCAL_DEVELOPMENT','LOCAL_DEFAULT_CREDENTIALS'].includes(context.connectionType))return this.defaultCredentials(context,mode);
  const cacheKey=`${context.tenantId}:${context.accountId}:${context.region}:${context.connectionType}:${mode}`;
  const cached=this.credentials.get(cacheKey);if(useCache&&cached&&cached.expiresAt-this.now()>60_000)return cached.credentials;
  const secret=context.externalIdSecretReference?await this.secrets.getSecret(context.externalIdSecretReference):undefined;
  const input=buildAssumeRoleInput(context,mode,actor,secret,requestId,this.now());
  try{
   const response=await this.stsFactory(context.region).send(new AssumeRoleCommand(input));
   const value=response.Credentials;if(!value?.AccessKeyId||!value.SecretAccessKey)throw new Error('STS returned no temporary credentials.');
   const credentials:AwsCredentialIdentity={accessKeyId:value.AccessKeyId,secretAccessKey:value.SecretAccessKey,sessionToken:value.SessionToken,expiration:value.Expiration};
   await this.validateIdentity(context,credentials,mode);
   const expiresAt=Math.min(value.Expiration?.getTime()??this.now()+env.AWS_ROLE_CACHE_TTL_SECONDS*1000,this.now()+env.AWS_ROLE_CACHE_TTL_SECONDS*1000);
   if(mode==='READ'&&useCache)this.credentials.set(cacheKey,{credentials,expiresAt});
   this.audit(context,actor,'AWS_ROLE_ASSUMED','SUCCESS',{mode,roleArn:input.RoleArn,durationSeconds:input.DurationSeconds,requestId});return credentials;
  }catch(error){const safe=sanitiseAwsConnectionError(error);this.audit(context,actor,'AWS_ROLE_ASSUME_FAILED','FAILED',{mode,roleArn:input.RoleArn,errorCode:safe.code,requestId});throw error}
 }
 private async defaultCredentials(context:AwsAccountContext,_mode:ConnectionMode){
  const identity=await this.stsFactory(context.region).send(new GetCallerIdentityCommand({}));
  if(identity.Account!==context.accountId)throw new ApiError(409,`PermissionHub backend credentials belong to account ${identity.Account??'unknown'}, not configured account ${context.accountId}.`,'AWS_ACCOUNT_MISMATCH');
  // Undefined credentials tells SDK v3 to use its secure default provider chain.
  return undefined as unknown as AwsCredentialIdentity;
 }
 private async validateIdentity(context:AwsAccountContext,credentials:AwsCredentialIdentity|undefined,mode:ConnectionMode){
  const response=await this.stsFactory(context.region,credentials).send(new GetCallerIdentityCommand({}));
  if(response.Account!==context.accountId)throw new ApiError(409,`PermissionHub assumed the configured role, but AWS returned account ${response.Account??'unknown'} instead of the expected account ${context.accountId}.`,'AWS_ACCOUNT_MISMATCH');
  const expected=mode==='PROVISION'?context.provisionRoleArn:context.readRoleArn;
  if(expected&&response.Arn&&!this.matchesRole(response.Arn,expected))throw new ApiError(409,'AWS returned an unexpected assumed-role identity for this connection.','AWS_ROLE_MISMATCH');
  return {accountId:response.Account,principalArn:response.Arn??'unknown',userId:response.UserId,region:context.region};
 }
 private matchesRole(identityArn:string,roleArn:string){const roleName=roleArn.split('/').at(-1);return identityArn.includes(`:assumed-role/${roleName}/`)}
 private audit(context:AwsAccountContext,actor:SessionUser|undefined,action:string,outcome:'SUCCESS'|'FAILED'|'INFO',metadata:Record<string,unknown>){securityAudit.record({tenantId:context.tenantId,awsAccountId:context.id,actorUserId:actor?.id,action,outcome,metadata:{accountId:context.accountId,...metadata}})}
 private persistStatus(context:AwsAccountContext,mode:ConnectionMode,success:boolean){if(env.NODE_ENV==='test')return;void prisma.awsAccountConnection.updateMany({where:{tenantId:context.tenantId,awsAccountId:context.id},data:{connectionStatus:success?'CONNECTED':'ERROR',provisioningStatus:mode==='PROVISION'?(success?'CONNECTED':'ERROR'):undefined,lastValidatedAt:new Date(this.now()),lastSuccessfulReadAt:success&&mode==='READ'?new Date(this.now()):undefined,lastSuccessfulProvisionAt:success&&mode==='PROVISION'?new Date(this.now()):undefined,lastErrorCode:success?null:context.lastErrorCode,lastErrorMessage:success?null:context.lastErrorMessage}}).catch(()=>undefined)}
}

export function sanitiseAwsConnectionError(error:unknown){
 const value=error as {name?:string;Code?:string;code?:string;message?:string;$metadata?:{httpStatusCode?:number}};const code=value.code??value.Code??value.name??'AWS_CONNECTION_FAILED';
 const messages:Record<string,string>={AccessDenied:'PermissionHub cannot assume the configured role or the role lacks a required read permission.',AccessDeniedException:'PermissionHub cannot assume the configured role or the role lacks a required read permission.',InvalidClientTokenId:'The backend AWS credential source is invalid.',ExpiredToken:'The backend AWS session has expired. Refresh the AWS profile or workload credentials.',Throttling:'AWS throttled the connection request. Retry shortly.',ThrottlingException:'AWS throttled the connection request. Retry shortly.',RegionDisabled:'The configured AWS region is disabled for this account.',NoSuchEntity:'The configured PermissionHub role does not exist in the target account.'};
 let message=messages[code]??'PermissionHub could not validate the AWS account connection.';
 if(code==='AWS_ACCOUNT_MISMATCH'||code==='AWS_ROLE_MISMATCH')message=value.message??message;
 return {code,status:value.$metadata?.httpStatusCode&&value.$metadata.httpStatusCode<500?value.$metadata.httpStatusCode:code.includes('Mismatch')?409:502,message};
}

export const awsConnectionBroker=new AwsConnectionBroker();
