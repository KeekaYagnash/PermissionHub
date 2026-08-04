import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import type { AccountType,AwsAccountContext,AwsConnectionType,SessionUser } from '../types.js';
import { identityDomain } from './identity-domain.service.js';

export interface ManualAccountInput{
 accountName:string;awsAccountNumber:string;accountType:AccountType;defaultRegion:string;connectionType:'LOCAL_DEFAULT_CREDENTIALS'|'ASSUME_ROLE';readRoleArn?:string;provisionRoleArn?:string;externalIdSecretReference?:string
}
export type OnboardingOutcome='CREATED'|'EXISTING'|'REPAIRED'|'CONVERSION_REQUIRED';

export function mapAwsAccount(row:any):AwsAccountContext{
 const connection=row.connection,hasConnection=Boolean(connection);
 return {id:row.id,accountRecordId:row.id,tenantId:row.tenantId,accountId:row.accountId,awsAccountNumber:row.accountId,accountName:row.accountName,accountType:row.accountType,environment:row.environment,riskTier:row.riskTier,region:row.region,connectionType:(connection?.connectionType??row.connectionType) as AwsConnectionType,connectionStatus:hasConnection?(connection.connectionStatus??row.connectionStatus):'REPAIR_REQUIRED',sourceType:row.sourceType,isDemo:row.isDemo,connectionSource:connection?.connectionSource,hasConnection,readRoleArn:connection?.readRoleArn??row.readRoleArn,provisionRoleArn:connection?.provisionRoleArn??row.provisionRoleArn,externalIdSecretReference:connection?.externalIdSecretReference??row.externalIdSecretReference,provisioningStatus:connection?.provisioningStatus??'DISABLED',provisioningEnabled:connection?.provisioningEnabled??false,lastValidatedAt:connection?.lastValidatedAt?.toISOString(),lastSuccessfulReadAt:connection?.lastSuccessfulReadAt?.toISOString(),lastSuccessfulProvisionAt:connection?.lastSuccessfulProvisionAt?.toISOString(),lastErrorCode:connection?.lastErrorCode,lastErrorMessage:connection?.lastErrorMessage};
}

export class AwsAccountRepository{
 constructor(private db:any=prisma){}
 private memory(tenantId:string){return identityDomain.allAccounts().filter(account=>account.tenantId===tenantId&&account.sourceType==='MANUAL'&&!account.isDemo)}
 async getManualAccountsForConnectionPage(tenantId:string):Promise<AwsAccountContext[]>{
  if(env.NODE_ENV==='test'&&this.db===prisma)return this.memory(tenantId);
  const rows:any[]=await this.db.awsAccount.findMany({where:{tenantId,sourceType:'MANUAL',isDemo:false},include:{connection:true},orderBy:{accountName:'asc'}}),accounts=rows.map(mapAwsAccount);
  identityDomain.replaceManualAccounts(tenantId,accounts);return accounts;
 }
 async refreshManualAccounts(tenantId:string){return this.getManualAccountsForConnectionPage(tenantId)}
 async getManualAccountsForTenant(tenantId:string){return this.getManualAccountsForConnectionPage(tenantId)}
 async getUsableConnectedAccountsForAwsOperations(tenantId:string,user?:SessionUser){const accounts=(await this.getManualAccountsForConnectionPage(tenantId)).filter(account=>account.hasConnection&&account.connectionSource==='MANUAL'&&account.connectionStatus==='CONNECTED');return user?accounts.filter(account=>identityDomain.account(user,account.id)!==undefined):accounts}
 async getConnectedAccountsForTenant(tenantId:string){return this.getUsableConnectedAccountsForAwsOperations(tenantId)}
 async getAuthorisedAccountsForUser(user:SessionUser,tenantId:string){if(user.activeTenantId!==tenantId)return [];return (await this.getUsableConnectedAccountsForAwsOperations(tenantId)).filter(account=>identityDomain.account(user,account.id)!==undefined)}
 async getByRecordId(tenantId:string,accountRecordId:string){if(env.NODE_ENV==='test'&&this.db===prisma)return identityDomain.allAccounts().find(account=>account.tenantId===tenantId&&account.id===accountRecordId);const row=await this.db.awsAccount.findFirst({where:{tenantId,id:accountRecordId},include:{connection:true}});return row?mapAwsAccount(row):undefined}
 async getByAwsAccountNumber(tenantId:string,awsAccountNumber:string){if(env.NODE_ENV==='test'&&this.db===prisma)return identityDomain.allAccounts().find(account=>account.tenantId===tenantId&&account.accountId===awsAccountNumber);const row=await this.db.awsAccount.findUnique({where:{tenantId_accountId:{tenantId,accountId:awsAccountNumber}},include:{connection:true}});return row?mapAwsAccount(row):undefined}
 async getAccountConnection(tenantId:string,identifier:string){return (await this.getByRecordId(tenantId,identifier))??(await this.getByAwsAccountNumber(tenantId,identifier))}
 async findExistingForTenant(tenantId:string,awsAccountNumber:string){return this.getByAwsAccountNumber(tenantId,awsAccountNumber)}

 async onboardManualAccount(tenantId:string,input:ManualAccountInput):Promise<{account:AwsAccountContext;outcome:OnboardingOutcome;prismaConflictRecovered:boolean}>{
  const run=async(prismaConflictRecovered:boolean)=>this.db.$transaction(async(tx:any)=>{
   const existing=await tx.awsAccount.findUnique({where:{tenantId_accountId:{tenantId,accountId:input.awsAccountNumber}},include:{connection:true}});
   if(existing){
    if(existing.sourceType!=='MANUAL'||existing.isDemo)return {account:mapAwsAccount(existing),outcome:'CONVERSION_REQUIRED' as const,prismaConflictRecovered};
    if(!existing.connection){
     await tx.awsAccountConnection.create({data:this.connectionData(tenantId,existing.id,input,existing)});
     const repaired=await tx.awsAccount.findUniqueOrThrow({where:{id:existing.id},include:{connection:true}});
     return {account:mapAwsAccount(repaired),outcome:'REPAIRED' as const,prismaConflictRecovered};
    }
    return {account:mapAwsAccount(existing),outcome:'EXISTING' as const,prismaConflictRecovered};
   }
   const created=await tx.awsAccount.create({data:{tenantId,accountId:input.awsAccountNumber,accountName:input.accountName,accountType:input.accountType,environment:input.accountType.toLowerCase(),riskTier:['MANAGEMENT','SECURITY','PRODUCTION'].includes(input.accountType)?'HIGH':'MODERATE',region:input.defaultRegion,connectionType:input.connectionType,connectionStatus:'PENDING',readRoleArn:input.readRoleArn,provisionRoleArn:input.provisionRoleArn,externalIdSecretReference:input.externalIdSecretReference,sourceType:'MANUAL',isDemo:false,manuallyCreatedAt:new Date(),connection:{create:this.connectionData(tenantId,undefined,input)}} ,include:{connection:true}});
   return {account:mapAwsAccount(created),outcome:'CREATED' as const,prismaConflictRecovered};
  });
  try{return await run(false)}catch(error){if((error as {code?:string})?.code!=='P2002')throw error;return run(true)}
 }

 async repairMissingConnection(tenantId:string,accountRecordId:string){return this.db.$transaction(async(tx:any)=>{const row=await tx.awsAccount.findFirst({where:{tenantId,id:accountRecordId},include:{connection:true}});if(!row)throw new Error('ACCOUNT_NOT_FOUND');if(row.sourceType!=='MANUAL'||row.isDemo)throw new Error('CONVERSION_REQUIRED');if(!row.connection)await tx.awsAccountConnection.create({data:this.connectionData(tenantId,row.id,{accountName:row.accountName,awsAccountNumber:row.accountId,accountType:row.accountType,defaultRegion:row.region,connectionType:row.connectionType==='ASSUME_ROLE'?'ASSUME_ROLE':'LOCAL_DEFAULT_CREDENTIALS',readRoleArn:row.readRoleArn,provisionRoleArn:row.provisionRoleArn,externalIdSecretReference:row.externalIdSecretReference},row)});return mapAwsAccount(await tx.awsAccount.findUniqueOrThrow({where:{id:row.id},include:{connection:true}}))})}
 async convertToManual(tenantId:string,accountRecordId:string){return this.db.$transaction(async(tx:any)=>{const row=await tx.awsAccount.findFirst({where:{tenantId,id:accountRecordId},include:{connection:true}});if(!row)throw new Error('ACCOUNT_NOT_FOUND');await tx.awsAccount.update({where:{id:row.id},data:{sourceType:'MANUAL',isDemo:false,manuallyCreatedAt:new Date(),connectionStatus:'PENDING'}});await tx.awsAccountConnection.upsert({where:{awsAccountId:row.id},create:this.connectionData(tenantId,row.id,{accountName:row.accountName,awsAccountNumber:row.accountId,accountType:row.accountType,defaultRegion:row.region,connectionType:row.connection?.connectionType??(row.connectionType==='ASSUME_ROLE'?'ASSUME_ROLE':'LOCAL_DEFAULT_CREDENTIALS'),readRoleArn:row.connection?.readRoleArn??row.readRoleArn,provisionRoleArn:row.connection?.provisionRoleArn??row.provisionRoleArn,externalIdSecretReference:row.connection?.externalIdSecretReference??row.externalIdSecretReference}),update:{connectionSource:'MANUAL',connectionStatus:'PENDING',lastErrorCode:null,lastErrorMessage:null}});return mapAwsAccount(await tx.awsAccount.findUniqueOrThrow({where:{id:row.id},include:{connection:true}}))})}
 private connectionData(tenantId:string,awsAccountId:string|undefined,input:ManualAccountInput,row?:any){return {tenantId,...(awsAccountId?{awsAccountId}:{}),connectionType:input.connectionType,connectionSource:'MANUAL',readRoleArn:input.readRoleArn??row?.readRoleArn,provisionRoleArn:input.provisionRoleArn??row?.provisionRoleArn,externalIdSecretReference:input.externalIdSecretReference??row?.externalIdSecretReference,defaultRegion:input.defaultRegion,connectionStatus:'PENDING',provisioningStatus:'DISABLED',provisioningEnabled:false}}
}
export const awsAccountRepository=new AwsAccountRepository();
