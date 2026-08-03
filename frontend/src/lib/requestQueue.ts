import type { PermissionRequest } from '../types';

export function filterRequest(request:PermissionRequest,active:string,now=Date.now()){
 if(active==='All'||active==='My requests')return true;
 if(active==='Awaiting my approval')return request.status==='Pending approval';
 if(active==='Expiring')return Boolean(request.expiryDate&&Date.parse(request.expiryDate)<now+7*86400000);
 return request.status===active;
}

export function requestSearchText(request:PermissionRequest){
 return [request.id,request.title,request.requester,request.approver,request.targetName,permissionLabel(request),scopeLabel(request),request.status].join(' ').toLowerCase();
}

export function sortRequests(a:PermissionRequest,b:PermissionRequest,sort:string){
 if(sort==='submitted-asc')return Date.parse(a.submittedAt??a.createdAt)-Date.parse(b.submittedAt??b.createdAt);
 if(sort==='title-asc')return a.title.localeCompare(b.title);
 if(sort==='status-asc')return a.status.localeCompare(b.status);
 return Date.parse(b.submittedAt??b.createdAt)-Date.parse(a.submittedAt??a.createdAt);
}

export function permissionLabel(request:PermissionRequest){
 return request.items.map(item=>item.policyName??item.actions?.join(', ')).filter(Boolean).join(', ')||'No permission selected';
}

export function scopeLabel(request:PermissionRequest){
 return request.scope.type==='ALL'?'All applicable':request.scope.resources.join(', ')||request.scope.arn||'Unscoped';
}
