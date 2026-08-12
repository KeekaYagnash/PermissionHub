import {describe,expect,it} from 'vitest';
import {getProvisioningErrorPresentation} from './provisioningErrors';

describe('provisioning error presentation',()=>{
 it('classifies policy name collisions as retryable rename failures',()=>{
  expect(getProvisioningErrorPresentation('POLICY_NAME_CONFLICT: PH-PR-1010-1')).toMatchObject({title:'Policy name conflict',errorCode:'POLICY_NAME_CONFLICT',isRetryable:true,supportsPolicyRename:true,severity:'warning'});
 });
 it('does not offer unsafe automatic retry for AccessDenied',()=>{
  expect(getProvisioningErrorPresentation('AccessDenied: not authorized to perform iam:CreatePolicy')).toMatchObject({title:'AWS denied the provisioning operation',isRetryable:false,supportsPolicyRename:false,severity:'danger'});
 });
 it('treats throttling as retryable without policy rename',()=>{
  expect(getProvisioningErrorPresentation('Throttling: Rate exceeded')).toMatchObject({title:'AWS temporarily throttled the request',isRetryable:true,supportsPolicyRename:false});
 });
 it('identifies missing IAM targets',()=>{
  expect(getProvisioningErrorPresentation('NoSuchEntity: User not found')).toMatchObject({title:'Target IAM resource no longer exists',isRetryable:false});
 });
});
