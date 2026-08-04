import { describe,expect,it } from 'vitest';
import { conflictFrom } from '../pages/Connection';

describe('AWS account onboarding conflicts',()=>{it('extracts a recoverable structured conflict',()=>{const conflict=conflictFrom({response:{data:{error:{code:'AWS_ACCOUNT_ALREADY_EXISTS',message:'This AWS account already exists for the active tenant.',existingAccountId:'account-1',connectionStatus:'PENDING',sourceType:'MANUAL',canValidate:true,canEdit:true,canRemove:true}}}});expect(conflict).toMatchObject({existingAccountId:'account-1',connectionStatus:'PENDING',canValidate:true})});it('ignores unrelated API failures',()=>expect(conflictFrom({response:{data:{error:{code:'FORBIDDEN'}}}})).toBeUndefined())});
