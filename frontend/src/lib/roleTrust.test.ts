import {it,expect} from 'vitest';
import {buildRoleTrustPolicy,roleTrustError} from './roleTrust';
it('restricts a wildcard AWS principal to the selected account',()=>{expect(buildRoleTrustPolicy('AWS','*','123456789012')).toMatchObject({Statement:[{Principal:{AWS:'*'},Condition:{StringEquals:{'aws:PrincipalAccount':'123456789012'}}}]})});
it('never generates wildcard trust without scope',()=>{expect(buildRoleTrustPolicy('AWS','*')).toBeUndefined();expect(roleTrustError('AWS','*')).toContain('Select an AWS account')});
it('keeps service principals explicit and rejects invalid values',()=>{expect(buildRoleTrustPolicy('SERVICE','lambda.amazonaws.com')).toMatchObject({Statement:[{Principal:{Service:'lambda.amazonaws.com'}}]});expect(buildRoleTrustPolicy('SERVICE','*','123456789012')).toBeUndefined()});
