export const GUIDE_STORAGE_PREFIX='permissionhub.aws-connection-guide.opened';

export const recommendedRoleName='PermissionHubReadRole';
export const exampleRoleArn='arn:aws:iam::<AWS_ACCOUNT_ID>:role/PermissionHubReadRole';
export const verifyIdentityCommand='aws sts get-caller-identity --profile permissionhub-local';

const trustPolicy={
 Version:'2012-10-17',
 Statement:[{
  Sid:'AllowPermissionHubAssumeRole',Effect:'Allow',
  Principal:{AWS:'<PERMISSIONHUB_BACKEND_PRINCIPAL_ARN>'},
  Action:['sts:AssumeRole','sts:SetSourceIdentity','sts:TagSession'],
  Condition:{StringEquals:{'sts:ExternalId':'<PERMISSIONHUB_EXTERNAL_ID>'}},
 }],
};

export const readPolicy={
 Version:'2012-10-17',
 Statement:[
  {Sid:'PermissionHubAccountValidation',Effect:'Allow',Action:['sts:GetCallerIdentity'],Resource:'*'},
  {Sid:'PermissionHubIamDiscovery',Effect:'Allow',Action:[
   'iam:ListUsers','iam:GetUser','iam:ListRoles','iam:GetRole','iam:ListGroups','iam:ListGroupsForUser',
   'iam:ListPolicies','iam:GetPolicy','iam:GetPolicyVersion','iam:ListPolicyVersions',
   'iam:ListAttachedUserPolicies','iam:ListAttachedRolePolicies','iam:ListAttachedGroupPolicies',
   'iam:ListUserPolicies','iam:ListRolePolicies','iam:ListGroupPolicies','iam:GetUserPolicy','iam:GetRolePolicy',
   'iam:GetGroupPolicy','iam:ListPolicyTags','iam:GetAccountAuthorizationDetails',
  ],Resource:'*'},
  {Sid:'PermissionHubPolicyValidation',Effect:'Allow',Action:['access-analyzer:ValidatePolicy'],Resource:'*'},
 ],
};

const provisioningPolicy={
 Version:'2012-10-17',
 Statement:[
  {Sid:'ManagePermissionHubPolicies',Effect:'Allow',Action:['iam:CreatePolicy','iam:CreatePolicyVersion','iam:SetDefaultPolicyVersion','iam:DeletePolicyVersion','iam:TagPolicy'],Resource:'arn:aws:iam::*:policy/permissionhub/*'},
  {Sid:'AttachAndDetachApprovedPolicies',Effect:'Allow',Action:['iam:AttachUserPolicy','iam:DetachUserPolicy','iam:AttachRolePolicy','iam:DetachRolePolicy'],Resource:['arn:aws:iam::*:user/*','arn:aws:iam::*:role/*']},
  {Sid:'ManageApprovedInlinePolicies',Effect:'Allow',Action:['iam:PutUserPolicy','iam:DeleteUserPolicy','iam:PutRolePolicy','iam:DeleteRolePolicy'],Resource:['arn:aws:iam::*:user/*','arn:aws:iam::*:role/*']},
 ],
};

export const policyText={
 trust:JSON.stringify(trustPolicy,null,2),
 read:JSON.stringify(readPolicy,null,2),
 provisioning:JSON.stringify(provisioningPolicy,null,2),
};

export const awsDocumentation=[
 ['IAM security best practices','https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html'],
 ['Create an IAM user','https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html'],
 ['Manage IAM user access keys','https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'],
 ['Create a role with a custom trust policy','https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-custom.html'],
 ['IAM roles','https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html'],
 ['Cross-account role access','https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html'],
 ['STS AssumeRole','https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html'],
 ['IAM policies and permissions','https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html'],
 ['Least-privilege preparation','https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started-reduce-permissions.html'],
] as const;

export function guideStorageKey(userId?:string){return `${GUIDE_STORAGE_PREFIX}.${userId??'anonymous'}`}
