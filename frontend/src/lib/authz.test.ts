import { describe,expect,it } from 'vitest';
import { can,getCapabilities,userRoles } from './authz';
import type { AuthSession } from '../types';

const session=(roles:string[],permissions:string[]=[]):AuthSession=>({authenticated:true,csrfToken:'csrf',authProvider:'development',devAuthAvailable:true,user:{id:'u',email:'u@example',displayName:'User',provider:'development',providerSubject:'u',activeTenantId:'t',permissions,memberships:roles.map((role,index)=>({id:`m${index}`,tenantId:'t',tenantName:'Tenant',tenantSlug:'tenant',role:role as any,status:'ACTIVE',scopes:[]}))}});

describe('frontend capability model',()=>{
 it('maps requester navigation capabilities without admin visibility',()=>{
  const value=session(['REQUESTER']);
  expect(can(value,'REQUEST_CREATE')).toBe(true);
  expect(can(value,'PERMISSION_CATALOGUE_VIEW')).toBe(true);
  expect(can(value,'ACTIVITY_VIEW')).toBe(false);
  expect(can(value,'CONNECTION_VIEW')).toBe(false);
 });

 it('treats account approver as approver capability set',()=>{
  const value=session(['ACCOUNT_APPROVER']);
  expect(can(value,'REQUEST_APPROVE')).toBe(true);
  expect(can(value,'REQUEST_REJECT')).toBe(true);
  expect(can(value,'CONNECTION_MANAGE')).toBe(false);
 });

 it('keeps security reviewer administration and connection access read only',()=>{
  const value=session(['SECURITY_REVIEWER']);
  expect(can(value,'ADMINISTRATION_VIEW')).toBe(true);
  expect(can(value,'CONNECTION_VIEW')).toBe(true);
  expect(can(value,'ADMINISTRATION_MANAGE')).toBe(false);
  expect(can(value,'CONNECTION_MANAGE')).toBe(false);
 });

 it('merges multiple roles and legacy permissions',()=>{
  const value=session(['REQUESTER','SECURITY_REVIEWER'],['revokeGrant']);
  expect(userRoles(value.user)).toEqual(['REQUESTER','SECURITY_REVIEWER']);
  expect(getCapabilities(value.user)).toEqual(expect.arrayContaining(['REQUEST_CREATE','ACTIVITY_VIEW','GRANT_REVOKE']));
 });
});
