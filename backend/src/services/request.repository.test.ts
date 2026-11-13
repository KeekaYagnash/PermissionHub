import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {PermissionRequest} from '../types.js';

const db=vi.hoisted(()=>({
 query:vi.fn(),create:vi.fn(),claim:vi.fn(),find:vi.fn(),update:vi.fn(),deleteItems:vi.fn(),createItems:vi.fn(),grant:vi.fn(),transaction:vi.fn()
}));
vi.mock('../config/database.js',()=>({prisma:{
 $transaction:db.transaction,request:{updateMany:db.claim,findUnique:db.find}
}}));
import {requestRepository} from './request.repository.js';
import {grants} from './mock.service.js';

const request=():PermissionRequest=>({id:'ORG-PR-1001',tenantId:'tenant-a',awsAccountId:'account-a',requesterUserId:'requester',requester:'Requester',approver:'Reviewer',title:'Read requested data',targetType:'USER',targetName:'alex',targetArn:'arn:aws:iam::123456789012:user/alex',items:[{mode:'SPECIFIC_ACTIONS',generatedPolicyName:'PH-ORG-PR-1001-1',actions:['s3:ListBucket'],generatedPolicyDocument:{Statement:[{Effect:'Allow',Action:'s3:ListBucket',Resource:'*'}]}}],scope:{type:'ALL',resources:[]},duration:'1 day',startDate:new Date().toISOString(),priority:'Normal',justification:'Read data for an approved support task.',status:'Approved',createdAt:new Date().toISOString(),timeline:[]});

beforeEach(()=>{
 vi.stubEnv('VITEST','false');vi.stubEnv('NODE_ENV','development');
 vi.resetAllMocks();
 db.transaction.mockImplementation(async operation=>operation({$queryRaw:db.query,request:{create:db.create,update:db.update},requestItem:{deleteMany:db.deleteItems,createMany:db.createItems},permissionGrant:{upsert:db.grant}}));
});
afterEach(()=>{vi.unstubAllEnvs();grants.splice(0,grants.length,...grants.filter(grant=>grant.id!=='owned-test-grant'))});

describe('PostgreSQL repository boundary (mocked Prisma)',()=>{
 it('allocates the ID under a transaction lock and creates items atomically',async()=>{
  db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{value:'1017'}]);
  const value=request();await requestRepository.create(value);
  expect(db.transaction).toHaveBeenCalledOnce();expect(db.query).toHaveBeenCalledTimes(2);
  expect(value.id).toBe('ORG-PR-1018');
  expect(db.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({id:'ORG-PR-1018',items:{create:[expect.objectContaining({generatedPolicyName:'PH-ORG-PR-1018-1'})]}})}));
 });
 it('fails closed rather than falling back to memory when PostgreSQL rejects a write',async()=>{
  db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{value:'1000'}]);
  db.create.mockRejectedValue(new Error('database unavailable'));
  await expect(requestRepository.create(request())).rejects.toMatchObject({code:'REQUEST_PERSISTENCE_FAILED'});
 });
 it('uses a conditional database claim to prevent duplicate provisioning',async()=>{
  db.claim.mockResolvedValueOnce({count:1}).mockResolvedValueOnce({count:0});
  expect(await requestRepository.claimProvisioning(request())).toBe(true);
  expect(await requestRepository.claimProvisioning(request())).toBe(false);
  expect(db.claim).toHaveBeenCalledWith({where:{id:'ORG-PR-1001',tenantId:'tenant-a',status:{in:['APPROVED','PROVISIONING_FAILED']}},data:{status:'PROVISIONING'}});
 });
 it('rejects a stale approval instead of overwriting another review',async()=>{
  db.update.mockRejectedValue({code:'P2025'});
  await expect(requestRepository.save(request(),[])).rejects.toMatchObject({code:'REVIEW_CONFLICT'});
 });
 it('persists owned grant and membership cleanup metadata with request state',async()=>{
  grants.push({id:'owned-test-grant',requestId:'ORG-PR-1001',targetType:'GROUP',targetName:'Finance',targetArn:'arn:aws:iam::123456789012:group/Finance',policyArn:'GROUP_MEMBERSHIP:Finance',attachedAt:new Date().toISOString(),groupMembersAdded:['alex'],provisioningResponse:{changed:true}});
  await requestRepository.save(request());
  expect(db.grant).toHaveBeenCalledWith(expect.objectContaining({where:{id:'owned-test-grant'},create:expect.objectContaining({provisioningResponse:{response:{changed:true},_permissionHub:{groupMembersAdded:['alex']}}})}));
 });
});
