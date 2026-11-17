import {SQSClient,SendMessageCommand} from '@aws-sdk/client-sqs';
import type {AuthenticatedRequest} from '../types.js';
import {prisma} from '../config/database.js';
import {ApiError} from '../utils/http.js';
import {logger} from '../config/logger.js';
import {randomUUID} from 'node:crypto';
import type {PermissionRequest} from '../types.js';
export interface QueuedProvisioningContext {actorUserId:string;tenantId:string;accountRecordId:string;correlationId?:string;approvalId?:string}
export const useProvisioningQueue=()=>Boolean(process.env.PROVISIONING_QUEUE_URL)&&process.env.NODE_ENV!=='test'&&process.env.VITEST!=='true';
export const jobContext=(req:AuthenticatedRequest):QueuedProvisioningContext=>({actorUserId:req.sessionUser!.id,tenantId:req.tenantId!,accountRecordId:req.awsAccountContext!.id,correlationId:req.correlationId});
export async function dispatchProvisioningJob(jobId:string){
 try{await new SQSClient({region:process.env.APP_AWS_REGION??process.env.AWS_REGION}).send(new SendMessageCommand({QueueUrl:process.env.PROVISIONING_QUEUE_URL!,MessageBody:JSON.stringify({jobId})}));}
 catch{logger.error({jobId,code:'PROVISIONING_ENQUEUE_FAILED'},'Approved provisioning job awaits queue delivery');throw new ApiError(503,'Approval was saved, but the provisioning job could not be queued. Retry the same action; approval will not be duplicated.','PROVISIONING_ENQUEUE_FAILED');}
}
export async function redeliverReviewJob(jobId:string){const job=await prisma.provisioningJob.findUnique({where:{id:jobId}});if(job?.status==='QUEUED')await dispatchProvisioningJob(job.id);}
export async function queueApprovedRequest(request:PermissionRequest,context:QueuedProvisioningContext){
 const id=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${request.id}))::text`;
  const current=await tx.request.findFirst({where:{id:request.id,tenantId:context.tenantId,status:{in:['APPROVED','PROVISIONING_FAILED']}}});
  if(!current)throw new ApiError(409,'This request is not ready for provisioning.','INVALID_PROVISIONING_STATE');
  const pending=await tx.provisioningJob.findFirst({where:{requestId:request.id,status:{in:['QUEUED','RUNNING']}}});if(pending)return pending.id;
  return (await tx.provisioningJob.create({data:{id:randomUUID(),requestId:request.id,mode:'LIVE',operation:'PROVISION',status:'QUEUED',response:{...context}}})).id;
 });
 await dispatchProvisioningJob(id);return {request,provisioning:{mode:'live',queued:true,executed:false,jobId:id,message:'Approved provisioning job queued.'}};
}
