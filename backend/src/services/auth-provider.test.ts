import { afterEach,describe,expect,it } from 'vitest';
import { env } from '../config/env.js';
import { DevelopmentAuthProvider,OidcAuthProvider } from './auth-provider.service.js';

const originalNodeEnv=env.NODE_ENV,originalDevAuth=env.ENABLE_DEV_AUTH;
afterEach(()=>{env.NODE_ENV=originalNodeEnv;env.ENABLE_DEV_AUTH=originalDevAuth});
describe('authentication provider safety',()=>{
 it('rejects a callback without state, nonce, and PKCE verifier',async()=>{await expect(new OidcAuthProvider().handleCallback({currentUrl:'http://localhost/callback'})).rejects.toMatchObject({code:'AUTH_TRANSACTION_EXPIRED'})});
 it('never permits development authentication in production',async()=>{env.NODE_ENV='production';env.ENABLE_DEV_AUTH=true;await expect(new DevelopmentAuthProvider().authenticate('user_requester_dev')).rejects.toMatchObject({code:'DEV_AUTH_DISABLED'})});
});
