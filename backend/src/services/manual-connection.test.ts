import { GetCallerIdentityCommand,type STSClient } from '@aws-sdk/client-sts';
import { afterEach,describe,expect,it,vi } from 'vitest';
import type { AwsAccountContext } from '../types.js';
import { developmentUsers,identityDomain } from './identity-domain.service.js';
import { AwsConnectionBroker } from './aws/connection-broker.service.js';
import { env } from '../config/env.js';

const tenantId='tenant_disraptor_dev',manual:AwsAccountContext={id:'manual_test_account',tenantId,accountId:'123456789012',accountName:'Manual test',accountType:'SANDBOX',environment:'sandbox',riskTier:'LOW',region:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',connectionStatus:'PENDING',sourceType:'MANUAL',connectionSource:'MANUAL',isDemo:false};
const actor=()=>identityDomain.sessionUser(developmentUsers.find(user=>user.id==='user_org_admin_dev')!,'development');

describe('manual AWS connection isolation',()=>{
 afterEach(()=>identityDomain.removeManualAccount(tenantId,manual.id));
 it('does not expose demo organisations, OUs, or accounts in manual mode',()=>{const user=actor();expect(identityDomain.organisationsFor(user)).toEqual([]);expect(identityDomain.ousFor(user)).toEqual([]);expect(identityDomain.accountsFor(user)).toEqual([])});
 it('returns an explicitly added manual account only within its tenant',()=>{identityDomain.addManualAccount(manual);expect(identityDomain.accountsFor(actor()).map(account=>account.id)).toEqual([manual.id]);const other={...actor(),activeTenantId:'another-tenant'};expect(identityDomain.accountsFor(other)).toEqual([])});
 it('rejects a local default credential account mismatch',async()=>{identityDomain.addManualAccount(manual);const send=vi.fn(async(command:unknown)=>{if(command instanceof GetCallerIdentityCommand)return {Account:'999999999999',Arn:'arn:aws:iam::999999999999:user/test'};throw new Error('Unexpected operation')});const broker=new AwsConnectionBroker({stsFactory:()=>({send} as unknown as STSClient)});await expect(broker.validateAccountConnection(actor(),manual.id)).rejects.toMatchObject({code:'AWS_ACCOUNT_MISMATCH'})});
 it('gives only the configured development identity explicit connection administration',()=>{const previous={auth:env.AUTH_ENABLED,enabled:env.ENABLE_DEV_AUTH,user:env.DEV_AUTH_USER_ID};env.AUTH_ENABLED=false;env.ENABLE_DEV_AUTH=true;env.DEV_AUTH_USER_ID='user_requester_dev';try{const configured=identityDomain.sessionUser(developmentUsers.find(user=>user.id==='user_requester_dev')!,'development'),other=identityDomain.sessionUser(developmentUsers.find(user=>user.id==='user_approver_dev')!,'development');expect(configured.memberships[0]!.scopes).toEqual(expect.arrayContaining([expect.objectContaining({scopeType:'TENANT',canManageConfiguration:true,canProvision:false})]));expect(other.memberships[0]!.scopes.some(scope=>scope.canManageConfiguration&&scope.scopeType==='TENANT')).toBe(false)}finally{env.AUTH_ENABLED=previous.auth;env.ENABLE_DEV_AUTH=previous.enabled;env.DEV_AUTH_USER_ID=previous.user}});
});
