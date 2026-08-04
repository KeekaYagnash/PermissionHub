import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import type { AwsAccountContext } from '../types.js';
import { identityDomain } from './identity-domain.service.js';

function mapAccount(row:any):AwsAccountContext{
 const connection=row.connection;
 return {id:row.id,tenantId:row.tenantId,accountId:row.accountId,accountName:row.accountName,accountType:row.accountType,environment:row.environment,riskTier:row.riskTier,region:row.region,connectionType:connection?.connectionType??row.connectionType,connectionStatus:connection?.connectionStatus??row.connectionStatus,sourceType:row.sourceType,isDemo:row.isDemo,connectionSource:connection?.connectionSource,readRoleArn:connection?.readRoleArn??row.readRoleArn,provisionRoleArn:connection?.provisionRoleArn??row.provisionRoleArn,externalIdSecretReference:connection?.externalIdSecretReference??row.externalIdSecretReference,provisioningStatus:connection?.provisioningStatus,provisioningEnabled:connection?.provisioningEnabled,lastValidatedAt:connection?.lastValidatedAt?.toISOString(),lastSuccessfulReadAt:connection?.lastSuccessfulReadAt?.toISOString(),lastSuccessfulProvisionAt:connection?.lastSuccessfulProvisionAt?.toISOString(),lastErrorCode:connection?.lastErrorCode,lastErrorMessage:connection?.lastErrorMessage};
}

export class AwsAccountRepository{
 async refreshManualAccounts(tenantId:string){
  if(env.NODE_ENV==='test')return identityDomain.allAccounts().filter(account=>account.tenantId===tenantId&&account.sourceType==='MANUAL'&&!account.isDemo);
  try{const rows=await prisma.awsAccount.findMany({where:{tenantId,sourceType:'MANUAL',isDemo:false,connection:{connectionSource:'MANUAL'}},include:{connection:true},orderBy:{accountName:'asc'}});const accounts=rows.map(mapAccount);identityDomain.replaceManualAccounts(tenantId,accounts);return accounts}
  catch(error){logger.debug({tenantId,error:error instanceof Error?error.message:'Database unavailable'},'Using current manual account registry');return identityDomain.allAccounts().filter(account=>account.tenantId===tenantId&&account.sourceType==='MANUAL'&&!account.isDemo)}
 }
 async getManualAccountsForTenant(tenantId:string){return this.refreshManualAccounts(tenantId)}
 async getConnectedAccountsForTenant(tenantId:string){return (await this.refreshManualAccounts(tenantId)).filter(account=>['CONNECTED','DEGRADED'].includes(account.connectionStatus))}
 async getAuthorisedAccountsForUser(user:{activeTenantId?:string},tenantId:string){if(user.activeTenantId!==tenantId)return [];return this.refreshManualAccounts(tenantId)}
 async getAccountConnection(tenantId:string,accountId:string){return (await this.refreshManualAccounts(tenantId)).find(account=>account.id===accountId||account.accountId===accountId)}
}
export const awsAccountRepository=new AwsAccountRepository();
