import { afterEach,describe,expect,it,vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { awsAccountRepository } from '../services/aws-account.repository.js';
import { awsConnectionBroker } from '../services/aws/connection-broker.service.js';
import { IamIdentityService,IamPolicyService } from '../services/aws/aws-services.js';
import type { AwsAccountContext } from '../types.js';

const recordId='00000000-0000-4000-8000-000000000001';
const pending=(overrides:Partial<AwsAccountContext>={}):AwsAccountContext=>({id:recordId,accountRecordId:recordId,tenantId:'tenant_disraptor_dev',accountId:'143671530412',awsAccountNumber:'143671530412',accountName:'Disraptor',accountType:'PRODUCTION',environment:'production',riskTier:'HIGH',region:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',connectionStatus:'PENDING',sourceType:'MANUAL',connectionSource:'MANUAL',hasConnection:true,isDemo:false,...overrides});

const originalLiveMode=env.AWS_LIVE_MODE;
afterEach(()=>{(env as {AWS_LIVE_MODE:string}).AWS_LIVE_MODE=originalLiveMode;vi.restoreAllMocks()});

describe('manual AWS onboarding HTTP workflow',()=>{
 it('recovers, validates, activates, and permits IAM reads without a preselected account',async()=>{
  (env as {AWS_LIVE_MODE:string}).AWS_LIVE_MODE='true';
  const agent=request.agent(app),initial=await agent.get('/api/auth/session').expect(200),login=await agent.post('/api/auth/development-login').set('x-csrf-token',initial.body.data.csrfToken).send({userId:'user_org_admin_dev'}).expect(200),csrf=login.body.data.csrfToken;
  let current=pending({connectionStatus:'REPAIR_REQUIRED',hasConnection:false,connectionSource:undefined});
  vi.spyOn(awsAccountRepository,'getManualAccountsForConnectionPage').mockImplementation(async()=>[current]);
  vi.spyOn(awsAccountRepository,'onboardManualAccount').mockImplementation(async()=>{current=pending();return {account:current,outcome:'REPAIRED',prismaConflictRecovered:false}});
  vi.spyOn(awsAccountRepository,'getByRecordId').mockImplementation(async(_tenant,id)=>id===recordId?current:undefined);
  vi.spyOn(prisma.awsAccount,'update').mockResolvedValue({} as never);vi.spyOn(prisma.awsAccountConnection,'update').mockResolvedValue({} as never);vi.spyOn(prisma,'$transaction').mockImplementation(async(value:any)=>Array.isArray(value)?Promise.all(value):value(prisma) as never);
  vi.spyOn(awsConnectionBroker,'validateAccountConnection').mockResolvedValue({accountId:'143671530412',principalArn:'arn:aws:iam::143671530412:user/test',userId:'test-user',region:'af-south-1',connected:true,mode:'READ',connectionStatus:'CONNECTED',lastValidatedAt:new Date().toISOString()});
  vi.spyOn(awsConnectionBroker,'validate').mockResolvedValue({accountId:'143671530412',principalArn:'arn:aws:iam::143671530412:user/test',userId:'test-user',region:'af-south-1'});
  vi.spyOn(awsConnectionBroker,'testReadCapabilities').mockResolvedValue({accountValidated:true,iamUsersReadable:true,iamRolesReadable:true,policiesReadable:true,policyValidationAvailable:false,provisionRoleConfigured:false,details:{users:{available:true},roles:{available:true},policies:{available:true}}});
  vi.spyOn(IamIdentityService.prototype,'listUsers').mockResolvedValue([{id:'developer',type:'USER',name:'developer',arn:'arn:aws:iam::143671530412:user/developer',path:'/',createdAt:new Date().toISOString(),attachedPolicies:[],inlinePolicies:[]}]);
  vi.spyOn(IamPolicyService.prototype,'list').mockResolvedValue({items:[],nextCursor:undefined,isComplete:true,loadedCount:0,cacheStatus:'HIT',timing:{firstPageMs:1,totalMs:1,apiCalls:0}});

  const before=await agent.get('/api/aws/accounts').expect(200);expect(before.body.data[0]).toMatchObject({accountRecordId:recordId,awsAccountNumber:'143671530412',connectionStatus:'REPAIR_REQUIRED'});
  const recovered=await agent.post('/api/aws/accounts').set('x-csrf-token',csrf).send({accountName:'Disraptor',accountId:'143671530412',accountType:'PRODUCTION',defaultRegion:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',validateLater:true}).expect(200);expect(recovered.body.data).toMatchObject({onboardingResult:'REPAIRED',account:{accountRecordId:recordId,connectionStatus:'PENDING'}});
  const validated=await agent.post(`/api/aws/accounts/${recordId}/validate`).set('x-csrf-token',csrf).send({}).expect(200);expect(validated.body.data).toMatchObject({success:true,actualAwsAccountNumber:'143671530412',status:'CONNECTED',activeAccountSet:true});current=pending({connectionStatus:'CONNECTED'});
  const activated=await agent.post('/api/aws/active-account').set('x-csrf-token',csrf).send({accountRecordId:recordId}).expect(200);expect(activated.body.data.activeAwsAccountRecordId).toBe(recordId);
  await agent.get('/api/aws/connection').expect(200).expect(response=>expect(response.body.data).toMatchObject({mode:'LIVE',connected:true,accountId:'143671530412'}));
  await agent.get('/api/aws/identities/users').expect(200).expect(response=>expect(response.body.data[0].name).toBe('developer'));
  await agent.get('/api/aws/policies').expect(200).expect(response=>expect(response.body.cacheStatus).toBe('HIT'));
  const refreshed=await agent.get('/api/auth/session').expect(200);expect(refreshed.body.data.user.activeAwsAccountRecordId).toBe(recordId);
 });
});
