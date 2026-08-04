import { env } from '../config/env.js';
import { prisma as db } from '../config/database.js';

const value=(name:string)=>{const index=process.argv.indexOf(name),result=index>=0?process.argv[index+1]:undefined;if(!result)throw new Error(`${name} is required.`);return result};
async function main(){
 if(env.NODE_ENV==='production')throw new Error('AWS account repair is disabled in production.');
 const dryRun=process.argv.includes('--dry-run'),confirmed=process.argv.includes('--confirm');if(!dryRun&&!confirmed)throw new Error('Use --dry-run or pass --confirm to repair the account.');
 const accountId=value('--account-id'),tenantIndex=process.argv.indexOf('--tenant-id'),tenantId=tenantIndex>=0?process.argv[tenantIndex+1]:undefined;
 try{const rows=await db.awsAccount.findMany({where:{accountId,tenantId},include:{connection:true}});if(!rows.length)throw new Error('No matching AWS account record was found.');if(rows.length>1&&!tenantId)throw new Error('Multiple tenants contain this AWS account. Re-run with --tenant-id to select exactly one tenant.');
  const proposed=rows.map(row=>({internalAccountId:row.id,tenantId:row.tenantId,currentSourceType:row.sourceType,currentDemoFlag:row.isDemo,connectionPresent:Boolean(row.connection),proposedSourceType:'MANUAL',proposedDemoFlag:false,proposedConnectionSource:'MANUAL',proposedConnectionStatus:'PENDING',action:row.connection?'Convert the existing connection to manual and reset it to pending.':'Create the missing manual connection in pending state.'}));console.log(JSON.stringify({dryRun,accountId,proposed},null,2));if(dryRun)return;
  for(const row of rows)await db.$transaction([db.awsAccount.update({where:{id:row.id},data:{sourceType:'MANUAL',isDemo:false,manuallyCreatedAt:new Date(),connectionStatus:'PENDING'}}),db.awsAccountConnection.upsert({where:{awsAccountId:row.id},create:{tenantId:row.tenantId,awsAccountId:row.id,connectionType:row.connection?.connectionType??(row.connectionType==='ASSUME_ROLE'?'ASSUME_ROLE':'LOCAL_DEFAULT_CREDENTIALS'),connectionSource:'MANUAL',readRoleArn:row.connection?.readRoleArn??row.readRoleArn,provisionRoleArn:row.connection?.provisionRoleArn??row.provisionRoleArn,externalIdSecretReference:row.connection?.externalIdSecretReference??row.externalIdSecretReference,defaultRegion:row.connection?.defaultRegion??row.region,connectionStatus:'PENDING',provisioningStatus:'DISABLED',provisioningEnabled:false},update:{connectionSource:'MANUAL',connectionStatus:'PENDING',lastErrorCode:null,lastErrorMessage:null}})]);
  console.log('Repair completed. The connection remains PENDING until STS and IAM validation succeeds.')
 }finally{await db.$disconnect()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
