import {describe,it,expect} from 'vitest';
import {policyActions} from './policyActions';
describe('custom policy payload actions',()=>{
 it('reads scalar and array actions from all statements without duplicates',()=>{
  expect(policyActions({Statement:[{Action:'s3:GetObject'},{Action:['s3:GetObject','s3:ListBucket']}]})).toEqual(['s3:GetObject','s3:ListBucket']);
 });
 it('accepts a single statement and ignores invalid values',()=>{
  expect(policyActions({Statement:{Action:['iam:GetUser',null,1]}})).toEqual(['iam:GetUser']);
  expect(policyActions(null)).toEqual([]);
 });
});
