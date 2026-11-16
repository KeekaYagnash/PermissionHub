import {describe,it,expect,vi} from 'vitest';
import type {PrismaClient} from '@prisma/client';
import {OrganizationService} from './organization.service.js';
import type {SessionUser} from '../types.js';
const actor:SessionUser={id:'member',email:'member@example.invalid',emailVerified:true,displayName:'Organization Member',provider:'test',providerSubject:'member',permissions:[],memberships:[]};
describe('organization management authorization',()=>{
 it.each([null,'REQUESTER','SECURITY_REVIEWER','PLATFORM_ADMIN'])('refuses management for a missing or %s membership',async role=>{
  const findUnique=vi.fn().mockResolvedValue(role?{role,status:'ACTIVE',tenant:{status:'ACTIVE'}}:null),findMany=vi.fn(),updateMany=vi.fn(),tx={tenantMembership:{findUnique,findMany},organizationInvitation:{findMany,updateMany}};
  const db={$transaction:vi.fn(async(fn:(tx:unknown)=>unknown)=>fn(tx))} as unknown as PrismaClient,service=new OrganizationService(db,{send:vi.fn()},'https://app.example.invalid');
  await expect(service.list(actor,'other-organization')).rejects.toMatchObject({code:'ORGANIZATION_ADMIN_REQUIRED'});await expect(service.revoke(actor,'other-organization','invite')).rejects.toMatchObject({code:'ORGANIZATION_ADMIN_REQUIRED'});expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{tenantId_userId:{tenantId:'other-organization',userId:actor.id}}}));expect(findMany).not.toHaveBeenCalled();expect(updateMany).not.toHaveBeenCalled();
 });
 it('only queries members/invitations in the authorized organization',async()=>{
  const members=vi.fn().mockResolvedValue([]),invitations=vi.fn().mockResolvedValue([]),tx={tenantMembership:{findUnique:vi.fn().mockResolvedValue({role:'ORGANISATION_ADMIN',status:'ACTIVE',tenant:{status:'ACTIVE'}}),findMany:members},organizationInvitation:{findMany:invitations}};
  const db={$transaction:vi.fn(async(fn:(tx:unknown)=>unknown)=>fn(tx))} as unknown as PrismaClient;await new OrganizationService(db,{send:vi.fn()},'https://app.example.invalid').list(actor,'own-organization');expect(members).toHaveBeenCalledWith(expect.objectContaining({where:{tenantId:'own-organization'}}));expect(invitations).toHaveBeenCalledWith(expect.objectContaining({where:{tenantId:'own-organization'}}));
 });
});
