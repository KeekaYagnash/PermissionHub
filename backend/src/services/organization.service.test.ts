import {describe,it,expect} from 'vitest';
import {newProof,tokenHash,scopeForRole,verifiedEmail,organizationRoles} from './organization.service.js';
import {identityDomain} from './identity-domain.service.js';
describe('onboarding security primitives',()=>{
 it('generates independent 256-bit proofs with non-reversible stored digests',()=>{const a=newProof(),b=newProof();expect(a).toMatch(/^[\w-]{43}$/);expect(a).not.toBe(b);expect(tokenHash(a)).toHaveLength(64);expect(tokenHash(a)).not.toBe(a)});
 it('requires a trusted verified email claim, never a submitted email',()=>{const user=identityDomain.sessionUserFromCognito({sub:'subject',email:'Test@Example.com',emailVerified:false});expect(()=>verifiedEmail(user)).toThrow('Verify');expect(verifiedEmail({...user,emailVerified:true})).toBe('test@example.com')});
 it('never assigns platform administration through organization roles',()=>{expect(organizationRoles).not.toContain('PLATFORM_ADMIN');expect(scopeForRole('REQUESTER','one')).toMatchObject({scopeId:'one',canApprove:false,canProvision:false,canManageConfiguration:false});expect(scopeForRole('PROVISIONER','one')).toMatchObject({canProvision:true,canApprove:false});expect(scopeForRole('ORGANISATION_ADMIN','one')).toMatchObject({scopeType:'TENANT',scopeId:'one',canManageConfiguration:true})});
});
