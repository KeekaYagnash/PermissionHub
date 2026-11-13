import { IdentitystoreClient,ListGroupsCommand,ListUsersCommand } from '@aws-sdk/client-identitystore';
import { ListAccountAssignmentsCommand,ListInstancesCommand,ListPermissionSetsCommand,SSOAdminClient } from '@aws-sdk/client-sso-admin';
import { env } from '../../config/env.js';
import type { AwsAccountContext,SessionUser } from '../../types.js';
import { ApiError } from '../../utils/http.js';
import { awsConnectionBroker } from './connection-broker.service.js';

export class AwsIdentityCenterDiscoveryService{
 async discover(actor:SessionUser,account:AwsAccountContext){
  if(!env.IDENTITY_CENTER_ENABLED)throw new ApiError(403,'IAM Identity Center discovery is disabled.','FEATURE_DISABLED');
  const credentials=await awsConnectionBroker.getReadCredentials(actor,account.id),sso=new SSOAdminClient({region:account.region,credentials});
  const instances=(await sso.send(new ListInstancesCommand({}))).Instances??[],instance=env.IDENTITY_CENTER_INSTANCE_ARN?instances.find(item=>item.InstanceArn===env.IDENTITY_CENTER_INSTANCE_ARN):instances[0];
  if(!instance?.InstanceArn||!instance.IdentityStoreId)throw new ApiError(404,'No visible IAM Identity Center instance is configured.','IDENTITY_CENTER_INSTANCE_NOT_FOUND');
  const permissionSets=await paginate<string>(token=>sso.send(new ListPermissionSetsCommand({InstanceArn:instance.InstanceArn,NextToken:token})),value=>value.PermissionSets??[]);
  const assignments=[];for(const permissionSetArn of permissionSets)assignments.push(...await paginate(token=>sso.send(new ListAccountAssignmentsCommand({InstanceArn:instance.InstanceArn,AccountId:account.accountId,PermissionSetArn:permissionSetArn,NextToken:token})),value=>value.AccountAssignments??[]));
  const store=new IdentitystoreClient({region:account.region,credentials}),identityStoreId=env.IDENTITY_STORE_ID??instance.IdentityStoreId;
  const [users,groups]=await Promise.all([paginate(token=>store.send(new ListUsersCommand({IdentityStoreId:identityStoreId,NextToken:token})),value=>value.Users??[]),paginate(token=>store.send(new ListGroupsCommand({IdentityStoreId:identityStoreId,NextToken:token})),value=>value.Groups??[])]);
  return {instance:{instanceArn:instance.InstanceArn,identityStoreId},permissionSets,assignments,users,groups};
 }
}
async function paginate<T>(load:(token?:string)=>Promise<{NextToken?:string}>,items:(value:any)=>T[]){const result:T[]=[];let token:undefined|string;do{const page=await load(token);result.push(...items(page));token=page.NextToken}while(token);return result}
