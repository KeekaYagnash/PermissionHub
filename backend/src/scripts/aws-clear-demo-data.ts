import { prisma } from '../config/database.js';

async function main(){
 if(process.env.NODE_ENV==='production')throw new Error('Demo-data cleanup is disabled in production.');
 const dryRun=process.argv.includes('--dry-run'),confirmed=process.argv.includes('--confirm');
 const [organisations,ous,accounts,connections]=await Promise.all([
  prisma.awsOrganisation.findMany({where:{isDemo:true,sourceType:'DEMO_SEED'},select:{id:true,organisationName:true}}),
  prisma.awsOrganisationalUnit.findMany({where:{isDemo:true,sourceType:'DEMO_SEED'},select:{id:true,name:true}}),
  prisma.awsAccount.findMany({where:{isDemo:true,sourceType:'DEMO_SEED'},select:{id:true,accountId:true,accountName:true}}),
  prisma.awsAccountConnection.findMany({where:{connectionSource:'DEMO_SEED'},select:{id:true,awsAccountId:true}})
 ]);
 console.log(JSON.stringify({dryRun,organisations,organisationalUnits:ous,accounts,connections,activeContextsToClear:[]},null,2));
 if(dryRun)return;
 if(!confirmed)throw new Error('Pass --confirm to delete records explicitly marked DEMO_SEED.');
 await prisma.$transaction([prisma.awsAccountConnection.deleteMany({where:{connectionSource:'DEMO_SEED'}}),prisma.awsAccount.deleteMany({where:{isDemo:true,sourceType:'DEMO_SEED'}}),prisma.awsOrganisationalUnit.deleteMany({where:{isDemo:true,sourceType:'DEMO_SEED'}}),prisma.awsOrganisation.deleteMany({where:{isDemo:true,sourceType:'DEMO_SEED'}})]);
 console.log('Removed only records explicitly marked DEMO_SEED.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1}).finally(()=>prisma.$disconnect());
