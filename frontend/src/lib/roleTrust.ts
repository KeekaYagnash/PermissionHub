export function roleTrustError(type:'SERVICE'|'AWS',principal:string,accountId?:string){
 const value=principal.trim();
 if(type==='SERVICE')return /^[a-z0-9.-]+\.amazonaws\.com(?:\.cn)?$/.test(value)?undefined:'Enter an AWS service principal, for example lambda.amazonaws.com.';
 if(value==='*')return /^\d{12}$/.test(accountId??'')?undefined:'Select an AWS account before using an account-scoped wildcard principal.';
 return !value.includes('*')&&/^arn:aws[a-z-]*:iam::\d{12}:(?:root|(?:role|user)\/.+)$/.test(value)?undefined:'Enter an IAM user or role ARN, or * to restrict trust to the selected account.';
}
export function buildRoleTrustPolicy(type:'SERVICE'|'AWS',principal:string,accountId?:string){
 if(roleTrustError(type,principal,accountId))return undefined;
 return {Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{[type==='SERVICE'?'Service':'AWS']:principal.trim()},Action:'sts:AssumeRole',...(type==='AWS'&&principal.trim()==='*'?{Condition:{StringEquals:{'aws:PrincipalAccount':accountId}}}:{})}]};
}
