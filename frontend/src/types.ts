export type TargetType='USER'|'ROLE';
export type RequestStatus='Draft'|'Pending approval'|'More information required'|'Approved'|'Rejected'|'Provisioning'|'Provisioned'|'Provisioning failed'|'Expired'|'Revoked';
export type PolicyType='AWS_MANAGED'|'CUSTOMER_MANAGED';
export type RiskLevel='Low'|'Moderate'|'High'|'Critical';

export interface Page<T>{data:T[];pagination:{page:number;pageSize:number;total:number;totalPages:number};nextCursor?:string;isComplete?:boolean;loadedCount?:number;cacheStatus?:string;timing?:Record<string,unknown>}
export interface ConnectionStatus{mode:'MOCK'|'LIVE';connected:boolean;accountId:string;principalArn:string;region:string;credentialSource:string;lastChecked:string;message?:string;errorCode?:string}
export interface AttachedPolicy{policyName:string;policyArn:string}
export interface IamIdentity{id:string;type:TargetType;name:string;arn:string;path:string;createdAt:string;description?:string;passwordEnabled?:boolean;maxSessionDuration?:number;attachedPolicies:AttachedPolicy[];inlinePolicies:string[];permissionBoundary?:string;tags?:Record<string,string>;trustPolicy?:unknown;serviceLinked?:boolean}
export interface RiskAnalysis{level:RiskLevel;flags:string[];services:string[];accessLevels:string[]}
export interface IamPolicySummary{policyName:string;arn:string;policyId?:string;path?:string;description?:string;type:PolicyType;currentVersion:string;createdAt:string;updatedAt:string;attachmentCount:number;permissionsBoundaryUsageCount?:number;isAttachable?:boolean;services:string[];accessLevels:string[];risk:RiskAnalysis;deprecated:boolean}
export interface IamPolicyDetail extends IamPolicySummary{document:Record<string,unknown>;statements:unknown[];actions:string[];resources:string[];conditions:unknown[];attachedUsers:string[];attachedRoles:string[];attachedGroups:string[];observations:string[]}
export interface AwsResource{id:string;name:string;service:'S3'|'RDS'|'Lambda';type:string;region:string;arn:string;status:string;tags:Record<string,string>}
export interface RequestItem{mode:'MANAGED_POLICY'|'SPECIFIC_ACTIONS';policyArn?:string;policyName?:string;actions?:string[];generatedPolicyDocument?:Record<string,unknown>}
export interface PermissionRequest{id:string;title:string;requester:string;approver:string;targetType:TargetType;targetName:string;targetArn:string;items:RequestItem[];scope:{type:'ALL'|'RESOURCE'|'ARN';resources:string[];arn?:string};duration:string;startDate:string;expiryDate?:string;priority:'Low'|'Medium'|'High'|'Critical'|'Normal'|'Urgent';justification:string;notes?:string;status:RequestStatus;submittedAt?:string;createdAt:string;approvalComment?:string;provisioningResult?:unknown;simulationResult?:unknown;timeline:{label:string;timestamp:string;result?:string}[];preview?:PermissionPreview}
export interface PermissionPreview{estimate:boolean;before:{managedPolicies:AttachedPolicy[];inlinePolicies:string[];effectiveActions:string};change:{policiesToAttach:{policyName?:string;policyArn?:string;actions?:string[]}[];policiesToDetach:unknown[];resourceScope:PermissionRequest['scope'];expiration?:string};after:{managedPolicies:AttachedPolicy[];newlyAllowedActions:string[];riskFlags:string[]};awsOperation:string}
export interface AuditEvent{id:string;timestamp:string;actor:string;requestId?:string;awsAccountId?:string;targetArn?:string;policyArn?:string;action:string;previousState?:unknown;newState?:unknown;result:'SUCCESS'|'FAILED'|'INFO';errorCode?:string;awsRequestId?:string}
export interface Approver{id:string;name:string;email:string;role:string}
