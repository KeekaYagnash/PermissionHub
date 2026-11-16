import express from 'express';
import request from 'supertest';
import {afterEach,it,expect,vi} from 'vitest';
import authRoutes from './auth.routes.js';
import {organizations} from './organization.routes.js';
import type {SessionUser} from '../types.js';
afterEach(()=>vi.restoreAllMocks());
it.each(['proof','inbox'])('clears both old AWS account aliases after %s invitation acceptance',async mode=>{
 const user:SessionUser={id:'invitee',email:'invitee@example.invalid',emailVerified:true,displayName:'Invited User',provider:'cognito',providerSubject:'subject',activeTenantId:'old-tenant',activeAccountId:'old-account',activeAwsAccountRecordId:'old-account',permissions:[],memberships:[{id:'old-member',tenantId:'old-tenant',tenantName:'Old',tenantSlug:'old',role:'REQUESTER',status:'ACTIVE',scopes:[]}]};
 const accept=async()=>{user.memberships.push({id:'new-member',tenantId:'new-tenant',tenantName:'New',tenantSlug:'new',role:'REQUESTER',status:'ACTIVE',scopes:[]});return {tenantId:'new-tenant',name:'New'}};
 vi.spyOn(organizations,'accept').mockImplementation(accept);vi.spyOn(organizations,'acceptPending').mockImplementation(accept);
 const app=express();app.use(express.json());app.use((req,_res,next)=>{Object.assign(req,{session:{user,csrfToken:'test-token',save:(done:()=>void)=>done()}});next()});app.use('/auth',authRoutes);
 const response=await request(app).post(mode==='proof'?'/auth/invitations/accept':'/auth/invitations/11111111-1111-4111-8111-111111111111/accept').send(mode==='proof'?{proof:'x'.repeat(43)}:{}).expect(200);
 expect(response.body.data.user.activeTenantId).toBe('new-tenant');expect(response.body.data.user.activeAwsAccountRecordId).toBeUndefined();expect(response.body.data.user.activeAccountId).toBeUndefined();expect(user.activeAccountId).toBeUndefined();
});
