import { describe,expect,it } from 'vitest';
import type { AwsAccountContext } from '../types.js';
import { recoverableConflict,assertAccountOrganization } from './aws-account.routes.js';

const account=(overrides:Partial<AwsAccountContext>={}):AwsAccountContext=>({id:'internal-1',tenantId:'tenant-1',accountId:'143671530412',accountName:'Existing',accountType:'SANDBOX',environment:'sandbox',riskTier:'LOW',region:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',connectionStatus:'PENDING',sourceType:'MANUAL',connectionSource:'MANUAL',hasConnection:true,isDemo:false,...overrides});
describe('account organization ownership',()=>{
 it('derives ownership from the active server tenant without requiring a client tenant ID',()=>expect(assertAccountOrganization('active-tenant',{accountId:'123456789012'})).toBe('active-tenant'));
 it.each(['tenantId','organizationId','organisationId'])('rejects a conflicting client %s',field=>expect(()=>assertAccountOrganization('active-tenant',{[field]:'unrelated-tenant'})).toThrow('active organization'));
 it('requires an active organization',()=>expect(()=>assertAccountOrganization('',{})).toThrow('Select an organization'));
});
describe('AWS account conflict responses',()=>{it('identifies a legacy collision with an explicit recovery code and record identifier',()=>{const error=recoverableConflict(account({sourceType:'DEMO_SEED',isDemo:true}),'LEGACY_ACCOUNT_CONFLICT','Conversion required.');expect(error).toMatchObject({status:409,code:'LEGACY_ACCOUNT_CONFLICT',details:{existingAccountRecordId:'internal-1',existingAwsAccountNumber:'143671530412',sourceType:'DEMO_SEED',canConvert:true,canRemove:true}})})});
