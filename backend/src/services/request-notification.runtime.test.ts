import {afterEach,describe,expect,it,vi} from 'vitest';
const db=vi.hoisted(()=>({upsert:vi.fn(),findMany:vi.fn(),updateMany:vi.fn(),findUniqueOrThrow:vi.fn(),update:vi.fn()}));
vi.mock('../config/database.js',()=>({prisma:{emailNotification:db}}));
vi.mock('./request.repository.js',()=>({requestRepository:{find:vi.fn()}}));
import {notificationStore} from './request-notification.runtime.js';
afterEach(()=>vi.resetAllMocks());
describe('persistent email delivery claims',()=>{
 it('does not reset sent receipts when the same notification is enqueued again',async()=>{
  const record={id:'stable',tenantId:'one',requestId:'ORG-PR-1',recipientUserId:'recipient',event:'APPROVED' as const,payload:{organization:'One'}};
  await notificationStore.enqueue(record);
  expect(db.upsert).toHaveBeenCalledWith({where:{id:'stable'},update:{},create:record});
 });
 it('bounds retries, scopes queue reads, and can recover expired sending leases',async()=>{
  db.findMany.mockResolvedValue([{id:'one'}]);await expect(notificationStore.due('tenant','request',10)).resolves.toEqual(['one']);
  expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({tenantId:'tenant',requestId:'request',attempts:{lt:5},OR:expect.arrayContaining([expect.objectContaining({status:'SENDING',leaseUntil:{lt:expect.any(Date)}})])}),take:10}));
 });
 it('uses a conditional claim so a simultaneous worker cannot send the same receipt',async()=>{
  db.updateMany.mockResolvedValue({count:0});expect(await notificationStore.claim('claimed')).toBeUndefined();expect(db.findUniqueOrThrow).not.toHaveBeenCalled();
 });
 it('claims before reading payload and retains the recipient user ID rather than an email/token',async()=>{
  db.updateMany.mockResolvedValue({count:1});db.findUniqueOrThrow.mockResolvedValue({id:'one',tenantId:'tenant',requestId:'request',recipientUserId:'recipient',event:'APPROVED',payload:{organization:'One'}});
  expect(await notificationStore.claim('one')).toMatchObject({recipientUserId:'recipient',event:'APPROVED'});
  expect(db.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:'SENDING',attempts:{increment:1},leaseUntil:expect.any(Date)}}));
 });
 it('persists backoff and message receipts without storing raw SES response objects',async()=>{
  db.findUniqueOrThrow.mockResolvedValue({attempts:2});const before=Date.now();await notificationStore.finish('one','FAILED');
  const data=db.update.mock.calls[0]![0].data;expect(data.status).toBe('FAILED');expect(data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before+120000);expect(data.leaseUntil).toBeNull();
  await notificationStore.finish('one','SENT','ses-message-id');expect(db.update).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({status:'SENT',messageId:'ses-message-id',sentAt:expect.any(Date)})}));
 });
});
