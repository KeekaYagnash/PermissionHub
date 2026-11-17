import {beforeEach,it,expect,vi} from 'vitest';
import {SQSClient} from '@aws-sdk/client-sqs';
import type {PermissionRequest} from '../types.js';
const db=vi.hoisted(()=>({lock:vi.fn(),findRequest:vi.fn(),findJob:vi.fn(),createJob:vi.fn(),lookup:vi.fn()}));
vi.mock('../config/database.js',()=>({prisma:{$transaction:async(run:(tx:unknown)=>Promise<unknown>)=>run({$queryRaw:db.lock,request:{findFirst:db.findRequest},provisioningJob:{findFirst:db.findJob,create:db.createJob}}),provisioningJob:{findUnique:db.lookup}}}));
import {queueApprovedRequest,redeliverReviewJob} from './provisioning-queue.service.js';
const context={actorUserId:'actor',tenantId:'tenant',accountRecordId:'account'},request={id:'TES-PR-1001'} as PermissionRequest;
beforeEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();db.findRequest.mockResolvedValue({id:request.id});db.findJob.mockResolvedValue(null);db.createJob.mockResolvedValue({id:'job'});vi.spyOn(SQSClient.prototype,'send').mockResolvedValue({} as never)});
it('serializes creation and sends only a persisted job ID, never credentials or policy data',async()=>{
 const result=await queueApprovedRequest(request,context);expect(db.lock).toHaveBeenCalledOnce();expect(db.createJob).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'QUEUED',response:context})}));expect(result.provisioning).toMatchObject({queued:true,executed:false,jobId:'job'});expect(SQSClient.prototype.send).toHaveBeenCalledWith(expect.objectContaining({input:expect.objectContaining({MessageBody:'{"jobId":"job"}'})}));
});
it('reuses a pending attempt on repeated provisioning clicks',async()=>{
 db.findJob.mockResolvedValue({id:'existing-job'});await queueApprovedRequest(request,context);expect(db.createJob).not.toHaveBeenCalled();expect(SQSClient.prototype.send).toHaveBeenCalledWith(expect.objectContaining({input:expect.objectContaining({MessageBody:'{"jobId":"existing-job"}'})}));
});
it('reports failed queue delivery without undoing persisted approval and can redeliver the same queued job',async()=>{
 vi.mocked(SQSClient.prototype.send).mockRejectedValueOnce(new Error('mock unavailable') as never);await expect(queueApprovedRequest(request,context)).rejects.toMatchObject({code:'PROVISIONING_ENQUEUE_FAILED'});expect(db.createJob).toHaveBeenCalledOnce();db.lookup.mockResolvedValue({id:'job',status:'QUEUED'});await redeliverReviewJob('job');expect(SQSClient.prototype.send).toHaveBeenCalledTimes(2);
});
it('does not enqueue a non-approved request or redeliver a completed attempt',async()=>{
 db.findRequest.mockResolvedValue(null);await expect(queueApprovedRequest(request,context)).rejects.toMatchObject({code:'INVALID_PROVISIONING_STATE'});db.lookup.mockResolvedValue({id:'job',status:'SUCCEEDED'});await redeliverReviewJob('job');expect(SQSClient.prototype.send).not.toHaveBeenCalled();
});
