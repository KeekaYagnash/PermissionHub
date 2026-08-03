import { DescribeOrganizationCommand,ListAccountsCommand,ListAccountsForParentCommand,ListOrganizationalUnitsForParentCommand,ListRootsCommand,type OrganizationsClient } from '@aws-sdk/client-organizations';
import { describe,expect,it,vi } from 'vitest';
import { developmentAccounts } from '../identity-domain.service.js';
import { AwsOrganizationsService } from './organizations.service.js';

describe('AWS Organisation discovery',()=>{
 it('recursively discovers direct accounts in nested OUs and paginates roots',async()=>{const send=vi.fn(async(command:any)=>{
  if(command instanceof DescribeOrganizationCommand)return {Organization:{Id:'o-test',MasterAccountId:'100000000000'}};
  if(command instanceof ListRootsCommand)return command.input.NextToken?{Roots:[{Id:'r-second',Name:'Second'}]}:{Roots:[{Id:'r-root',Name:'Root'}],NextToken:'next'};
  if(command instanceof ListOrganizationalUnitsForParentCommand){if(command.input.ParentId==='r-root')return {OrganizationalUnits:[{Id:'ou-parent',Name:'Production'}]};if(command.input.ParentId==='ou-parent')return {OrganizationalUnits:[{Id:'ou-child',Name:'Payments'}]};return {OrganizationalUnits:[]}}
  if(command instanceof ListAccountsForParentCommand){if(command.input.ParentId==='ou-child')return {Accounts:[{Id:'200000000001',Name:'Payments'}]};if(command.input.ParentId==='r-second')return {Accounts:[{Id:'200000000002',Name:'Shared'}]};return {Accounts:[]}}
  if(command instanceof ListAccountsCommand)return {Accounts:[{Id:'200000000001',Name:'Payments',Status:'ACTIVE'},{Id:'200000000002',Name:'Shared',Status:'ACTIVE'}]};throw new Error(`unexpected ${command.constructor.name}`)
 });const service=new AwsOrganizationsService({send} as unknown as OrganizationsClient),result=await service.discover({...developmentAccounts[0]!,accountId:'100000000000'},true);expect(result.roots).toHaveLength(2);expect(result.organisationalUnits.map(item=>item.fullPath)).toContain('/Root/Production/Payments');expect(result.accounts).toEqual(expect.arrayContaining([expect.objectContaining({accountId:'200000000001',ouPath:'/Root/Production/Payments'}),expect.objectContaining({accountId:'200000000002',ouPath:'/Second'})]));expect(send.mock.calls.filter(([command])=>command instanceof ListAccountsForParentCommand).length).toBeGreaterThan(2)});
});
