import type { AwsAccountContext,IamIdentity } from '../types.js';
import { IamIdentityService } from './aws/aws-services.js';

export type AccessTargetProviderType='IAM_IDENTITY_CENTER'|'IAM_USER'|'IAM_ROLE'|'IAM_GROUP';
export interface AccessTargetQuery {account:AwsAccountContext;search?:string;limit?:number}
export interface AccessTargetProvider {readonly type:AccessTargetProviderType;listTargets(query:AccessTargetQuery):Promise<IamIdentity[]>;getTarget(account:AwsAccountContext,id:string):Promise<IamIdentity|undefined>}

export class IamUserTargetProvider implements AccessTargetProvider {readonly type='IAM_USER';async listTargets(query:AccessTargetQuery){return new IamIdentityService(query.account).listUsers(query.search,query.limit)}async getTarget(account:AwsAccountContext,id:string){return new IamIdentityService(account).getUser(id)}}
export class IamRoleTargetProvider implements AccessTargetProvider {readonly type='IAM_ROLE';async listTargets(query:AccessTargetQuery){return new IamIdentityService(query.account).listRoles(query.search,false,query.limit)}async getTarget(account:AwsAccountContext,id:string){return new IamIdentityService(account).getRole(id)}}
export class DeferredIdentityCenterTargetProvider implements AccessTargetProvider {readonly type='IAM_IDENTITY_CENTER';async listTargets(){return []}async getTarget(){return undefined}}

export class AccessTargetProviderRegistry {private providers=new Map<AccessTargetProviderType,AccessTargetProvider>([['IAM_USER',new IamUserTargetProvider()],['IAM_ROLE',new IamRoleTargetProvider()],['IAM_IDENTITY_CENTER',new DeferredIdentityCenterTargetProvider()]]);get(type:AccessTargetProviderType){const provider=this.providers.get(type);if(!provider)throw new Error(`Access target provider ${type} is not configured.`);return provider}}
export const accessTargetProviders=new AccessTargetProviderRegistry();
