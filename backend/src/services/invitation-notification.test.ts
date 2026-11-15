import type {PrismaClient} from '@prisma/client';
import {describe,expect,it,vi} from 'vitest';
import {OrganizationService} from './organization.service.js';
import type {SessionUser} from '../types.js';
const actor:SessionUser={id:'admin',email:'admin@example.invalid',displayName:'Organization Admin',provider:'test',providerSubject:'admin',emailVerified:true,permissions:[],memberships:[]};
function setup(){
 const updateMany=vi.fn().mockResolvedValue({count:1}),upsert=vi.fn().mockResolvedValue({id:'invite',expiresAt:new Date(Date.now()+3600000)}),tx={tenantMembership:{findUnique:vi.fn().mockResolvedValue({status:'ACTIVE',role:'ORGANISATION_ADMIN',tenant:{status:'ACTIVE'}}),findFirst:vi.fn().mockResolvedValue(null)},organizationInvitation:{upsert},connectionAuditEvent:{create:vi.fn()}};
 const db={$transaction:vi.fn(async(fn:(tx:unknown)=>unknown)=>fn(tx)),tenant:{findUniqueOrThrow:vi.fn().mockResolvedValue({name:'Example Organization'})},organizationInvitation:{updateMany}} as unknown as PrismaClient;
 const send=vi.fn().mockResolvedValue(undefined),service=new OrganizationService(db,{send},'https://app.example.invalid');return {service,send,upsert,updateMany};
}
describe('invitation email integration',()=>{
 it.each(['EXPIRED','REVOKED','ACCEPTED'])('cannot consume a %s invitation or mutate membership',async status=>{
  const upsert=vi.fn(),tx={organizationInvitation:{findUnique:vi.fn().mockResolvedValue({email:actor.email,status,expiresAt:new Date(Date.now()+3600000),tenant:{status:'ACTIVE'}})},tenantMembership:{upsert}};
  const db={$transaction:vi.fn(async(fn:(tx:unknown)=>unknown)=>fn(tx))} as unknown as PrismaClient;
  await expect(new OrganizationService(db,{send:vi.fn()},'https://app.example.invalid').accept(actor,'old-proof')).rejects.toMatchObject({code:'INVITATION_UNAVAILABLE'});expect(upsert).not.toHaveBeenCalled();
 });
 it('cannot consume a time-expired pending invitation',async()=>{
  const tx={organizationInvitation:{findUnique:vi.fn().mockResolvedValue({email:actor.email,status:'PENDING',expiresAt:new Date(0),tenant:{status:'ACTIVE'}})}};
  const db={$transaction:vi.fn(async(fn:(tx:unknown)=>unknown)=>fn(tx))} as unknown as PrismaClient;
  await expect(new OrganizationService(db,{send:vi.fn()},'https://app.example.invalid').accept(actor,'old-proof')).rejects.toMatchObject({code:'INVITATION_UNAVAILABLE'});
 });
 it('uses the existing sign-up/accept route with an expiring fragment proof and branded HTML',async()=>{
  const {service,send,upsert}=setup();const result=await service.invite(actor,'tenant','invitee@example.invalid','REQUESTER');
  expect(result.deliveryStatus).toBe('SENT');const args=send.mock.calls[0]!;expect(args[2]).toContain('/accept-invitation#token=');expect(args[2]).toContain('48 hours');expect(args[3]).toContain('Accept invitation');expect(args[3]).toContain('Example Organization');
  const stored=upsert.mock.calls[0]![0];expect(stored.create.tokenHash).toMatch(/^[a-f0-9]{64}$/);expect(args[2]).not.toContain(stored.create.tokenHash);
 });
 it('keeps a created invitation when delivery and delivery-status persistence fail',async()=>{
  const {service,send,updateMany}=setup();send.mockRejectedValue(new Error('SES unavailable'));updateMany.mockRejectedValue(new Error('metadata unavailable'));
  await expect(service.invite(actor,'tenant','invitee@example.invalid','REQUESTER')).resolves.toMatchObject({id:'invite',status:'PENDING',deliveryStatus:'FAILED'});
 });
 it('rotates the proof for an intentional repeated invitation, without storing plaintext tokens',async()=>{
  const {service,upsert}=setup();await service.invite(actor,'tenant','invitee@example.invalid','REQUESTER');await service.invite(actor,'tenant','invitee@example.invalid','REQUESTER');
  expect(upsert.mock.calls[0]![0].create.tokenHash).not.toBe(upsert.mock.calls[1]![0].create.tokenHash);
 });
});
