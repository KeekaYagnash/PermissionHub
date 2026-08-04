import { afterEach,describe,expect,it } from 'vitest';
import { env } from '../config/env.js';
import { configuredAuthProvider,DevelopmentAuthProvider } from './auth-provider.service.js';

const originalNodeEnv=env.NODE_ENV,originalDevAuth=env.ENABLE_DEV_AUTH;
afterEach(()=>{env.NODE_ENV=originalNodeEnv;env.ENABLE_DEV_AUTH=originalDevAuth});
describe('authentication provider safety',()=>{
 it('configures only the local development provider',()=>{expect(configuredAuthProvider()).toBeInstanceOf(DevelopmentAuthProvider)});
 it('never permits development authentication in production',async()=>{env.NODE_ENV='production';env.ENABLE_DEV_AUTH=true;await expect(new DevelopmentAuthProvider().authenticate('user_requester_dev')).rejects.toMatchObject({code:'DEV_AUTH_DISABLED'})});
});
