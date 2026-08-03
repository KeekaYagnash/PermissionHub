import type { IamPolicySummary } from '../types';

export function mergePolicies(existing:IamPolicySummary[],incoming:IamPolicySummary[]){
 return [...new Map([...existing,...incoming].map(policy=>[policy.arn,policy])).values()].sort((a,b)=>a.policyName.localeCompare(b.policyName));
}

export function shouldShowSlowCatalogueMessage(startedAt:number,now=performance.now(),thresholdMs=5000){
 return now-startedAt>=thresholdMs;
}
