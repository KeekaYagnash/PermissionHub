import 'dotenv/config';
import { developmentUsers,identityDomain } from '../services/identity-domain.service.js';

const value=(name:string)=>{const index=process.argv.indexOf(name),result=index>=0?process.argv[index+1]:undefined;if(!result)throw new Error(`${name} is required.`);return result};
async function main(){
 if(process.env.NODE_ENV==='production')throw new Error('AWS account inspection is disabled in production.');
 process.env.DATABASE_URL??='postgresql://permissionhub:permissionhub@localhost:5432/permissionhub';
 const { PrismaClient }=await import('@prisma/client'),db=new PrismaClient(),accountId=value('--account-id');
 try{const rows=await db.awsAccount.findMany({where:{accountId},include:{connection:true},orderBy:{tenantId:'asc'}}),configuredUser=developmentUsers.find(user=>user.id===(process.env.DEV_AUTH_USER_ID??'user_org_admin_dev'));
  const user=configuredUser?identityDomain.sessionUser(configuredUser,'development'):undefined;
  const output=rows.map(row=>{
   const connection=row.connection;
   const authorised=Boolean(user?.memberships.some(membership=>membership.tenantId===row.tenantId&&membership.status==='ACTIVE'&&membership.scopes.some(scope=>scope.canView&&((scope.scopeType==='TENANT'&&scope.scopeId===row.tenantId)||(scope.scopeType==='AWS_ACCOUNT'&&(scope.scopeId===row.id||scope.scopeId===row.accountId))))));
   return {internalAccountId:row.id,tenantId:row.tenantId,accountName:row.accountName,sourceType:row.sourceType,isDemo:row.isDemo,connectionRecordPresent:Boolean(connection),connectionType:connection?.connectionType??row.connectionType,connectionStatus:connection?.connectionStatus??'PENDING',disabled:connection?.connectionStatus==='DISABLED',currentUserAuthorised:authorised,visibleInConnectionPage:row.sourceType==='MANUAL'&&!row.isDemo,visibleInActiveAccountSelector:row.sourceType==='MANUAL'&&!row.isDemo&&connection?.connectionSource==='MANUAL'&&connection?.connectionStatus==='CONNECTED'};
  });
  console.log(JSON.stringify(output,null,2))
 }
 finally{await db.$disconnect()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
