import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectCognitoRecovery} from './cognito-recovery.mjs';
const fixture=()=>({state:{resources:[
 {mode:'managed',module:'module.cognito',type:'aws_cognito_user_pool',name:'this',instances:[{attributes:{id:'af-south-1_test',name:'permissionhub-dev'}}]},
 {mode:'managed',module:'module.cognito',type:'aws_cognito_user_pool_domain',name:'this',instances:[{index_key:0,status:'tainted',attributes:{id:'permissionhub-demo-dev',domain:'permissionhub-demo-dev',user_pool_id:'af-south-1_test'}}]}
]},description:{DomainDescription:{Status:'ACTIVE',AWSAccountId:'143671530412',UserPoolId:'af-south-1_test'}}});
test('recovery accepts only the active domain matching the state-managed dev pool',()=>{
 const {state,description}=fixture();
 assert.equal(inspectCognitoRecovery(state,description).tainted,true);
 delete state.resources[1].instances[0].status;
 assert.equal(inspectCognitoRecovery(state,description).tainted,false);
});
test('recovery refuses inactive, missing, wrong-account and wrong-pool domains',()=>{
 for(const patch of [{Status:'CREATING'},{Status:'FAILED'},{AWSAccountId:'000000000000'},{UserPoolId:'another-pool'}]){
  const {state,description}=fixture();Object.assign(description.DomainDescription,patch);assert.throws(()=>inspectCognitoRecovery(state,description));
 }
 const {state}=fixture();assert.throws(()=>inspectCognitoRecovery(state,{}));
 assert.throws(()=>inspectCognitoRecovery({resources:[]},fixture().description));
});
test('recovery cannot clear taint for arbitrary or unassociated state resources',()=>{
 for(const field of ['id','domain','user_pool_id']){
  const {state,description}=fixture();state.resources[1].instances[0].attributes[field]='unexpected';assert.throws(()=>inspectCognitoRecovery(state,description));
 }
 const {state,description}=fixture();state.resources[0].instances[0].attributes.name='production';assert.throws(()=>inspectCognitoRecovery(state,description));
});
