import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectMigrationLogRecovery,migrationLogName,migrationLogArn} from './log-group-recovery.mjs';
const fixture=()=>({state:{resources:[{mode:'managed',module:'module.migration_lambda',type:'aws_cloudwatch_log_group',name:'this',instances:[{status:'tainted',attributes:{name:migrationLogName,id:migrationLogName}}]}]},description:{logGroups:[{logGroupName:migrationLogName,arn:`${migrationLogArn}:*`,logGroupClass:'STANDARD'}]},tags:{tags:{Application:'PermissionHub',Environment:'dev'}}});
test('only the exact existing owned migration log group can be recovered',()=>{
 const {state,description,tags}=fixture();
 assert.equal(inspectMigrationLogRecovery(state,description,tags).tainted,true);
 delete state.resources[0].instances[0].status;
 assert.equal(inspectMigrationLogRecovery(state,description,tags).tainted,false);
 description.logGroups[0].logGroupArn=migrationLogArn;
 assert.equal(inspectMigrationLogRecovery(state,description,tags).exists,true);
});
test('missing, wrong-region/account/class or similarly named AWS log groups are rejected',()=>{
 for(const patch of [{logGroupName:migrationLogName+'-other'},{arn:migrationLogArn.replace('143671530412','000000000000')},{arn:migrationLogArn.replace('af-south-1','us-east-1')},{logGroupClass:'INFREQUENT_ACCESS'}]){
  const {state,description,tags}=fixture();Object.assign(description.logGroups[0],patch);assert.throws(()=>inspectMigrationLogRecovery(state,description,tags));
 }
 const {state,tags}=fixture();assert.throws(()=>inspectMigrationLogRecovery(state,{logGroups:[]},tags));
});
test('recovery cannot clear taint for another resource or unowned log group',()=>{
 for(const tag of [{},{Application:'Other',Environment:'dev'},{Application:'PermissionHub',Environment:'prod'}]){
  const {state,description}=fixture();assert.throws(()=>inspectMigrationLogRecovery(state,description,{tags:tag}));
 }
 const {state,description,tags}=fixture();state.resources[0].module='module.api_lambda';assert.throws(()=>inspectMigrationLogRecovery(state,description,tags));
 assert.throws(()=>inspectMigrationLogRecovery({resources:[]},description,tags));
});
