export const cognitoDomainAddress='module.cognito.aws_cognito_user_pool_domain.this[0]';
export function inspectCognitoRecovery(state,description){
 const find=type=>state.resources?.find(r=>r.mode==='managed'&&r.module==='module.cognito'&&r.type===type&&r.name==='this');
 const domain=find('aws_cognito_user_pool_domain')?.instances?.find(i=>i.index_key===0);
 const pool=find('aws_cognito_user_pool')?.instances?.find(i=>i.index_key===undefined);
 const aws=description.DomainDescription;
 if(!domain||!pool)throw Error('Expected Cognito domain and user pool are not both managed in this application state. No recovery performed.');
 if(domain.attributes?.domain!=='permissionhub-demo-dev'||domain.attributes?.id!=='permissionhub-demo-dev')throw Error('Unexpected domain in state. No recovery performed.');
 if(!pool.attributes?.id||pool.attributes.name!=='permissionhub-dev'||domain.attributes.user_pool_id!==pool.attributes.id)throw Error('Domain/user-pool state association does not match the expected dev pool. No recovery performed.');
 if(aws?.Status!=='ACTIVE'||aws.AWSAccountId!=='143671530412'||aws.UserPoolId!==pool.attributes.id)throw Error('AWS domain is not ACTIVE in the expected account and state-managed user pool. No recovery performed.');
 return {domain:'permissionhub-demo-dev',userPoolId:pool.attributes.id,account:'143671530412',status:'ACTIVE',tainted:domain.status==='tainted'};
}
