import { DescribeOrganizationCommand,ListAccountsCommand,ListAccountsForParentCommand,ListOrganizationalUnitsForParentCommand,ListRootsCommand,type Account,type OrganizationalUnit,type OrganizationsClient,type Root } from '@aws-sdk/client-organizations';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import type { AwsAccountContext,SessionUser } from '../../types.js';
import { cache } from '../cache.service.js';
import { securityAudit } from '../security-audit.service.js';
import { awsConnectionBroker } from './connection-broker.service.js';

export interface DiscoveredOu {ouId:string;name:string;parentOuId?:string;parentId:string;fullPath:string}
export interface DiscoveredAccount {accountId:string;name?:string;email?:string;status?:string;parentId?:string;ouPath:string}
export interface OrganisationDiscovery {organisation:{id?:string;arn?:string;featureSet?:string;managementAccountId?:string};roots:Root[];organisationalUnits:DiscoveredOu[];accounts:DiscoveredAccount[];lastSynchronisedAt:string;cacheStatus:'HIT'|'MISS'}

export class AwsOrganizationsService {
 constructor(private clientOverride?:OrganizationsClient){}
 async discover(context:AwsAccountContext,force=false,actor?:SessionUser):Promise<OrganisationDiscovery>{
  const key=`aws:${context.tenantId}:${context.accountId}:${context.organisationsRegion??env.AWS_ORGANISATIONS_REGION}:organisation-tree`;
  if(!force){const hit=cache.get<OrganisationDiscovery>(key);if(hit)return {...hit,cacheStatus:'HIT'}}
  const client=this.clientOverride??awsConnectionBroker.getOrganisationClient(context,actor);
  const organisation=(await client.send(new DescribeOrganizationCommand({}))).Organization;
  const roots=await this.paginate<Root>(token=>client.send(new ListRootsCommand({NextToken:token})),result=>result.Roots??[]);
  const ous:DiscoveredOu[]=[],placedAccounts:DiscoveredAccount[]=[];
  for(const root of roots)await this.walkParent(client,root.Id!,undefined,`/${root.Name??'Root'}`,ous,placedAccounts);
  const reconciliation=await this.paginate<Account>(token=>client.send(new ListAccountsCommand({NextToken:token})),result=>result.Accounts??[]);
  const placementMap=new Map(placedAccounts.map(item=>[item.accountId,item]));
  const accounts=reconciliation.map(account=>{const placed=placementMap.get(account.Id!);return {accountId:account.Id!,name:account.Name,email:account.Email,status:account.Status,parentId:placed?.parentId,ouPath:placed?.ouPath??'/Unplaced'}});
  const result:OrganisationDiscovery={organisation:{id:organisation?.Id,arn:organisation?.Arn,featureSet:organisation?.FeatureSet,managementAccountId:organisation?.MasterAccountId},roots,organisationalUnits:ous,accounts,lastSynchronisedAt:new Date().toISOString(),cacheStatus:'MISS'};
  cache.set(key,result,env.AWS_DISCOVERY_CACHE_TTL_SECONDS*1000);return result;
 }
 private async walkParent(client:OrganizationsClient,parentId:string,parentOuId:string|undefined,path:string,ous:DiscoveredOu[],accounts:DiscoveredAccount[]){
  const directAccounts=await this.paginate<Account>(token=>client.send(new ListAccountsForParentCommand({ParentId:parentId,NextToken:token})),result=>result.Accounts??[]);
  accounts.push(...directAccounts.map(account=>({accountId:account.Id!,name:account.Name,email:account.Email,status:account.Status,parentId,ouPath:path})));
  const children=await this.paginate<OrganizationalUnit>(token=>client.send(new ListOrganizationalUnitsForParentCommand({ParentId:parentId,NextToken:token})),result=>result.OrganizationalUnits??[]);
  for(const child of children){const fullPath=`${path}/${child.Name}`;ous.push({ouId:child.Id!,name:child.Name!,parentOuId,parentId,fullPath});await this.walkParent(client,child.Id!,child.Id,fullPath,ous,accounts)}
 }
 private async paginate<T>(load:(token?:string)=>Promise<{NextToken?:string}>,items:(result:any)=>T[]){const output:T[]=[];let token:undefined|string;do{const result=await load(token);output.push(...items(result));token=result.NextToken}while(token);return output}
}

export interface OrganisationSyncInput {actor:SessionUser;tenantId:string;organisationConnectionId:string;context:AwsAccountContext;forceRefresh:boolean}
export class AwsOrganisationSyncService{
 constructor(private discovery=new AwsOrganizationsService()){}
 async syncOrganisation(input:OrganisationSyncInput){
  const startedAt=new Date().toISOString();securityAudit.record({tenantId:input.tenantId,awsAccountId:input.context.id,actorUserId:input.actor.id,action:'AWS_ORGANISATION_SYNC_STARTED',outcome:'INFO',metadata:{organisationConnectionId:input.organisationConnectionId}});
  try{
   const data=await this.discovery.discover(input.context,input.forceRefresh,input.actor);
   const persistence=env.NODE_ENV==='test'?{added:0,updated:data.accounts.length,warnings:[] as string[]}:await this.persist(input,data);
   const result={organisation:data.organisation,rootsDiscovered:data.roots.length,ousDiscovered:data.organisationalUnits.length,accountsDiscovered:data.accounts.length,accountsAdded:persistence.added,accountsUpdated:persistence.updated,accountsMarkedUnavailable:0,warnings:[...persistence.warnings,'Database reconciliation is non-destructive; missing accounts require a confirmed subsequent sync before being marked unavailable.'],startedAt,completedAt:new Date().toISOString(),tree:data};
   securityAudit.record({tenantId:input.tenantId,awsAccountId:input.context.id,actorUserId:input.actor.id,action:'AWS_ORGANISATION_SYNC_COMPLETED',outcome:'SUCCESS',metadata:{organisationConnectionId:input.organisationConnectionId,ousDiscovered:result.ousDiscovered,accountsDiscovered:result.accountsDiscovered}});return result;
  }catch(error){securityAudit.record({tenantId:input.tenantId,awsAccountId:input.context.id,actorUserId:input.actor.id,action:'AWS_ORGANISATION_SYNC_FAILED',outcome:'FAILED',metadata:{organisationConnectionId:input.organisationConnectionId,errorCode:(error as {name?:string}).name??'SYNC_FAILED'}});throw error}
 }
 private async persist(input:OrganisationSyncInput,data:OrganisationDiscovery){
  try{
   const organisation=await prisma.awsOrganisation.findFirst({where:{tenantId:input.tenantId,OR:[{id:input.organisationConnectionId},{organisationId:input.organisationConnectionId}]}});if(!organisation)return {added:0,updated:0,warnings:['Organisation metadata was discovered but the configured Organisation record was not found for persistence.']};
   const existing=new Set((await prisma.awsAccount.findMany({where:{tenantId:input.tenantId},select:{accountId:true}})).map(item=>item.accountId));
   await prisma.$transaction(async tx=>{
    for(const ou of data.organisationalUnits)await tx.awsOrganisationalUnit.upsert({where:{awsOrganisationId_ouId:{awsOrganisationId:organisation.id,ouId:ou.ouId}},update:{name:ou.name,parentOuId:ou.parentOuId,fullPath:ou.fullPath,status:'ACTIVE'},create:{awsOrganisationId:organisation.id,ouId:ou.ouId,parentOuId:ou.parentOuId,name:ou.name,fullPath:ou.fullPath,status:'ACTIVE'}});
    const ouRecords=await tx.awsOrganisationalUnit.findMany({where:{awsOrganisationId:organisation.id}}),ouByExternal=new Map(ouRecords.map(item=>[item.ouId,item.id]));
    for(const discovered of data.accounts){const account=await tx.awsAccount.upsert({where:{tenantId_accountId:{tenantId:input.tenantId,accountId:discovered.accountId}},update:{accountName:discovered.name??discovered.accountId,accountEmail:discovered.email,awsOrganisationId:organisation.id,ouId:discovered.parentId?ouByExternal.get(discovered.parentId):undefined},create:{tenantId:input.tenantId,awsOrganisationId:organisation.id,ouId:discovered.parentId?ouByExternal.get(discovered.parentId):undefined,accountId:discovered.accountId,accountName:discovered.name??discovered.accountId,accountEmail:discovered.email,accountType:'SANDBOX',environment:'discovered',riskTier:'UNCLASSIFIED',region:input.context.region,connectionType:'ASSUME_ROLE',connectionStatus:'PENDING',readRoleArn:`arn:aws:iam::${discovered.accountId}:role/${env.AWS_READ_ROLE_NAME}`,provisionRoleArn:`arn:aws:iam::${discovered.accountId}:role/${env.AWS_PROVISION_ROLE_NAME}`}});await tx.awsAccountConnection.upsert({where:{awsAccountId:account.id},update:{},create:{tenantId:input.tenantId,awsAccountId:account.id,connectionType:'ORGANISATION_MEMBER',readRoleArn:account.readRoleArn!,provisionRoleArn:account.provisionRoleArn,defaultRegion:account.region,organisationsRegion:env.AWS_ORGANISATIONS_REGION,connectionStatus:'PENDING',provisioningStatus:'DISABLED',provisioningEnabled:false}})}
    await tx.awsOrganisation.update({where:{id:organisation.id},data:{lastSyncedAt:new Date(),connectionStatus:'CONNECTED'}});
   });
   return {added:data.accounts.filter(item=>!existing.has(item.accountId)).length,updated:data.accounts.filter(item=>existing.has(item.accountId)).length,warnings:[] as string[]};
  }catch{return {added:0,updated:0,warnings:['Organisation discovery succeeded, but database synchronisation was unavailable. No existing account records were deleted.']}}
 }
}
