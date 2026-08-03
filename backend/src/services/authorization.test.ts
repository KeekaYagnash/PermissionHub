import { describe,expect,it } from 'vitest';
import { authorization } from './authorization.service.js';
import { developmentAccounts,developmentUsers,identityDomain } from './identity-domain.service.js';
import { approvalRouting } from './approval-routing.service.js';

const session=(id:string)=>identityDomain.sessionUser(developmentUsers.find(user=>user.id===id)!,'development');
describe('tenant and account authorisation',()=>{
 it('limits requester accounts to assigned scopes',()=>{const user=session('user_requester_dev');expect(authorization.canRequestAccess(user,developmentAccounts[0]!.id)).toBe(true);expect(authorization.canViewAccount(user,developmentAccounts[2]!.id)).toBe(false)});
 it('allows an OU admin to see the scoped OU account only',()=>{const user=session('user_ou_admin_dev');expect(authorization.canViewAccount(user,developmentAccounts[0]!.id)).toBe(true);expect(authorization.canViewAccount(user,developmentAccounts[1]!.id)).toBe(false)});
 it('does not grant platform admins customer AWS scope',()=>{const user=session('user_platform_dev');expect(authorization.canViewAccount(user,developmentAccounts[0]!.id)).toBe(false)});
 it('prevents self approval',()=>{const user=session('user_requester_dev');expect(authorization.canApproveRequest(user,{awsAccountId:developmentAccounts[0]!.id,requesterUserId:user.id})).toBe(false)});
 it('enforces approval stage order',()=>{const request={awsAccountId:developmentAccounts[0]!.id,requesterUserId:'someone-else',requiredApprovalStages:['ACCOUNT_APPROVER','SECURITY_REVIEWER','PROVISIONER']};expect(authorization.canApproveRequest(session('user_approver_dev'),request)).toBe(true);expect(authorization.canApproveRequest(session('user_security_dev'),request)).toBe(false);expect(authorization.canApproveRequest(session('user_security_dev'),{...request,completedApprovalStages:['ACCOUNT_APPROVER']})).toBe(true)});
});
describe('approval routing',()=>{it('requires security review and manual provisioning for production',()=>{const route=approvalRouting.route({account:developmentAccounts[0]!,duration:'8 hours',permanent:false,permissionRisk:'High'});expect(route.requiredApprovalStages).toEqual(['ACCOUNT_APPROVER','SECURITY_REVIEWER','PROVISIONER']);expect(route.provisioningMode).toBe('MANUAL');expect(route.permanentAccessAllowed).toBe(false)})});
