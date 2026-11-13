// Destructive-by-definition EMPTY TEST database validation. Never accepts an AWS URL.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PrismaClient,Prisma} from '@prisma/client';
const value=process.env.MIGRATION_TEST_DATABASE_URL;
if(!value)throw Error('Set MIGRATION_TEST_DATABASE_URL to a disposable empty local PostgreSQL database.');
const url=new URL(value);
if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/permissionhub_migration_test_[a-z0-9_]+$/.test(url.pathname))throw Error('Refusing non-local/non-test database. AWS and application databases are forbidden.');
const root=resolve(import.meta.dirname,'../..'),schema=resolve(root,'backend/prisma/schema.prisma'),cli=resolve(root,'node_modules/prisma/build/index.js');
const database=new PrismaClient({datasourceUrl:value});
function prisma(args){const result=spawnSync(process.execPath,[cli,...args],{cwd:root,env:{...process.env,DATABASE_URL:value},encoding:'utf8'});if(result.status!==0)throw Error(`Prisma validation command failed (${result.status}): ${(result.stderr+result.stdout).replaceAll(value,'[local test database]')}`);return result.stdout}
try{
 const before=await database.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
 assert.equal(before.length,0,'Test requires an empty database; never resets an existing one.');
 prisma(['migrate','deploy','--schema',schema]);
 prisma(['migrate','deploy','--schema',schema]); // Repeat must be a no-op, not duplicate tables.
 prisma(['migrate','status','--schema',schema]);
 prisma(['migrate','diff','--from-schema-datasource',schema,'--to-schema-datamodel',schema,'--exit-code']);
 const tables=await database.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'`;
 assert.deepEqual(tables.map(t=>t.tablename).sort(),Prisma.dmmf.datamodel.models.map(m=>m.dbName??m.name).sort());
 const applied=await database.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
 assert.equal(applied[0].migration_name,'20260801000000_initial_legacy_schema');
 const id=randomUUID();
 await database.$transaction(async tx=>{
  await tx.user.create({data:{id,email:`${id}@example.invalid`,displayName:'Migration test'}});
  await tx.tenant.create({data:{id,name:'Isolated migration test',slug:id}});
  await tx.tenantMembership.create({data:{id,tenantId:id,userId:id,role:'REQUESTER'}});
  await tx.awsAccount.create({data:{id,tenantId:id,accountId:'123456789012',accountName:'Not an AWS connection',accountType:'DEVELOPMENT',environment:'test',riskTier:'LOW',region:'af-south-1',connectionType:'ACCESS_KEYS'}});
  await tx.request.create({data:{id,title:'Migration integration test',tenantId:id,awsAccountId:id,requesterUserId:id,requester:'Migration test',approver:'Reviewer',targetType:'USER',targetName:'test',targetArn:'arn:aws:iam::123456789012:user/test',scope:{type:'ALL',resources:[]},duration:'1 day',startDate:new Date(),priority:'Normal',justification:'Validate fresh database persistence without any AWS calls.',items:{create:{mode:'SPECIFIC_ACTIONS',actions:['s3:ListBucket'],generatedPolicyDocument:{Statement:[]}}}}});
 });
 await assert.rejects(database.tenantMembership.create({data:{tenantId:id,userId:'missing-user',role:'REQUESTER'}}),error=>error.code==='P2003');
 await assert.rejects(database.tenantMembership.create({data:{tenantId:id,userId:id,role:'REQUESTER'}}),error=>error.code==='P2002');
 await database.request.delete({where:{id}});
 assert.equal(await database.requestItem.count({where:{requestId:id}}),0,'Request item cascade must work.');
 const indexes=await database.$queryRaw`SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname='public'`;
 const foreignKeys=await database.$queryRaw`SELECT count(*)::int AS count FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY'`;
 const version=await database.$queryRaw`SHOW server_version`;
 console.log(JSON.stringify({postgres:version[0].server_version,migrations:applied.length,tables:tables.length,indexes:indexes[0].count,foreignKeys:foreignKeys[0].count,schemaDrift:0,secondDeploy:'no-op',persistenceAndConstraints:'passed'}));
 const onboarding=spawnSync(process.execPath,[resolve(root,'node_modules/tsx/dist/cli.mjs'),resolve(root,'backend/src/scripts/test-onboarding-database.ts')],{cwd:root,env:{...process.env,DATABASE_URL:value,MIGRATION_TEST_DATABASE_URL:value,NODE_ENV:'test',INVITATION_EMAIL_MODE:'disabled'},encoding:'utf8'});
 if(onboarding.status!==0)throw Error(`Local onboarding integration failed: ${(onboarding.stderr+onboarding.stdout).replaceAll(value,'[local test database]')}`);
 console.log(onboarding.stdout.split(/\r?\n/).filter(line=>line.includes('"onboardingIntegration"')).join('\n'));
}finally{await database.$disconnect()}
