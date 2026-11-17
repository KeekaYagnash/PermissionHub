import { bootstrapLambdaEnvironment } from './bootstrap.js';

export async function handler(event: unknown) {
  await bootstrapLambdaEnvironment();
  const {processProvisioningJob}=await import('../services/provisioning-worker.service.js');
  const records=(event as {Records?:{messageId:string;body:string}[]})?.Records;
  if(!Array.isArray(records))throw new Error('SQS_EVENT_REQUIRED');
  const batchItemFailures:{itemIdentifier:string}[]=[];
  for(const record of records){try{const payload=JSON.parse(record.body) as {jobId?:string};if(!payload.jobId||typeof payload.jobId!=='string')throw new Error('INVALID_PROVISIONING_MESSAGE');await processProvisioningJob(payload.jobId);}catch{batchItemFailures.push({itemIdentifier:record.messageId});}}
  return {batchItemFailures};
}
