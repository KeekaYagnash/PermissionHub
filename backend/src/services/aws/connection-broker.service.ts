import { AccessAnalyzerClient } from '@aws-sdk/client-accessanalyzer';
import { IAMClient } from '@aws-sdk/client-iam';
import { OrganizationsClient } from '@aws-sdk/client-organizations';
import { S3Client } from '@aws-sdk/client-s3';
import { RDSClient } from '@aws-sdk/client-rds';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { SecretsManagerClient,GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { STSClient,AssumeRoleCommand,GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { env } from '../../config/env.js';
import type { AwsAccountContext,SessionUser } from '../../types.js';
import { ApiError } from '../../utils/http.js';

type Purpose='read'|'provision';
type BrokerCredentials={accessKeyId:string;secretAccessKey:string;sessionToken?:string;expiration?:Date};
export class AwsConnectionBroker {
 getOrganisationClient(context:AwsAccountContext){return new OrganizationsClient(this.clientConfig(context,'read'))}
 getIamClient(context:AwsAccountContext,purpose:Purpose='read'){return new IAMClient(this.clientConfig(context,purpose))}
 getS3Client(context:AwsAccountContext){return new S3Client(this.clientConfig(context,'read'))}
 getRdsClient(context:AwsAccountContext){return new RDSClient(this.clientConfig(context,'read'))}
 getLambdaClient(context:AwsAccountContext){return new LambdaClient(this.clientConfig(context,'read'))}
 getAccessAnalyzerClient(context:AwsAccountContext){return new AccessAnalyzerClient(this.clientConfig(context,'read'))}
 async validate(context:AwsAccountContext,actor?:SessionUser){const credentials=context.connectionType==='DEFAULT_CHAIN'?undefined:await this.assumeExecutionRole(context,'read',actor);const response=await new STSClient({region:context.region,credentials}).send(new GetCallerIdentityCommand({}));if(response.Account!==context.accountId)throw new ApiError(409,`The assumed role returned AWS account ${response.Account??'unknown'}, not the configured account.`,'AWS_ACCOUNT_MISMATCH');return {accountId:response.Account,principalArn:response.Arn,region:context.region,connected:true}}
 async assumeExecutionRole(context:AwsAccountContext,purpose:Purpose,actor?:SessionUser):Promise<BrokerCredentials>{
  if(!env.CROSS_ACCOUNT_PROVISIONING_ENABLED&&purpose==='provision')throw new ApiError(403,'Cross-account provisioning is disabled.','CROSS_ACCOUNT_PROVISIONING_DISABLED');
  const roleArn=purpose==='provision'?(context.provisionRoleArn??context.executionRoleArn):(context.readRoleArn??context.executionRoleArn);if(!roleArn)throw new ApiError(422,`No ${purpose} execution role is configured for this account.`,'EXECUTION_ROLE_REQUIRED');
  const ExternalId=context.externalIdSecretReference?await this.resolveExternalId(context.externalIdSecretReference,context.region):undefined;
  const response=await new STSClient({region:context.region}).send(new AssumeRoleCommand({RoleArn:roleArn,RoleSessionName:this.sessionName(actor),DurationSeconds:env.AWS_ROLE_SESSION_DURATION_SECONDS,ExternalId,Tags:actor?[{Key:'PermissionHubActorId',Value:actor.id.slice(0,128)}]:undefined}));
  const credentials=response.Credentials;if(!credentials?.AccessKeyId||!credentials.SecretAccessKey)throw new ApiError(502,'AWS STS did not return temporary role credentials.','ASSUME_ROLE_FAILED');
  return {accessKeyId:credentials.AccessKeyId,secretAccessKey:credentials.SecretAccessKey,sessionToken:credentials.SessionToken,expiration:credentials.Expiration};
 }
 private clientConfig(context:AwsAccountContext,purpose:Purpose){return {region:context.region,credentials:context.connectionType==='DEFAULT_CHAIN'?undefined:()=>this.assumeAndValidate(context,purpose)} as const}
 private async assumeAndValidate(context:AwsAccountContext,purpose:Purpose){const credentials=await this.assumeExecutionRole(context,purpose);const identity=await new STSClient({region:context.region,credentials}).send(new GetCallerIdentityCommand({}));if(identity.Account!==context.accountId)throw new ApiError(409,'Assumed role account validation failed.','AWS_ACCOUNT_MISMATCH');return credentials}
 private async resolveExternalId(reference:string,region:string){const response=await new SecretsManagerClient({region}).send(new GetSecretValueCommand({SecretId:reference}));if(!response.SecretString)throw new ApiError(502,'External ID secret could not be resolved.','EXTERNAL_ID_UNAVAILABLE');return response.SecretString}
 private sessionName(actor?:SessionUser){return `PermissionHub-${(actor?.id??'service').replace(/[^A-Za-z0-9+=,.@_-]/g,'-').slice(0,40)}-${Date.now().toString(36)}`.slice(0,64)}
}

export const awsConnectionBroker=new AwsConnectionBroker();
