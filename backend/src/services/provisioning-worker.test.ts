import {beforeEach,it,expect,vi} from 'vitest';
import type {PermissionRequest} from '../types.js';
const mocks=vi.hoisted(()=>({findJob:vi.fn(),claim:vi.fn(),updateJob:vi.fn(),member:vi.fn(),findRequest:vi.fn(),save:vi.fn(),refresh:vi.fn(),account:vi.fn(),authorized:vi.fn(),execute:vi.fn()}));
vi.mock('../config/database.js',()=>({prisma:{provisioningJob:{findUnique:mocks.findJob,updateMany:mocks.claim,update:mocks.updateJob},tenantMembership:{findFirst:mocks.member}}}));
vi.mock('./request.repository.js',()=>({requestRepository:{find:mocks.findRequest,save:mocks.save}}));
vi.mock('./aws-account.repository.js',()=>({awsAccountRepository:{refreshManualAccounts:mocks.refresh}}));
vi.mock('./identity-domain.service.js',()=>({identityDomain:{account:mocks.account}}));
vi.mock('./authorization.service.js',()=>({authorization:{canProvisionRequest:mocks.authorized}}));
vi.mock('./request-review.service.js',()=>({effectiveApprovalStages:()=>['ACCOUNT_APPROVER'],provisioningMode:()=> 'live',buildProvisioningPlan:()=>({valid:true})}));
vi.mock('../routes/api.routes.js',()=>({runProvisioning:mocks.execute,preparePolicyNameRetry:vi.fn()}));
import {processProvisioningJob} from './provisioning-worker.service.js';
let request:PermissionRequest;
beforeEach(()=>{
 vi.resetAllMocks();request={id:'TES-PR-1001',tenantId:'tenant',awsAccountId:'account',status:'Approved',completedApprovalStages:['ACCOUNT_APPROVER'],timeline:[]} as unknown as PermissionRequest;
 mocks.findJob.mockResolvedValue({id:'job',requestId:request.id,status:'QUEUED',response:{tenantId:'tenant',accountRecordId:'account',actorUserId:'actor'}});mocks.claim.mockResolvedValue({count:1});mocks.findRequest.mockImplementation(async()=>request);
 mocks.member.mockResolvedValue({id:'membership',userId:'actor',tenantId:'tenant',role:'PROVISIONER',status:'ACTIVE',user:{email:'actor@example.invalid',displayName:'Actor'},tenant:{name:'Test',slug:'test'},adminScopes:[]});
 mocks.account.mockReturnValue({id:'account',tenantId:'tenant',accountId:'123456789012'});mocks.authorized.mockReturnValue(true);mocks.execute.mockImplementation(async()=>{request.status='Provisioned';return {request,provisioning:{executed:true}}});
});
it.each(['USER','ROLE'] as const)('uses the normal guarded provisioning pipeline for an approved IAM %s job and persists completion',async type=>{
 request.targetType=type;await processProvisioningJob('job');expect(mocks.execute).toHaveBeenCalledOnce();expect(mocks.save).toHaveBeenCalledWith(request,undefined,undefined,'Provisioning');expect(mocks.updateJob).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'SUCCEEDED'})}));
});
it('does not execute duplicate succeeded jobs or concurrently claimed jobs',async()=>{
 mocks.findJob.mockResolvedValueOnce({status:'SUCCEEDED'});await processProvisioningJob('job');expect(mocks.execute).not.toHaveBeenCalled();mocks.claim.mockResolvedValue({count:0});await expect(processProvisioningJob('job')).rejects.toThrow('ALREADY_RUNNING');expect(mocks.execute).not.toHaveBeenCalled();
});
it.each(['tenant','account','authorization','approval'] as const)('blocks %s violations before any AWS execution',async kind=>{
 if(kind==='tenant')request.tenantId='other';if(kind==='account')request.awsAccountId='other';if(kind==='authorization')mocks.authorized.mockReturnValue(false);if(kind==='approval')request.completedApprovalStages=[];
 await processProvisioningJob('job');expect(mocks.execute).not.toHaveBeenCalled();expect(mocks.updateJob).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'FAILED'})}));
});
it('persists a failed attempt without reporting success when execution fails',async()=>{
 mocks.execute.mockRejectedValue(new Error('AccessDenied'));await processProvisioningJob('job');expect(request.status).toBe('Provisioning failed');expect(mocks.updateJob).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'FAILED'})}));
});
it('does not acknowledge uncertain database persistence after an AWS operation',async()=>{
 mocks.save.mockRejectedValue(Object.assign(new Error('database unavailable'),{code:'REQUEST_PERSISTENCE_FAILED'}));await expect(processProvisioningJob('job')).rejects.toThrow('database unavailable');expect(mocks.updateJob).not.toHaveBeenCalled();
});
