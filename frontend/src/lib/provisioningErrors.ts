export type ProvisioningErrorSeverity='warning'|'danger';

export interface ProvisioningErrorPresentation{
 title:string;
 message:string;
 errorCode:string;
 isRetryable:boolean;
 suggestedAction:string;
 supportsPolicyRename:boolean;
 severity:ProvisioningErrorSeverity;
}

export function getProvisioningErrorPresentation(error:unknown):ProvisioningErrorPresentation{
 const text=normalise(error),code=extractCode(text);
 if(/EntityAlreadyExists|POLICY_NAME_CONFLICT|already exists/i.test(text))return {title:'Policy name conflict',message:policyName(text)?`Policy ${policyName(text)} already exists.`:'The generated IAM policy name already exists.',errorCode:code||'EntityAlreadyExists',isRetryable:true,suggestedAction:'Retry with a server-generated policy name.',supportsPolicyRename:true,severity:'warning'};
 if(/AccessDenied|Unauthorized|not authorized/i.test(text))return {title:'AWS denied the provisioning operation',message:'The connected AWS credentials or provisioning role cannot perform the requested IAM operation.',errorCode:code||'AccessDenied',isRetryable:false,suggestedAction:'Check the provisioning role permissions, account context, and CloudTrail before retrying.',supportsPolicyRename:false,severity:'danger'};
 if(/Throttl|TooManyRequests|Rate exceeded/i.test(text))return {title:'AWS temporarily throttled the request',message:'AWS rate limiting interrupted the provisioning attempt.',errorCode:code||'Throttling',isRetryable:true,suggestedAction:'Retry provisioning after a short delay.',supportsPolicyRename:false,severity:'warning'};
 if(/NoSuchEntity|not found|no longer exists/i.test(text))return {title:'Target IAM resource no longer exists',message:'The target identity or policy could not be found in the selected AWS account.',errorCode:code||'NoSuchEntity',isRetryable:false,suggestedAction:'Refresh AWS identities or create a new request for the correct target.',supportsPolicyRename:false,severity:'danger'};
 if(/LimitExceeded|quota/i.test(text))return {title:'AWS IAM limit reached',message:'AWS rejected the request because an IAM quota or limit was reached.',errorCode:code||'LimitExceeded',isRetryable:false,suggestedAction:'Resolve the AWS account quota or policy count issue before retrying.',supportsPolicyRename:false,severity:'danger'};
 return {title:'Provisioning failed',message:text||'PermissionHub could not complete the AWS change.',errorCode:code||'PROVISIONING_FAILED',isRetryable:true,suggestedAction:'Review the technical details and retry after correcting the issue.',supportsPolicyRename:false,severity:'danger'};
}

function normalise(error:unknown){if(!error)return '';if(typeof error==='string')return error;const value=error as any;return [value.name,value.code,value.Code,value.message,value.awsError].filter(Boolean).join(': ')}
function extractCode(text:string){return text.match(/\b(EntityAlreadyExists|POLICY_NAME_CONFLICT|AccessDenied|UnauthorizedOperation|Throttling|TooManyRequestsException|NoSuchEntity|LimitExceeded|ValidationError)\b/i)?.[1]??''}
function policyName(text:string){return text.match(/\b(PH-PR-\d+(?:-[\w-]+)?)\b/)?.[1]}
