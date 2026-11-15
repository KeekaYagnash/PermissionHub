import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {env} from '../config/env.js';
import type {PermissionRequest,SessionUser} from '../types.js';
import {developmentAccounts,identityDomain} from './identity-domain.service.js';
import {RequestNotificationService,eventForRequest,notificationId,notificationRecipients,requestEmailView,type NotificationRecord,type NotificationStore} from './request-notification.service.js';
import {applicationLink,renderNotification} from './email-template.js';

const account=developmentAccounts[0]!;
const original={local:env.ALLOW_LOCAL_PROVISIONING,self:env.ALLOW_DEV_SELF_APPROVAL};
function user(id:string,role:SessionUser['memberships'][number]['role']='ACCOUNT_APPROVER',tenantId=account.tenantId):SessionUser{return {id,email:`${id}@example.invalid`,displayName:id,provider:'directory',providerSubject:id,activeTenantId:tenantId,permissions:[],memberships:[{id:`m-${id}`,tenantId,tenantName:'Organization One',tenantSlug:'one',role,status:'ACTIVE',scopes:[{scopeType:'AWS_ACCOUNT',scopeId:account.id,includeDescendants:false,canView:true,canRequest:true,canApprove:role!=='REQUESTER',canProvision:false,canRevoke:false,canManageConfiguration:false}]}]}}
function request(status:PermissionRequest['status']='Pending approval'):PermissionRequest{return {id:'ORG-PR-42',tenantId:account.tenantId,awsAccountId:account.id,requesterUserId:'requester',requester:'requester',title:'Sensitive justification is not emailed',approver:'approver',targetType:'ROLE',targetName:'role',targetArn:'arn:aws:iam::123456789012:role/role',items:[],scope:{type:'ALL',resources:[]},duration:'Permanent',startDate:'2026-11-15T00:00:00Z',priority:'Normal',justification:'Must not be included in email',status,createdAt:'2026-11-15T00:00:00Z',submittedAt:'2026-11-15T01:00:00Z',timeline:[],requiredApprovalStages:['ACCOUNT_APPROVER'],completedApprovalStages:[]}}
class MemoryStore implements NotificationStore {
 rows=new Map<string,{record:NotificationRecord;status:string;attempts:number}>();
 async enqueue(record:NotificationRecord){if(!this.rows.has(record.id))this.rows.set(record.id,{record,status:'PENDING',attempts:0})}
 async due(tenantId?:string,requestId?:string,limit=20){return [...this.rows.values()].filter(row=>row.status!=='SENT'&&row.status!=='CANCELLED'&&row.status!=='SENDING'&&row.attempts<5&&(!tenantId||row.record.tenantId===tenantId)&&(!requestId||row.record.requestId===requestId)).slice(0,limit).map(row=>row.record.id)}
 async claim(id:string){const row=this.rows.get(id);if(!row||['SENDING','SENT','CANCELLED'].includes(row.status))return;row.status='SENDING';row.attempts++;return row.record}
 async finish(id:string,status:string){this.rows.get(id)!.status=status}
}
beforeEach(()=>{env.ALLOW_LOCAL_PROVISIONING=false;env.ALLOW_DEV_SELF_APPROVAL=false;identityDomain.addManualAccount(account)});
afterEach(()=>{env.ALLOW_LOCAL_PROVISIONING=original.local;env.ALLOW_DEV_SELF_APPROVAL=original.self;identityDomain.removeManualAccount(account.tenantId,account.id)});
describe('transactional request email',()=>{
 it('uses current tenant, account scope, assignment and approval stage rather than global administrators',()=>{
  const pending=request(),approver=user('approver'),otherTenant=user('unrelated','ORGANISATION_ADMIN','another-tenant'),self=user('requester','ORGANISATION_ADMIN'),wrongScope=user('wrong');wrongScope.memberships[0]!.scopes[0]!.scopeId='another-account';
  expect(notificationRecipients(pending,'REVIEW_REQUIRED',[approver,otherTenant,self,wrongScope]).map(item=>item.id)).toEqual(['approver']);
  expect(notificationRecipients({...pending,approverUserId:'another'},'REVIEW_REQUIRED',[approver])).toEqual([]);
  expect(notificationRecipients({...pending,requiredApprovalStages:['SECURITY_REVIEWER']},'REVIEW_REQUIRED',[approver])).toEqual([]);
 });
 it('notifies only the current active requester membership about decisions',()=>{
  const value=request('Approved'),requester=user('requester','REQUESTER'),admin=user('admin','ORGANISATION_ADMIN');
  expect(notificationRecipients(value,'APPROVED',[requester,admin]).map(item=>item.id)).toEqual(['requester']);
  requester.memberships[0]!.status='SUSPENDED';expect(notificationRecipients(value,'APPROVED',[requester])).toEqual([]);
 });
 it.each(['Draft','Provisioning','More information required','Expired','Revoked'] as const)('does not invent an email success event for %s',status=>expect(eventForRequest(request(status))).toBeUndefined());
 it('does not announce full approval during intermediate stages',()=>expect(eventForRequest({...request(),completedApprovalStages:['ACCOUNT_APPROVER']})).toBe('REVIEW_REQUIRED'));
 it('creates stable event/recipient keys, with distinct failure attempts and approval stages',()=>{
  const pending=request();expect(notificationId(pending,'REVIEW_REQUIRED','a')).toBe(notificationId({...pending},'REVIEW_REQUIRED','a'));
  expect(notificationId(pending,'REVIEW_REQUIRED','a')).not.toBe(notificationId({...pending,completedApprovalStages:['ACCOUNT_APPROVER']},'REVIEW_REQUIRED','a'));
  expect(notificationId({...pending,timeline:[{label:'Provisioning failed',timestamp:'one'}]},'PROVISIONING_FAILED','a')).not.toBe(notificationId({...pending,timeline:[{label:'Provisioning failed',timestamp:'two'}]},'PROVISIONING_FAILED','a'));
 });
 function setup(value=request('Approved')){
  const store=new MemoryStore(),sendMessage=vi.fn().mockResolvedValue({delivery:'ses' as const,messageId:'mock-id'}),users=[user('requester','REQUESTER'),user('approver')],directory={load:vi.fn(async()=>({organization:'Organization One',users})),request:vi.fn(async()=>value)},service=new RequestNotificationService(store,directory,{sendMessage},()=>true,'https://permissionhub.example.invalid');
  return {store,sendMessage,directory,service,value,users};
 }
 it('sends HTML and text once across repeated saves and concurrent retries',async()=>{
  const {service,value,store,sendMessage}=setup();await service.record(value);await service.record(value);await Promise.all([service.retry(),service.retry()]);
  expect(sendMessage).toHaveBeenCalledTimes(1);expect([...store.rows.values()][0]?.status).toBe('SENT');
  const message=sendMessage.mock.calls[0]![1];expect(message.html).toContain('View request');expect(message.text).toContain('/requests/ORG-PR-42');expect(JSON.stringify(message)).not.toContain(value.justification);
 });
 it('retains delivery failure for retry without changing a successful approval',async()=>{
  const {service,value,store,sendMessage}=setup();sendMessage.mockRejectedValueOnce(new Error('mock SES outage'));
  await expect(service.record(value)).resolves.toBeUndefined();expect(value.status).toBe('Approved');expect([...store.rows.values()][0]?.status).toBe('FAILED');
  await service.retry();expect(sendMessage).toHaveBeenCalledTimes(2);expect([...store.rows.values()][0]?.status).toBe('SENT');
 });
 it('limits automatic retry attempts rather than endlessly repeating SES failures',async()=>{
  const {service,value,store,sendMessage}=setup();sendMessage.mockRejectedValue(new Error('outage'));
  await service.record(value);for(let attempt=0;attempt<8;attempt++)await service.retry();
  expect(sendMessage).toHaveBeenCalledTimes(5);expect([...store.rows.values()][0]?.attempts).toBe(5);
 });
 it('bounds parallel delivery and retains remaining approvers in the durable queue',async()=>{
  const {service,value,users,store,sendMessage}=setup(request());users.push(user('approver-2'),user('approver-3'),user('approver-4'));
  let active=0,maximum=0;sendMessage.mockImplementation(async()=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return {delivery:'ses',messageId:'mock-id'}});
  await service.record(value);expect(sendMessage).toHaveBeenCalledTimes(2);expect([...store.rows.values()].filter(row=>row.status==='PENDING')).toHaveLength(2);
  await service.retry();expect(sendMessage).toHaveBeenCalledTimes(4);expect(maximum).toBeLessThanOrEqual(2);
 });
 it('fails open when notification persistence or recipient resolution is unavailable',async()=>{
  const {service,value,directory}=setup();directory.load.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(service.record(value)).resolves.toBeUndefined();expect(value.status).toBe('Approved');
 });
 it('does not roll back the workflow if the outbox insert fails',async()=>{
  const {service,value,store,sendMessage}=setup();vi.spyOn(store,'enqueue').mockRejectedValue(new Error('outbox unavailable'));
  await expect(service.record(value)).resolves.toBeUndefined();expect(value.status).toBe('Approved');expect(sendMessage).not.toHaveBeenCalled();
 });
 it('does not query recipients or send when notifications are disabled',async()=>{
  const {store,directory,sendMessage,value}=setup(),service=new RequestNotificationService(store,directory,{sendMessage},()=>false);
  await service.record(value);await service.retry();expect(directory.load).not.toHaveBeenCalled();expect(sendMessage).not.toHaveBeenCalled();expect(store.rows.size).toBe(0);
 });
 it('rechecks tenant membership before retry and cancels revoked access',async()=>{
  const {service,value,store,sendMessage,users}=setup();sendMessage.mockRejectedValueOnce(new Error('outage'));await service.record(value);
  users[0]!.memberships[0]!.status='SUSPENDED';await service.retry();expect(sendMessage).toHaveBeenCalledTimes(1);expect([...store.rows.values()][0]?.status).toBe('CANCELLED');
 });
 it('never delivers a queued event whose request is now from a different tenant',async()=>{
  const {service,value,directory,store,sendMessage}=setup();sendMessage.mockRejectedValueOnce(new Error('outage'));await service.record(value);directory.request.mockResolvedValue({...value,tenantId:'other'});
  await service.retry();expect(sendMessage).toHaveBeenCalledTimes(1);expect([...store.rows.values()][0]?.status).toBe('CANCELLED');
 });
 it('labels denial, failure and successful provisioning accurately without embedding AWS errors',()=>{
  const base={id:'notification',tenantId:'tenant',requestId:'ORG-PR-42',recipientUserId:'user',payload:{organization:'Example',reason:'Use a narrower scope.'}};
  expect(renderNotification(requestEmailView({...base,event:'REJECTED'},'https://app.example.invalid')).text).toContain('Use a narrower scope.');
  expect(renderNotification(requestEmailView({...base,event:'PROVISIONING_FAILED'},'https://app.example.invalid')).text).toContain('Some operations may have completed');
  expect(renderNotification(requestEmailView({...base,event:'PROVISIONED'},'https://app.example.invalid')).text).toContain('recorded successful provisioning');
 });
});
describe('branded responsive email rendering and safe links',()=>{
 it('escapes untrusted strings, uses an email-safe responsive layout and includes a text alternative',()=>{
  const message=renderNotification({heading:'Denied\r\nInjected header',organization:'<img src=x onerror=evil()>',summary:'A <script> must be escaped',reason:'<b>Reason</b>',actionLabel:'View request',actionUrl:'https://app.example.invalid/requests/ORG-PR-42',requestId:'ORG-PR-42'});
  expect(message.html).toContain('max-width:600px');expect(message.html).toContain('role="presentation"');expect(message.html).toContain('&lt;script&gt;');expect(message.html).not.toContain('<img src=x');expect(message.subject).not.toMatch(/[\r\n]/);expect(message.text).toContain('Decision reason:');expect(message.text).toContain('does not approve, deny or provision');
 });
 it('links only to authenticated review, with no email action endpoint or approval token',()=>{
  const view=requestEmailView({id:'id',tenantId:'one',requestId:'ORG-PR-42',recipientUserId:'u',event:'REVIEW_REQUIRED',payload:{organization:'Org'}},'https://app.example.invalid');
  expect(view.actionUrl).toBe('https://app.example.invalid/requests/ORG-PR-42');expect(view.actionUrl).not.toMatch(/approve|reject|token|api/);
  expect(()=>applicationLink('https://app.example.invalid','//evil.example.invalid')).toThrow();expect(()=>applicationLink('http://public.example.invalid','/')).toThrow();
  expect(()=>renderNotification({...view,actionUrl:'javascript:alert(1)'})).toThrow();
 });
});
