import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();

async function main(){
 if(process.env.NODE_ENV==='production')throw new Error('Development seed data must not be loaded in production.');
 const tenant=await prisma.tenant.upsert({where:{slug:'disraptor'},update:{},create:{id:'tenant_disraptor_dev',name:'Disraptor',slug:'disraptor'}});
 const organisation=await prisma.awsOrganisation.upsert({where:{tenantId_organisationId:{tenantId:tenant.id,organisationId:'o-exampledev'}},update:{},create:{id:'org_disraptor_dev',tenantId:tenant.id,organisationId:'o-exampledev',organisationName:'Disraptor Organisation',managementAccountId:'111122223333',connectionStatus:'CONNECTED'}});
 const ouDefs=[['ou_production_dev','ou-example-prod','Production'],['ou_development_dev','ou-example-dev','Development'],['ou_security_dev','ou-example-sec','Security']] as const;
 for(const [id,ouId,name] of ouDefs)await prisma.awsOrganisationalUnit.upsert({where:{awsOrganisationId_ouId:{awsOrganisationId:organisation.id,ouId}},update:{},create:{id,awsOrganisationId:organisation.id,ouId,name,fullPath:`/Disraptor/${name}`}});
 const accountDefs=[
  ['account_prod_payments_dev','111122223334','Production Payments','ou_production_dev','PRODUCTION','HIGH'],
  ['account_sandbox_dev','111122223335','Development Sandbox','ou_development_dev','DEVELOPMENT','LOW'],
  ['account_security_dev','111122223336','Security Tooling','ou_security_dev','SECURITY','CRITICAL']
 ] as const;
 for(const [id,accountId,accountName,ouId,accountType,riskTier] of accountDefs){
  const account=await prisma.awsAccount.upsert({where:{tenantId_accountId:{tenantId:tenant.id,accountId}},update:{},create:{id,tenantId:tenant.id,awsOrganisationId:organisation.id,ouId,accountId,accountName,accountType,environment:accountType.toLowerCase(),riskTier,region:'af-south-1',connectionType:id==='account_sandbox_dev'?'DEFAULT_CHAIN':'ASSUME_ROLE',connectionStatus:id==='account_sandbox_dev'?'CONNECTED':'DISCONNECTED',readRoleArn:`arn:aws:iam::${accountId}:role/PermissionHubReadRole`,provisionRoleArn:`arn:aws:iam::${accountId}:role/PermissionHubProvisionRole`}});
  await prisma.awsAccountConnection.upsert({where:{awsAccountId:account.id},update:{},create:{tenantId:tenant.id,awsAccountId:account.id,connectionType:id==='account_sandbox_dev'?'LOCAL_DEVELOPMENT':'ORGANISATION_MEMBER',readRoleArn:`arn:aws:iam::${accountId}:role/PermissionHubReadRole`,provisionRoleArn:`arn:aws:iam::${accountId}:role/PermissionHubProvisionRole`,defaultRegion:'af-south-1',organisationsRegion:'us-east-1',connectionStatus:id==='account_sandbox_dev'?'CONNECTED':'PENDING',provisioningStatus:'DISABLED',provisioningEnabled:false}});
 }
 const users=[
  ['user_org_admin_dev','org.admin@disraptor.example','Organisation Admin','ORGANISATION_ADMIN'],
  ['user_ou_admin_dev','ou.admin@disraptor.example','Production OU Admin','OU_ADMIN'],
  ['user_approver_dev','approver@disraptor.example','Account Approver','ACCOUNT_APPROVER'],
  ['user_requester_dev','requester@disraptor.example','Permission Requester','REQUESTER'],
  ['user_security_dev','security.reviewer@disraptor.example','Security Reviewer','SECURITY_REVIEWER'],
  ['user_provisioner_dev','provisioner@disraptor.example','Access Provisioner','PROVISIONER']
 ] as const;
 for(const [id,email,displayName,role] of users){const user=await prisma.user.upsert({where:{email},update:{},create:{id,email,displayName}});await prisma.authIdentity.upsert({where:{provider_providerSubject:{provider:'development',providerSubject:id.replace('user_','dev-').replace('_dev','')}},update:{},create:{userId:user.id,provider:'development',providerSubject:id.replace('user_','dev-').replace('_dev',''),providerEmail:email}});const membership=await prisma.tenantMembership.upsert({where:{tenantId_userId:{tenantId:tenant.id,userId:user.id}},update:{role},create:{id:`membership_${id}`,tenantId:tenant.id,userId:user.id,role}});const scopeType=role==='OU_ADMIN'?'ORGANISATIONAL_UNIT':role==='ACCOUNT_APPROVER'||role==='REQUESTER'?'AWS_ACCOUNT':'TENANT';const scopeId=role==='OU_ADMIN'?'ou_production_dev':role==='ACCOUNT_APPROVER'?'account_prod_payments_dev':role==='REQUESTER'?'account_sandbox_dev':tenant.id;await prisma.adminScope.upsert({where:{tenantMembershipId_scopeType_scopeId:{tenantMembershipId:membership.id,scopeType,scopeId}},update:{},create:{tenantMembershipId:membership.id,scopeType,scopeId,canView:true,canRequest:role==='REQUESTER'||role==='OU_ADMIN'||role==='ORGANISATION_ADMIN',canApprove:['ACCOUNT_APPROVER','OU_ADMIN','SECURITY_REVIEWER','ORGANISATION_ADMIN'].includes(role),canProvision:role==='PROVISIONER'||role==='ORGANISATION_ADMIN',canRevoke:role==='PROVISIONER'||role==='ORGANISATION_ADMIN',canManageConfiguration:role==='ORGANISATION_ADMIN'||role==='OU_ADMIN'}})}
 const policyDefaults=[['Development access','DEVELOPMENT',['ACCOUNT_APPROVER'],720,true,true],['Production access','PRODUCTION',['ACCOUNT_APPROVER','SECURITY_REVIEWER','PROVISIONER'],168,false,false],['Security account access','SECURITY',['SECURITY_REVIEWER','ORGANISATION_ADMIN','PROVISIONER'],24,false,false],['Management account access','MANAGEMENT',['ORGANISATION_ADMIN','SECURITY_REVIEWER','PROVISIONER'],8,false,false]] as const;
 for(const [name,accountType,stages,maximumDuration,permanentAccessAllowed,automaticProvisioningAllowed] of policyDefaults)await prisma.approvalPolicy.create({data:{tenantId:tenant.id,name,accountType,requiredApprovalStages:stages,maximumDuration,permanentAccessAllowed,automaticProvisioningAllowed}}).catch(()=>undefined);
 console.log('Seeded development-only PermissionHub tenant, users, scopes, organisation, OUs, accounts and approval policies.');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect());
