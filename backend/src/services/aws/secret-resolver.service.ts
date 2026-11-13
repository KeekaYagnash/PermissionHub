import { GetSecretValueCommand,SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/http.js';

export interface SecretResolver {getSecret(reference:string):Promise<string>}
export class AwsSecretsManagerResolver implements SecretResolver{
 constructor(private client=new SecretsManagerClient({region:env.AWS_REGION})){}
 async getSecret(reference:string){const response=await this.client.send(new GetSecretValueCommand({SecretId:reference}));if(!response.SecretString)throw new ApiError(502,'The configured connection secret is unavailable.','CONNECTION_SECRET_UNAVAILABLE');return response.SecretString}
}
export class DevelopmentSecretResolver implements SecretResolver{
 async getSecret(reference:string){
  if(env.NODE_ENV==='production')throw new ApiError(500,'Development secret resolution is disabled in production.','SECRET_RESOLVER_DISABLED');
  const key=reference.startsWith('env:')?reference.slice(4):`${env.AWS_DEV_SECRET_PREFIX}${reference.replace(/[^A-Za-z0-9_]/g,'_').toUpperCase()}`;
  const value=process.env[key];if(!value)throw new ApiError(502,'The configured development connection secret is unavailable.','CONNECTION_SECRET_UNAVAILABLE');return value;
 }
}
export class CompositeSecretResolver implements SecretResolver{
 constructor(private aws=new AwsSecretsManagerResolver(),private development=new DevelopmentSecretResolver()){}
 getSecret(reference:string){return reference.startsWith('env:')?this.development.getSecret(reference):this.aws.getSecret(reference)}
}
export const secretResolver:SecretResolver=new CompositeSecretResolver();
