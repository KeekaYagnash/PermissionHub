import {beforeEach,it,expect,vi} from 'vitest';
const processJob=vi.hoisted(()=>vi.fn());
vi.mock('./bootstrap.js',()=>({bootstrapLambdaEnvironment:vi.fn()}));
vi.mock('../services/provisioning-worker.service.js',()=>({processProvisioningJob:processJob}));
import {handler} from './provisioning.js';
beforeEach(()=>vi.resetAllMocks());
it('processes real job IDs and reports only unsuccessful SQS records for retry',async()=>{
 processJob.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('database unavailable'));
 const response=await handler({Records:[{messageId:'one',body:'{"jobId":"job-one"}'},{messageId:'two',body:'{"jobId":"job-two"}'}]});
 expect(processJob).toHaveBeenNthCalledWith(1,'job-one');expect(processJob).toHaveBeenNthCalledWith(2,'job-two');expect(response).toEqual({batchItemFailures:[{itemIdentifier:'two'}]});
});
it('does not acknowledge malformed or legacy placeholder queue messages as success',async()=>{
 expect(await handler({Records:[{messageId:'invalid',body:'{}'}]})).toEqual({batchItemFailures:[{itemIdentifier:'invalid'}]});expect(processJob).not.toHaveBeenCalled();
});
