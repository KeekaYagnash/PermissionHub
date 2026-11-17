import {prisma} from '../config/database.js';
import {requestRepository} from './request.repository.js';
import {identityDomain} from './identity-domain.service.js';
import {awsAccountRepository} from './aws-account.repository.js';
import {authorization} from './authorization.service.js';
import {buildProvisioningPlan,effectiveApprovalStages,provisioningMode} from './request-review.service.js';
import {runProvisioning,preparePolicyNameRetry,type ProvisioningRequestContext} from '../routes/api.routes.js';
import {logger} from '../config/logger.js';
import type {SessionUser} from '../types.js';
import type {QueuedProvisioningContext} from './provisioning-queue.service.js';
function failureCode(error:unknown){const value=error as {name?:string;code?:string;message?:string};return [value?.code,value?.name,value?.message].find(code=>Boolean(code&&(/^[A-Z_]{3,80}$/.test(code)||['AccessDenied','AccessDeniedException','NoSuchEntity','Throttling','ThrottlingException','LimitExceeded'].includes(code))))??'PROVISIONING_JOB_FAILED'}

export async function processProvisioningJob(jobId:string){
 const job=await prisma.provisioningJob.findUnique({where:{id:jobId}});
 if(!job)throw new Error('PROVISIONING_JOB_NOT_FOUND');
 if(['SUCCEEDED','FAILED'].includes(job.status))return; // duplicate delivery; manual retry creates another attempt
 if(job.status!=='QUEUED')throw new Error('PROVISIONING_ATTEMPT_REQUIRES_RECONCILIATION');
 const claim=await prisma.provisioningJob.updateMany({where:{id:jobId,status:'QUEUED'},data:{status:'RUNNING'}});
 if(claim.count!==1)throw new Error('PROVISIONING_JOB_ALREADY_RUNNING');
 const context=job.response as unknown as QueuedProvisioningContext;
 let request:Awaited<ReturnType<typeof requestRepository.find>>;
 try{
  request=await requestRepository.find(job.requestId);
  if(!request||!context?.actorUserId||context.tenantId!==request.tenantId)throw new Error('PROVISIONING_TENANT_MISMATCH');
  if(request.status==='Provisioned'){await prisma.provisioningJob.update({where:{id:jobId},data:{status:'SUCCEEDED',completedAt:new Date()}});return;}
  const member=await prisma.tenantMembership.findFirst({where:{userId:context.actorUserId,tenantId:context.tenantId,status:'ACTIVE',tenant:{status:'ACTIVE'},user:{status:'ACTIVE'}},include:{tenant:true,user:true,adminScopes:true}});
  if(!member)throw new Error('PROVISIONING_ACTOR_NOT_AUTHORIZED');
  const actor:SessionUser={id:member.userId,email:member.user.email,displayName:member.user.displayName,provider:'worker',providerSubject:member.userId,activeTenantId:context.tenantId,activeAwsAccountRecordId:context.accountRecordId,permissions:[],memberships:[{id:member.id,tenantId:member.tenantId,tenantName:member.tenant.name,tenantSlug:member.tenant.slug,role:member.role,status:member.status,scopes:member.adminScopes}]};
  await awsAccountRepository.refreshManualAccounts(context.tenantId);
  const account=identityDomain.account(actor,context.accountRecordId);
  if(!account||account.tenantId!==request.tenantId||![account.id,account.accountId].includes(request.awsAccountId??''))throw new Error('PROVISIONING_ACCOUNT_MISMATCH');
  if(!authorization.canProvisionRequest(actor,{...request,awsAccountId:account.id}))throw new Error('PROVISIONING_FORBIDDEN');
  if(!effectiveApprovalStages(request).every((stage,index)=>request!.completedApprovalStages?.[index]===stage))throw new Error('REQUIRED_APPROVALS_INCOMPLETE');
  if(provisioningMode()!=='live')throw new Error('LIVE_PROVISIONING_DISABLED');
  if(request.expiryDate&&Date.parse(request.expiryDate)<=Date.now())throw new Error('REQUEST_EXPIRED');
  if(request.status==='Provisioning failed')preparePolicyNameRetry(request);
  const plan=buildProvisioningPlan(request,account);if(!plan.valid)throw new Error('INCOMPLETE_PROVISIONING_PLAN');
  const req:ProvisioningRequestContext={sessionUser:actor,tenantId:context.tenantId,awsAccountContext:account,correlationId:context.correlationId,params:{id:request.id}};
  const result=await runProvisioning(req,request,plan);
  if(result.request.status!=='Provisioned')throw new Error('PROVISIONING_PREREQUISITES_FAILED');
  await requestRepository.save(request,undefined,undefined,'Provisioning');
  await prisma.provisioningJob.update({where:{id:jobId},data:{status:'SUCCEEDED',completedAt:new Date(),response:{...context,result:JSON.parse(JSON.stringify(result.provisioning))}}});
 }catch(error){
  // Detailed sanitized AWS errors are recorded by the shared executor. Do not log raw policies/credentials.
  logger.error({jobId,requestId:job.requestId,tenantId:context?.tenantId,accountRecordId:context?.accountRecordId,correlationId:context?.correlationId,code:'PROVISIONING_JOB_FAILED'},'Provisioning attempt failed');
  if((error as {code?:string}).code==='REQUEST_PERSISTENCE_FAILED')throw error; // Do not acknowledge uncertain AWS/DB completion.
  if(request&&request.tenantId===context?.tenantId&&request.awsAccountId===context?.accountRecordId&&['Approved','Provisioning'].includes(request.status)){const previousStatus=request.status;request.status='Provisioning failed';const previous=request.provisioningResult&&typeof request.provisioningResult==='object'?request.provisioningResult as Record<string,unknown>:{};request.provisioningResult={...previous,executed:false,error:previous.message??`${failureCode(error)}: Provisioning could not complete. Review account connection and provisioning prerequisites.`,jobId};request.timeline.push({label:'Provisioning failed',timestamp:new Date().toISOString()});await requestRepository.save(request,undefined,undefined,previousStatus);}
  await prisma.provisioningJob.update({where:{id:jobId},data:{status:'FAILED',completedAt:new Date(),error:failureCode(error)}});
 }
}
