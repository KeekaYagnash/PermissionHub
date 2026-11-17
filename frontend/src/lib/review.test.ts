import {describe,expect,it} from 'vitest';
import {approvalProvisionLabel,buildReviewPayload,reviewCommentError,reviewProvisionButtonDisabled,provisionCredentialsReady} from './review';

describe('review request payload',()=>{
 it.each(['APPROVE','APPROVE_AND_PROVISION'] as const)('omits an empty optional comment for %s',action=>{
  expect(buildReviewPayload(action,'   ','operation-123')).toEqual({action,idempotencyKey:'operation-123'});
 });
 it('trims a supplied comment',()=>expect(buildReviewPayload('APPROVE','  looks good  ')).toEqual({action:'APPROVE',comment:'looks good'}));
 it('includes explicit live confirmation without changing comment normalisation',()=>expect(buildReviewPayload('APPROVE_AND_PROVISION',' ','operation-123',{permissionsReviewed:true,liveChangesAcknowledged:true})).toEqual({action:'APPROVE_AND_PROVISION',idempotencyKey:'operation-123',confirmation:{permissionsReviewed:true,liveChangesAcknowledged:true}}));
 it('requires comments only for reject and request information',()=>{
  expect(reviewCommentError('APPROVE','')).toBeUndefined();
  expect(reviewCommentError('APPROVE_AND_PROVISION','   ')).toBeUndefined();
  expect(reviewCommentError('REJECT','')).toBe('Enter a reason before rejecting this request.');
  expect(reviewCommentError('REQUEST_INFORMATION',' ')).toBe('Explain what additional information is required.');
 });
 it('uses safety-mode-specific button labels',()=>{
  expect(approvalProvisionLabel('disabled')).toBe('Approve — provisioning disabled');
  expect(approvalProvisionLabel('dry-run')).toBe('Approve and validate change');
  expect(approvalProvisionLabel('live')).toBe('Approve and provision');
 expect(approvalProvisionLabel('local')).toBe('Approve and Provision');
 });
 it('retains local workflow behavior but prevents duplicate submissions in every mode',()=>{expect(reviewProvisionButtonDisabled('local',false,false,false)).toBe(false);expect(reviewProvisionButtonDisabled('local',true,true,true)).toBe(true);expect(reviewProvisionButtonDisabled('live',false,true,false)).toBe(true)});
 it('uses server credential readiness for access-key and assumed-role provisioning',()=>{
  expect(provisionCredentialsReady({checklist:[{key:'provisionRole',passed:true}]})).toBe(true);
  expect(provisionCredentialsReady({checklist:[{key:'provisionRole',passed:false}]})).toBe(false);
  expect(provisionCredentialsReady()).toBe(false);
 });
});
