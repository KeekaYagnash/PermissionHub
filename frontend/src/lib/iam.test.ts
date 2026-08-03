import { describe,expect,it } from 'vitest';
import { calculateExpiry,fuzzyPolicies,validateApprovalDeadline,validateArnList,validatePolicyJson } from './iam';
import type { IamPolicySummary } from '../types';

const policies:IamPolicySummary[]=[
 {policyName:'AmazonS3ReadOnlyAccess',arn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',description:'Read only access to S3',type:'AWS_MANAGED',currentVersion:'v1',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',attachmentCount:0,services:['s3'],accessLevels:['Read'],risk:{level:'Moderate',flags:[],services:['s3'],accessLevels:['Read']},deprecated:false},
 {policyName:'CloudWatchReadOnlyAccess',arn:'arn:aws:iam::aws:policy/CloudWatchReadOnlyAccess',description:'View CloudWatch metrics',type:'AWS_MANAGED',currentVersion:'v1',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',attachmentCount:0,services:['cloudwatch'],accessLevels:['Read'],risk:{level:'Low',flags:[],services:['cloudwatch'],accessLevels:['Read']},deprecated:false}
];

describe('IAM workflow utilities',()=>{
 it('matches minor policy spelling mistakes',()=>{expect(fuzzyPolicies(policies,'cloud wach')[0]?.policyName).toBe('CloudWatchReadOnlyAccess')});
 it('validates ARN format and service mismatch',()=>{expect(validateArnList('arn:aws:s3:::bucket',['lambda']).errors[0]).toContain('does not match')});
 it('calculates fixed duration expiry',()=>{expect(calculateExpiry('8 hours','2026-08-03T10:00:00.000Z')).toBe('2026-08-03T18:00:00.000Z')});
 it('rejects approval deadlines in the past',()=>{expect(validateApprovalDeadline('2026-08-03T09:00',new Date('2026-08-03T10:00:00Z'))).toContain('cannot be earlier')});
 it('validates policy JSON structure and wildcard warnings',()=>{const result=validatePolicyJson(JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Action:'s3:*',Resource:'*'}]}));expect(result.valid).toBe(true);expect(result.warnings).toContain('Statement 1: wildcard action detected.')});
});
