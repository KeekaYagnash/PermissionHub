import { GetCallerIdentityCommand,STSClient } from '@aws-sdk/client-sts';
import { env } from '../config/env.js';

const result=await new STSClient({region:env.AWS_REGION}).send(new GetCallerIdentityCommand({}));
console.log(JSON.stringify({Account:result.Account,Arn:result.Arn,UserId:result.UserId},null,2));
