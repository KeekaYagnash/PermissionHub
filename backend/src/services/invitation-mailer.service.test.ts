import {afterEach,describe,it,expect,vi} from 'vitest';
import {env} from '../config/env.js';
import {SesInvitationMailer} from './invitation-mailer.service.js';
const {send,configuration}=vi.hoisted(()=>({send:vi.fn(),configuration:vi.fn()}));
vi.mock('@aws-sdk/client-ses',async original=>({...await original<typeof import('@aws-sdk/client-ses')>(),SESClient:class {send=send;constructor(input:unknown){configuration(input)}}}));
const originalMode=env.INVITATION_EMAIL_MODE,originalEmail=env.SES_FROM_EMAIL;
afterEach(()=>{env.INVITATION_EMAIL_MODE=originalMode;env.SES_FROM_EMAIL=originalEmail;vi.resetAllMocks()});
describe('invitation email delivery',()=>{
 it('never reports disabled/local logging as delivered email',async()=>{env.INVITATION_EMAIL_MODE='disabled';await expect(new SesInvitationMailer().send('recipient@example.invalid','Invitation','test')).rejects.toThrow('not configured');expect(send).not.toHaveBeenCalled()});
 it('uses us-east-1 platform credentials and a bounded multipart send, not selected AWS account keys',async()=>{env.INVITATION_EMAIL_MODE='ses';env.SES_FROM_EMAIL='info@disraptor.co.za';send.mockResolvedValue({MessageId:'mock'});await new SesInvitationMailer().send('recipient@example.invalid','Invitation','Only fake proof in unit test');expect(configuration).toHaveBeenCalledWith({region:'us-east-1',maxAttempts:3});expect(send.mock.calls[0]?.[0]?.input?.Source).toBe('info@disraptor.co.za');expect(send.mock.calls[0]?.[0]?.input?.Message?.Body?.Html?.Data).toContain('PermissionHub');expect(send.mock.calls[0]?.[1]?.abortSignal).toBeDefined()});
 it('propagates SES failure so the invitation is marked failed and can be resent',async()=>{env.INVITATION_EMAIL_MODE='ses';env.SES_FROM_EMAIL='info@disraptor.co.za';send.mockRejectedValue(new Error('Mock sandbox restriction'));await expect(new SesInvitationMailer().send('recipient@example.invalid','Invitation','test')).rejects.toThrow('sandbox')});
 it('refuses unverified contact senders without calling SES',async()=>{env.INVITATION_EMAIL_MODE='ses';env.SES_FROM_EMAIL='contact@disraptor.co.za';await expect(new SesInvitationMailer().send('recipient@example.invalid','Invitation','test')).rejects.toThrow('existing verified');expect(send).not.toHaveBeenCalled()});
 it('permits mailboxes under the existing verified domain',async()=>{env.INVITATION_EMAIL_MODE='ses';env.SES_FROM_EMAIL='notifications@disraptor-internal.net';send.mockResolvedValue({MessageId:'mock'});await new SesInvitationMailer().send('recipient@example.invalid','Invitation','test');expect(send.mock.calls[0]?.[0]?.input?.Source).toBe('notifications@disraptor-internal.net')});
});
