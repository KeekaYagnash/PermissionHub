import type { PermissionRequest,RequestStatus,RiskLevel } from '../types';
import { permissionLabel } from './requestQueue';

export type StatusTone='neutral'|'info'|'success'|'warning'|'danger';

export const requestStatusPresentation:Record<RequestStatus,{label:string;tone:StatusTone;description:string}>={
 Draft:{label:'Draft',tone:'neutral',description:'The request has not been submitted yet.'},
 'Pending approval':{label:'Waiting for approval',tone:'info',description:'An approver needs to review this request.'},
 'More information required':{label:'More information needed',tone:'warning',description:'The requester needs to respond before review continues.'},
 Approved:{label:'Approved',tone:'success',description:'The request is approved and waiting for provisioning where required.'},
 Rejected:{label:'Rejected',tone:'danger',description:'The request was declined.'},
 Provisioning:{label:'Provisioning access',tone:'info',description:'PermissionHub is applying the approved AWS change.'},
 Provisioned:{label:'Access granted',tone:'success',description:'The requested access has been granted.'},
 'Provisioning failed':{label:'Provisioning failed',tone:'danger',description:'PermissionHub could not complete the AWS change.'},
 Expired:{label:'Expired',tone:'neutral',description:'Temporary access has reached its expiry time.'},
 Revoked:{label:'Revoked',tone:'neutral',description:'The access grant was removed.'}
};

export function statusPresentation(status:RequestStatus){return requestStatusPresentation[status]??{label:status,tone:'neutral' as const,description:status}}
export function isOpenRequest(request:PermissionRequest){return ['Draft','Pending approval','More information required','Approved','Provisioning','Provisioning failed'].includes(request.status)}
export function isClosedRequest(request:PermissionRequest){return ['Rejected','Expired','Revoked'].includes(request.status)}
export function isGrantedRequest(request:PermissionRequest){return request.status==='Provisioned'}
export function needsRequesterResponse(request:PermissionRequest,userId?:string){return request.status==='More information required'&&(!request.requesterUserId||request.requesterUserId===userId)}
export function expiringSoon(request:PermissionRequest,now=Date.now()){return Boolean(request.expiryDate&&Date.parse(request.expiryDate)>now&&Date.parse(request.expiryDate)<now+7*86400000)}
export function requestRisk(request:PermissionRequest):RiskLevel{
 const text=[request.title,permissionLabel(request),request.items.flatMap(item=>item.actions??[]).join(' ')].join(' ').toLowerCase();
 if(text.includes('administrator')||text.includes('iam:*')||text.includes('*:*'))return 'Critical';
 if(text.includes('write')||text.includes('delete')||text.includes('attach')||text.includes('put')||text.includes('poweruser'))return 'High';
 if(request.scope.type==='ALL')return 'Moderate';
 return 'Low';
}
export function accountLabel(request:PermissionRequest){return request.accountType?request.accountType.replaceAll('_',' '):request.awsAccountId??'Selected account'}
export function approvalStages(request:PermissionRequest){
 const submitted=Boolean(request.submittedAt)||request.status!=='Draft',rejected=request.status==='Rejected',info=request.status==='More information required',approved=['Approved','Provisioning','Provisioned','Provisioning failed'].includes(request.status),provisioning=['Provisioning','Provisioned','Provisioning failed'].includes(request.status),granted=request.status==='Provisioned';
 return [
  {label:'Request submitted',state:submitted?'complete':'waiting',detail:request.submittedAt},
  {label:info?'Information requested':'Approval',state:rejected?'failed':approved?'complete':submitted?'active':'waiting',detail:info?request.approvalComment:request.approver},
  {label:'Provisioning',state:request.status==='Provisioning failed'?'failed':provisioning?'complete':approved?'active':'waiting',detail:request.status==='Provisioning failed'?'Failed':approved?'Ready':'Waiting'},
  {label:'Access granted',state:granted?'complete':'waiting',detail:request.expiryDate?`Expires ${formatDate(request.expiryDate)}`:granted?'No automatic expiry':'Waiting'}
 ] as const;
}
export function shortDate(value?:string){return value?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(value)):'Draft'}
export function formatDate(value?:string){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not available'}
