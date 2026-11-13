import { describe,expect,it } from 'vitest';
import type { AwsAccountContext } from '../types.js';
import { recoverableConflict } from './aws-account.routes.js';

const account=(overrides:Partial<AwsAccountContext>={}):AwsAccountContext=>({id:'internal-1',tenantId:'tenant-1',accountId:'143671530412',accountName:'Existing',accountType:'SANDBOX',environment:'sandbox',riskTier:'LOW',region:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',connectionStatus:'PENDING',sourceType:'MANUAL',connectionSource:'MANUAL',hasConnection:true,isDemo:false,...overrides});
describe('AWS account conflict responses',()=>{it('identifies a legacy collision with an explicit recovery code and record identifier',()=>{const error=recoverableConflict(account({sourceType:'DEMO_SEED',isDemo:true}),'LEGACY_ACCOUNT_CONFLICT','Conversion required.');expect(error).toMatchObject({status:409,code:'LEGACY_ACCOUNT_CONFLICT',details:{existingAccountRecordId:'internal-1',existingAwsAccountNumber:'143671530412',sourceType:'DEMO_SEED',canConvert:true,canRemove:true}})})});
