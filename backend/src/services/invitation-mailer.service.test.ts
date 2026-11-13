import {afterEach,describe,it,expect,vi} from 'vitest';
import {env} from '../config/env.js';
import {SesInvitationMailer} from './invitation-mailer.service.js';
const {send}=vi.hoisted(()=>({send:vi.fn()}));
vi.mock('@aws-sdk/client-ses',async original=>({...await original<typeof import('@aws-sdk/client-ses')>(),SESClient:class {send=send}}));
const originalMode=env.INVITATION_EMAIL_MODE,originalEmail=env.SES_FROM_EMAIL;
afterEach(()=>{env.INVITATION_EMAIL_MODE=originalMode;env.SES_FROM_EMAIL=originalEmail;vi.resetAllMocks()});
describe('invitation email delivery',()=>{
 it('never reports disabled/local logging as delivered email',async()=>{env.INVITATION_EMAIL_MODE='disabled';await expect(new SesInvitationMailer().send('recipient@example.invalid','Invitation','test')).rejects.toThrow('not configured');expect(send).not.toHaveBeenCalled()});
 it('uses platform SES credentials and a bounded send, not selected AWS account keys',async()=>{env.INVITATION_EMAIL_MODE='ses';env.SES_FROM_EMAIL='access@example.invalid';send.mockResolvedValue({MessageId:'mock'});await new SesInvitationMailer().send('recipient@example.invalid','Invitation','Only fake proof in unit test');expect(send.mock.calls[0]?.[0]?.input?.Source).toBe('access@example.invalid');expect(send.mock.calls[0]?.[1]?.abortSignal).toBeDefined()});
 it('propagates SES failure so the invitation is marked failed and can be resent',async()=>{env.INVITATION_EMAIL_MODE='ses';env.SES_FROM_EMAIL='access@example.invalid';send.mockRejectedValue(new Error('Mock sandbox restriction'));await expect(new SesInvitationMailer().send('recipient@example.invalid','Invitation','test')).rejects.toThrow('sandbox')});
});
