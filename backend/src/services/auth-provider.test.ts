import { afterEach,describe,expect,it } from 'vitest';
import { env } from '../config/env.js';
import { configuredAuthProvider,DevelopmentAuthProvider } from './auth-provider.service.js';
import {configureSessionOrganisation,identityDomain} from './identity-domain.service.js';

const originalNodeEnv=env.NODE_ENV,originalDevAuth=env.ENABLE_DEV_AUTH;
afterEach(()=>{env.NODE_ENV=originalNodeEnv;env.ENABLE_DEV_AUTH=originalDevAuth});
describe('authentication provider safety',()=>{
 it('does not enroll unknown Cognito users into an existing tenant',()=>{
  const user=identityDomain.sessionUserFromCognito({sub:'new-subject',email:'new@example.com',emailVerified:true,groups:['ORGANISATION_ADMIN']});
  expect(user.memberships).toEqual([]);
  expect(user.activeTenantId).toBeUndefined();
 });
 it('does not let the same company name claim another owner tenant',()=>{
  const first=identityDomain.sessionUserFromCognito({sub:'first',email:'first@example.com'});
  const second=identityDomain.sessionUserFromCognito({sub:'second',email:'second@example.com'});
  configureSessionOrganisation(first,'Example Company');configureSessionOrganisation(second,'Example Company');
  expect(first.activeTenantId).not.toBe(second.activeTenantId);
  expect(first.memberships[0]?.tenantName).toBe('Example Company');
  expect(first.memberships[0]?.tenantId).toBe(first.activeTenantId);
 });
 it('configures only the local development provider',()=>{expect(configuredAuthProvider()).toBeInstanceOf(DevelopmentAuthProvider)});
 it('never permits development authentication in production',async()=>{env.NODE_ENV='production';env.ENABLE_DEV_AUTH=true;await expect(new DevelopmentAuthProvider().authenticate('user_requester_dev')).rejects.toMatchObject({code:'DEV_AUTH_DISABLED'})});
});
