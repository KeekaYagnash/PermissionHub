import type { AccountType,AwsAccountContext } from '../types.js';

export interface ApprovalRouteInput {account:AwsAccountContext;permissionRisk?:'Low'|'Moderate'|'High'|'Critical';duration:string;permanent:boolean;resourceSensitivity?:string}
export interface ApprovalRoute {policyId:string;requiredApprovalStages:string[];provisioningMode:'AUTOMATIC'|'MANUAL';maximumDurationHours?:number;permanentAccessAllowed:boolean;extraValidationRequirements:string[]}
const policies:Record<AccountType,Omit<ApprovalRoute,'policyId'>>={
 DEVELOPMENT:{requiredApprovalStages:['ACCOUNT_APPROVER'],provisioningMode:'AUTOMATIC',maximumDurationHours:24*30,permanentAccessAllowed:true,extraValidationRequirements:[]},
 SANDBOX:{requiredApprovalStages:['ACCOUNT_APPROVER'],provisioningMode:'AUTOMATIC',maximumDurationHours:24*30,permanentAccessAllowed:true,extraValidationRequirements:[]},
 STAGING:{requiredApprovalStages:['ACCOUNT_APPROVER'],provisioningMode:'AUTOMATIC',maximumDurationHours:24*7,permanentAccessAllowed:false,extraValidationRequirements:[]},
 PRODUCTION:{requiredApprovalStages:['ACCOUNT_APPROVER','SECURITY_REVIEWER','PROVISIONER'],provisioningMode:'MANUAL',maximumDurationHours:24*7,permanentAccessAllowed:false,extraValidationRequirements:['Account owner approval','Security review for elevated permissions']},
 SECURITY:{requiredApprovalStages:['SECURITY_REVIEWER','ORGANISATION_ADMIN','PROVISIONER'],provisioningMode:'MANUAL',maximumDurationHours:24,permanentAccessAllowed:false,extraValidationRequirements:['Mandatory expiry','Security lead approval']},
 MANAGEMENT:{requiredApprovalStages:['ORGANISATION_ADMIN','SECURITY_REVIEWER','PROVISIONER'],provisioningMode:'MANUAL',maximumDurationHours:8,permanentAccessAllowed:false,extraValidationRequirements:['Multiple approvals','Manual provisioning']},
 LOG_ARCHIVE:{requiredApprovalStages:['SECURITY_REVIEWER','PROVISIONER'],provisioningMode:'MANUAL',maximumDurationHours:24,permanentAccessAllowed:false,extraValidationRequirements:['Mandatory expiry']},
 SHARED_SERVICES:{requiredApprovalStages:['ACCOUNT_APPROVER','PROVISIONER'],provisioningMode:'MANUAL',maximumDurationHours:24*7,permanentAccessAllowed:false,extraValidationRequirements:[]},
 NETWORK:{requiredApprovalStages:['ACCOUNT_APPROVER','SECURITY_REVIEWER','PROVISIONER'],provisioningMode:'MANUAL',maximumDurationHours:24,permanentAccessAllowed:false,extraValidationRequirements:['Network change review']},
 EXTERNAL:{requiredApprovalStages:['ACCOUNT_APPROVER','SECURITY_REVIEWER','PROVISIONER'],provisioningMode:'MANUAL',maximumDurationHours:24,permanentAccessAllowed:false,extraValidationRequirements:['External account owner approval']}
};
export class ApprovalRoutingService {route(input:ApprovalRouteInput):ApprovalRoute{const base=policies[input.account.accountType],stages=[...base.requiredApprovalStages];if((input.permissionRisk==='High'||input.permissionRisk==='Critical')&&!stages.includes('SECURITY_REVIEWER'))stages.splice(Math.max(1,stages.length-1),0,'SECURITY_REVIEWER');return {...base,policyId:`default-${input.account.accountType.toLowerCase()}`,requiredApprovalStages:stages}}}
export const approvalRouting=new ApprovalRoutingService();
