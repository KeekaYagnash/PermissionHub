import { describe, expect, it } from 'vitest';
import { filterRequest, permissionLabel, requestSearchText, scopeLabel, sortRequests } from './requestQueue';
import { canOpenWizardStep, shouldShowScheduledStartInput, unlockNextWizardStep } from './wizard';
import { mergePolicies, shouldShowSlowCatalogueMessage } from './policyCatalogue';
import { fuzzyPolicies } from './iam';
import type { PermissionRequest } from '../types';

const baseRequest:PermissionRequest={
 id:'PR-2001',
 title:'Finance S3 read access',
 requester:'Priya Shah',
 approver:'Jordan Lee',
 targetType:'USER',
 targetName:'priya.shah',
 targetArn:'arn:aws:iam::123456789012:user/priya.shah',
 items:[{mode:'MANAGED_POLICY',policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],
 scope:{type:'RESOURCE',resources:['finance-reports']},
 duration:'7 days',
 startDate:'2026-08-03T10:00:00.000Z',
 expiryDate:'2026-08-10T10:00:00.000Z',
 priority:'Normal',
 justification:'Required to reconcile finance reporting files for August close.',
 status:'Pending approval',
 submittedAt:'2026-08-03T09:00:00.000Z',
 createdAt:'2026-08-03T08:45:00.000Z',
 timeline:[]
};

describe('wizard gating',()=>{
 it('does not allow future steps before they are unlocked',()=>{
  expect(canOpenWizardStep(1,1)).toBe(true);
  expect(canOpenWizardStep(2,1)).toBe(false);
 });

 it('unlocks the next step while preserving completed-step navigation',()=>{
  expect(unlockNextWizardStep(2,2,6)).toEqual({nextStep:3,nextMaxUnlocked:3});
  expect(unlockNextWizardStep(6,6,6)).toEqual({nextStep:6,nextMaxUnlocked:6});
 });

 it('renders scheduled-start input only for scheduled access',()=>{
  expect(shouldShowScheduledStartInput('scheduled')).toBe(true);
  expect(shouldShowScheduledStartInput('after-approval')).toBe(false);
 });
});

describe('request queue helpers',()=>{
 it('filters awaiting approval and expiring requests',()=>{
  expect(filterRequest(baseRequest,'Awaiting my approval')).toBe(true);
  expect(filterRequest(baseRequest,'Expiring',Date.parse('2026-08-04T10:00:00.000Z'))).toBe(true);
  expect(filterRequest({...baseRequest,status:'Rejected'},'Awaiting my approval')).toBe(false);
 });

 it('builds searchable text from request fields',()=>{
  const text=requestSearchText(baseRequest);
  expect(text).toContain('pr-2001');
  expect(text).toContain('amazons3readonlyaccess');
  expect(text).toContain('finance-reports');
 });

 it('formats permission and scope labels without dropping managed policies',()=>{
  expect(permissionLabel(baseRequest)).toBe('AmazonS3ReadOnlyAccess');
  expect(scopeLabel(baseRequest)).toBe('finance-reports');
 });

 it('sorts requests by newest submitted first',()=>{
  const older={...baseRequest,id:'PR-2000',submittedAt:'2026-08-01T09:00:00.000Z'};
  expect([older,baseRequest].sort((a,b)=>sortRequests(a,b,'submitted-desc')).map(item=>item.id)).toEqual(['PR-2001','PR-2000']);
 });
});

describe('policy catalogue helpers',()=>{
 const s3=policy('AmazonS3ReadOnlyAccess','arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess','Read-only S3 access');
 const ec2=policy('AmazonEC2FullAccess','arn:aws:iam::aws:policy/AmazonEC2FullAccess','Full EC2 access');

 it('merges paginated policies without duplicates',()=>{
  const updated={...s3,description:'Updated description'};
  expect(mergePolicies([s3],[ec2,updated]).map(item=>item.arn)).toEqual([ec2.arn,s3.arn]);
  expect(mergePolicies([s3],[updated]).find(item=>item.arn===s3.arn)?.description).toBe('Updated description');
 });

 it('keeps fuzzy search responsive against already loaded rows',()=>{
  expect(fuzzyPolicies([s3,ec2],'s3 read').map(item=>item.policyName)).toContain('AmazonS3ReadOnlyAccess');
 });

 it('shows slow loading message only after threshold',()=>{
  expect(shouldShowSlowCatalogueMessage(1000,5999)).toBe(false);
  expect(shouldShowSlowCatalogueMessage(1000,6000)).toBe(true);
 });
});

function policy(policyName:string,arn:string,description:string){
 return {policyName,arn,description,type:'AWS_MANAGED' as const,currentVersion:'v1',createdAt:'2026-08-03T00:00:00.000Z',updatedAt:'2026-08-03T00:00:00.000Z',attachmentCount:0,services:['S3'],accessLevels:['Read'],risk:{level:'Moderate' as const,flags:['Preliminary metadata-only analysis.'],services:['S3'],accessLevels:['Read']},deprecated:false};
}
