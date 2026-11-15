import {describe,expect,it} from 'vitest';
import {describeEmailFailure,emailConfigurationError} from './email-diagnostics.js';

describe('safe email delivery diagnostics',()=>{
 it.each([
  [{name:'AccessDeniedException'},'EMAIL_ACCESS_DENIED'],
  [{name:'AccessDeniedException',message:'no permissions boundary allows ses:SendEmail'},'EMAIL_BOUNDARY_DENIED'],
  [{name:'MessageRejected',message:'Email address is not verified: secret-recipient@example.invalid'},'EMAIL_IDENTITY_NOT_VERIFIED'],
  [{name:'ThrottlingException'},'EMAIL_THROTTLED'],
  [{name:'Error',code:'ENETUNREACH'},'EMAIL_TIMEOUT'],
  [{name:'AbortError'},'EMAIL_TIMEOUT'],
  [{name:'CredentialsProviderError'},'EMAIL_CREDENTIALS_UNAVAILABLE'],
  [{code:'P2021'},'EMAIL_STORAGE_UNAVAILABLE']
 ])('maps known causes without exposing raw errors', (error,code)=>expect(describeEmailFailure(error).code).toBe(code));
 it('preserves only validated AWS request IDs, never recipient addresses, bodies or secrets',()=>{
  const safe=describeEmailFailure({name:'MessageRejected',message:'not verified secret-recipient@example.invalid token=private-proof secret-access-key',request:{body:'private'},$metadata:{requestId:'12345678-abcd-1234-abcd-123456789012',httpHeaders:{authorization:'secret'}}});
  expect(safe.awsRequestId).toBe('12345678-abcd-1234-abcd-123456789012');
  expect(JSON.stringify(safe)).not.toMatch(/secret-recipient|private-proof|secret-access-key|authorization|httpHeaders/);
  expect(describeEmailFailure({name:'secret-key-goes-here',message:'token=private',$metadata:{requestId:'recipient@example.invalid'}})).toMatchObject({code:'EMAIL_DELIVERY_FAILED'});
  expect(describeEmailFailure({$metadata:{requestId:'recipient@example.invalid'}})).not.toHaveProperty('awsRequestId');
 });
 it('reports disabled delivery as configuration failure rather than successful local logging',()=>expect(describeEmailFailure(emailConfigurationError('EMAIL_DISABLED'))).toMatchObject({code:'EMAIL_DISABLED',retryable:false}));
});
