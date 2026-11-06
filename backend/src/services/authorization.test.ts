import { describe,expect,it } from 'vitest';
import { authorization } from './authorization.service.js';
import { developmentAccounts,developmentUsers,identityDomain } from './identity-domain.service.js';
import { approvalRouting } from './approval-routing.service.js';

const session=(id:string)=>identityDomain.sessionUser(developmentUsers.find(user=>user.id===id)!,'development');
describe('tenant and account authorisation',()=>{
 it('does not expose other requests to requesters when stages are empty',()=>{
  const user=session('user_requester_dev');
  const request={tenantId:developmentAccounts[0]!.tenantId,awsAccountId:developmentAccounts[0]!.id,requesterUserId:'someone-else',requiredApprovalStages:[]};
  expect(authorization.canApproveRequest(user,request)).toBe(false);
  expect(authorization.canViewRequest(user,request)).toBe(false);
 });
 it('does not let tenant-wide reviewers cross account or tenant boundaries',()=>{
  const user=session('user_security_dev');
  expect(authorization.canViewRequest(user,{tenantId:'other-tenant',awsAccountId:developmentAccounts[0]!.id})).toBe(false);
  expect(authorization.canViewRequest(user,{awsAccountId:'unknown-account'})).toBe(false);
 });
 it('lets scoped provisioners view and retry failed approved changes',()=>{
  const user=session('user_provisioner_dev'),request={awsAccountId:developmentAccounts[0]!.id,requesterUserId:'someone-else',status:'Provisioning failed'};
  expect(authorization.canViewRequest(user,request)).toBe(true);
  expect(authorization.canProvisionRequest(user,request)).toBe(true);
 });
 it('limits requester accounts to assigned scopes',()=>{const user=session('user_requester_dev');expect(authorization.canRequestAccess(user,developmentAccounts[0]!.id)).toBe(true);expect(authorization.canViewAccount(user,developmentAccounts[2]!.id)).toBe(false)});
 it('allows an OU admin to see the scoped OU account only',()=>{const user=session('user_ou_admin_dev');expect(authorization.canViewAccount(user,developmentAccounts[0]!.id)).toBe(true);expect(authorization.canViewAccount(user,developmentAccounts[1]!.id)).toBe(false)});
 it('does not grant platform admins customer AWS scope',()=>{const user=session('user_platform_dev');expect(authorization.canViewAccount(user,developmentAccounts[0]!.id)).toBe(false)});
 it('prevents self approval',()=>{const user=session('user_requester_dev');expect(authorization.canApproveRequest(user,{awsAccountId:developmentAccounts[0]!.id,requesterUserId:user.id})).toBe(false)});
 it('enforces approval stage order',()=>{const request={awsAccountId:developmentAccounts[0]!.id,requesterUserId:'someone-else',requiredApprovalStages:['ACCOUNT_APPROVER','SECURITY_REVIEWER','PROVISIONER']};expect(authorization.canApproveRequest(session('user_approver_dev'),request)).toBe(true);expect(authorization.canApproveRequest(session('user_security_dev'),request)).toBe(false);expect(authorization.canApproveRequest(session('user_security_dev'),{...request,completedApprovalStages:['ACCOUNT_APPROVER']})).toBe(true)});
 it('does not make Organisation Admin a Security Reviewer',()=>expect(authorization.canApproveRequest(session('user_org_admin_dev'),{awsAccountId:developmentAccounts[0]!.id,requesterUserId:'someone-else',requiredApprovalStages:['SECURITY_REVIEWER']})).toBe(false));
 it('honours explicit account-scoped reviewer and provisioner assignments',()=>{const user=session('user_org_admin_dev');user.roleAssignments=[{id:'review',tenantId:developmentAccounts[0]!.tenantId,awsAccountId:developmentAccounts[0]!.id,role:'SECURITY_REVIEWER'},{id:'provision',tenantId:developmentAccounts[0]!.tenantId,awsAccountId:developmentAccounts[0]!.id,role:'PROVISIONER'}];expect(authorization.canApproveRequest(user,{awsAccountId:developmentAccounts[0]!.id,requesterUserId:'someone-else',requiredApprovalStages:['SECURITY_REVIEWER']})).toBe(true);expect(authorization.canProvisionInAccount(user,developmentAccounts[0]!.id)).toBe(true);expect(authorization.canProvisionInAccount(user,developmentAccounts[1]!.id)).toBe(false)});
 it('enforces an explicitly assigned approver',()=>{const user=session('user_security_dev');expect(authorization.canApproveRequest(user,{awsAccountId:developmentAccounts[0]!.id,requesterUserId:'someone-else',approverUserId:'different-user',requiredApprovalStages:['SECURITY_REVIEWER']})).toBe(false)});
 it('maps requester role to personal request capabilities only',()=>{const user=session('user_requester_dev');expect(authorization.hasCapability(user,'REQUEST_CREATE',developmentAccounts[0]!.id)).toBe(true);expect(authorization.hasCapability(user,'REQUEST_VIEW_ALL')).toBe(false);expect(authorization.hasCapability(user,'ACTIVITY_VIEW')).toBe(false);expect(authorization.hasCapability(user,'CONNECTION_VIEW')).toBe(false)});
 it('maps account approver to review without connection administration',()=>{const user=session('user_approver_dev');expect(authorization.hasCapability(user,'REQUEST_APPROVE',developmentAccounts[0]!.id)).toBe(true);expect(authorization.hasCapability(user,'REQUEST_REJECT',developmentAccounts[0]!.id)).toBe(true);expect(authorization.hasCapability(user,'CONNECTION_MANAGE')).toBe(false)});
 it('maps security reviewer to read-only administration and connection capabilities',()=>{const user=session('user_security_dev');expect(authorization.hasCapability(user,'ADMINISTRATION_VIEW')).toBe(true);expect(authorization.hasCapability(user,'CONNECTION_VIEW')).toBe(true);expect(authorization.hasCapability(user,'ADMINISTRATION_MANAGE')).toBe(false);expect(authorization.hasCapability(user,'CONNECTION_MANAGE')).toBe(false)});
 it('merges account-scoped role assignments with tenant membership roles',()=>{const user=session('user_requester_dev');user.roleAssignments=[{id:'review',tenantId:developmentAccounts[0]!.tenantId,awsAccountId:developmentAccounts[0]!.id,role:'SECURITY_REVIEWER'}];expect(authorization.permissions(user,developmentAccounts[0]!.id)).toEqual(expect.arrayContaining(['REQUEST_CREATE','REQUEST_VIEW_ALL','ACTIVITY_VIEW']))});
});
describe('approval routing',()=>{it('requires security review and manual provisioning for production',()=>{const route=approvalRouting.route({account:developmentAccounts[0]!,duration:'8 hours',permanent:false,permissionRisk:'High'});expect(route.requiredApprovalStages).toEqual(['ACCOUNT_APPROVER','SECURITY_REVIEWER','PROVISIONER']);expect(route.provisioningMode).toBe('MANUAL');expect(route.permanentAccessAllowed).toBe(false)})});
