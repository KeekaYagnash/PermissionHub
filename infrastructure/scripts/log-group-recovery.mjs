export const migrationLogAddress='module.migration_lambda.aws_cloudwatch_log_group.this';
export const migrationLogName='/aws/lambda/permissionhub-dev-db-migration';
export const migrationLogArn=`arn:aws:logs:af-south-1:143671530412:log-group:${migrationLogName}`;
export function inspectMigrationLogRecovery(state,description,tagResponse){
 const resource=state.resources?.find(r=>r.mode==='managed'&&r.module==='module.migration_lambda'&&r.type==='aws_cloudwatch_log_group'&&r.name==='this');
 const instance=resource?.instances?.find(i=>i.index_key===undefined);
 if(!instance||instance.attributes?.name!==migrationLogName||instance.attributes.id!==migrationLogName)throw Error('The exact migration log group is not managed in this dev state. No recovery performed.');
 const matches=description.logGroups?.filter(group=>group.logGroupName===migrationLogName)??[];
 const group=matches[0];
 const arn=group?.logGroupArn??group?.arn?.replace(/:\*$/,'');
 if(matches.length!==1||arn!==migrationLogArn||(group.logGroupClass??'STANDARD')!=='STANDARD')throw Error('AWS migration log group name/account/region/class does not match the expected resource. No recovery performed.');
 if(tagResponse.tags?.Application!=='PermissionHub'||tagResponse.tags?.Environment!=='dev')throw Error('AWS log group lacks required PermissionHub/dev ownership tags. No recovery performed.');
 return {logGroup:migrationLogName,account:'143671530412',exists:true,tainted:instance.status==='tainted'};
}
