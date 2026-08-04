import { GetCallerIdentityCommand,type STSClient } from '@aws-sdk/client-sts';
import { afterEach,describe,expect,it,vi } from 'vitest';
import type { AwsAccountContext } from '../types.js';
import { developmentUsers,identityDomain } from './identity-domain.service.js';
import { AwsConnectionBroker } from './aws/connection-broker.service.js';

const tenantId='tenant_disraptor_dev',manual:AwsAccountContext={id:'manual_test_account',tenantId,accountId:'123456789012',accountName:'Manual test',accountType:'SANDBOX',environment:'sandbox',riskTier:'LOW',region:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',connectionStatus:'PENDING',sourceType:'MANUAL',connectionSource:'MANUAL',isDemo:false};
const actor=()=>identityDomain.sessionUser(developmentUsers.find(user=>user.id==='user_org_admin_dev')!,'development');

describe('manual AWS connection isolation',()=>{
 afterEach(()=>identityDomain.removeManualAccount(tenantId,manual.id));
 it('does not expose demo organisations, OUs, or accounts in manual mode',()=>{const user=actor();expect(identityDomain.organisationsFor(user)).toEqual([]);expect(identityDomain.ousFor(user)).toEqual([]);expect(identityDomain.accountsFor(user)).toEqual([])});
 it('returns an explicitly added manual account only within its tenant',()=>{identityDomain.addManualAccount(manual);expect(identityDomain.accountsFor(actor()).map(account=>account.id)).toEqual([manual.id]);const other={...actor(),activeTenantId:'another-tenant'};expect(identityDomain.accountsFor(other)).toEqual([])});
 it('rejects a local default credential account mismatch',async()=>{identityDomain.addManualAccount(manual);const send=vi.fn(async(command:unknown)=>{if(command instanceof GetCallerIdentityCommand)return {Account:'999999999999',Arn:'arn:aws:iam::999999999999:user/test'};throw new Error('Unexpected operation')});const broker=new AwsConnectionBroker({stsFactory:()=>({send} as unknown as STSClient)});await expect(broker.validateAccountConnection(actor(),manual.id)).rejects.toMatchObject({code:'AWS_ACCOUNT_MISMATCH'})});
});
