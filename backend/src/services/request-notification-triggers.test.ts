import {afterEach,describe,expect,it,vi} from 'vitest';
import {requestRepository} from './request.repository.js';
import {requestNotifications} from './request-notification.runtime.js';
import {requests} from './mock.service.js';
import {eventForRequest} from './request-notification.service.js';
import type {PermissionRequest} from '../types.js';
afterEach(()=>{vi.restoreAllMocks();const index=requests.findIndex(item=>item.id==='EMAIL-PR-TEST');if(index>=0)requests.splice(index,1)});
describe('committed workflow notification boundary',()=>{
 it.each(['Draft','Pending approval','Approved','Rejected','Provisioned','Provisioning failed'] as const)('observes persisted %s state without changing the workflow',async status=>{
  const request:PermissionRequest={id:'EMAIL-PR-TEST',tenantId:'tenant',requester:'user',approver:'reviewer',title:'request',targetType:'USER',targetName:'user',targetArn:'arn:aws:iam::123456789012:user/user',items:[],scope:{type:'ALL',resources:[]},duration:'Permanent',startDate:'2026-11-15T00:00:00Z',priority:'Normal',justification:'Test',status,createdAt:'2026-11-15T00:00:00Z',timeline:[]};
  const observed=vi.spyOn(requestNotifications,'record').mockImplementation(async value=>{expect(requests.find(item=>item.id===value.id)?.status).toBe(status)});
  await requestRepository.save(request);expect(observed).toHaveBeenCalledWith(request);expect(request.status).toBe(status);
  if(status==='Draft')expect(eventForRequest(request)).toBeUndefined();
 });
});
