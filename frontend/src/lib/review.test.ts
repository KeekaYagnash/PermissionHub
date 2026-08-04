import {describe,expect,it} from 'vitest';
import {approvalProvisionLabel,buildReviewPayload,reviewCommentError} from './review';

describe('review request payload',()=>{
 it.each(['APPROVE','APPROVE_AND_PROVISION'] as const)('omits an empty optional comment for %s',action=>{
  expect(buildReviewPayload(action,'   ','operation-123')).toEqual({action,idempotencyKey:'operation-123'});
 });
 it('trims a supplied comment',()=>expect(buildReviewPayload('APPROVE','  looks good  ')).toEqual({action:'APPROVE',comment:'looks good'}));
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
 });
});
