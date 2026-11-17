import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {IAMClient,CreateRoleCommand,CreateUserCommand,AttachUserPolicyCommand,AttachRolePolicyCommand} from '@aws-sdk/client-iam';
vi.mock('../../config/env.js',()=>({env:{AWS_REGION:'af-south-1',AWS_CONNECTION_MODE:'manual',AWS_PROVISIONING_MODE:'live'},liveProvisioningEnabled:true,isLocalProvisioningEnabled:()=>false}));
import {IamIdentityService,IamProvisioningService,AwsConnectionService} from './aws-services.js';
const trust={Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]};
let send:ReturnType<typeof vi.spyOn>;
beforeEach(()=>{send=vi.spyOn(IAMClient.prototype,'send');vi.spyOn(AwsConnectionService.prototype,'status').mockResolvedValue({connected:true,mode:'LIVE',accountId:'123456789012',region:'af-south-1',principalArn:'mock',lastChecked:new Date().toISOString()} as Awaited<ReturnType<AwsConnectionService['status']>>)});
afterEach(()=>vi.restoreAllMocks());
it.each(['getUser','getRole'] as const)('%s treats only NoSuchEntity as absence for creation, never AccessDenied',async method=>{
 send.mockRejectedValueOnce(Object.assign(new Error('missing'),{name:'NoSuchEntity'})).mockRejectedValueOnce(Object.assign(new Error('denied'),{name:'AccessDenied'}));
 const service=new IamIdentityService();expect(await service[method]('test-target')).toBeUndefined();await expect(service[method]('test-target')).rejects.toThrow('denied');expect(send.mock.calls.every((call:unknown[])=>!(call[0] instanceof CreateRoleCommand||call[0] instanceof CreateUserCommand))).toBe(true);
});
it('creates a role only after absence is confirmed, preserving requested duration and server ownership tags',async()=>{
 send.mockRejectedValueOnce(Object.assign(new Error('missing'),{name:'NoSuchEntity'})).mockResolvedValueOnce({Role:{Arn:'arn:aws:iam::123456789012:role/Test'},$metadata:{requestId:'mock-create'}});
 await new IamProvisioningService(undefined,undefined,'TES-PR-1001').createRole({roleName:'Test',assumeRolePolicyDocument:trust,maxSessionDuration:7200,tags:{ManagedBy:'not-trusted',PermissionHubRequestId:'other'}});
 const command=send.mock.calls[1]![0] as CreateRoleCommand;expect(command).toBeInstanceOf(CreateRoleCommand);expect(command.input.MaxSessionDuration).toBe(7200);expect(command.input.Tags).toEqual(expect.arrayContaining([{Key:'ManagedBy',Value:'PermissionHub'},{Key:'PermissionHubRequestId',Value:'TES-PR-1001'}]));
});
it('never reuses or overwrites an unrelated existing role or user',async()=>{
 send.mockResolvedValueOnce({Role:{Arn:'other-role',Tags:[]},$metadata:{}}).mockResolvedValueOnce({User:{Arn:'other-user',Tags:[]},$metadata:{}});
 const service=new IamProvisioningService(undefined,undefined,'TES-PR-1001');await expect(service.createRole({roleName:'Test',assumeRolePolicyDocument:trust})).rejects.toThrow('ROLE_NAME_CONFLICT');await expect(service.createUser('Test')).rejects.toThrow('USER_NAME_CONFLICT');expect(send.mock.calls.some((call:unknown[])=>call[0] instanceof CreateRoleCommand||call[0] instanceof CreateUserCommand)).toBe(false);
});
it.each(['USER','ROLE'] as const)('uses the correct IAM attach operation and requires read-back confirmation for %s',async targetType=>{
 const arn='arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess';send.mockResolvedValueOnce({AttachedPolicies:[]}).mockResolvedValueOnce({$metadata:{requestId:'mock-attach'}}).mockResolvedValueOnce({AttachedPolicies:[{PolicyArn:arn}]});
 const result=await new IamProvisioningService().attach({targetType,targetName:'Test',policyArn:arn});expect(send.mock.calls[1]![0]).toBeInstanceOf(targetType==='USER'?AttachUserPolicyCommand:AttachRolePolicyCommand);expect(result.changed).toBe(true);
});
