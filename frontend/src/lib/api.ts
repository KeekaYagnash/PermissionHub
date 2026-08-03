import axios from 'axios';
import type { AuditEvent,AwsResource,ConnectionStatus,IamIdentity,IamPolicyDetail,IamPolicySummary,Page,PermissionRequest } from '../types';

export const http=axios.create({baseURL:'/api'});
const unwrap=<T>(value:{data:{data:T}})=>value.data.data;
const unwrapPage=<T>(value:{data:Page<T>})=>value.data;

export const api={
 connection:()=>http.get('/aws/connection').then(unwrap<ConnectionStatus>),
 testConnection:()=>http.post('/aws/connection/test').then(unwrap<ConnectionStatus>),
 users:(search='')=>http.get('/aws/identities/users',{params:{search,pageSize:100}}).then(unwrapPage<IamIdentity>),
 roles:(search='',includeServiceLinked=false)=>http.get('/aws/identities/roles',{params:{search,includeServiceLinked,pageSize:100}}).then(unwrapPage<IamIdentity>),
 policies:(params:Record<string,string|number|undefined>,signal?:AbortSignal)=>http.get('/aws/policies',{params:{pageSize:25,...params},signal}).then(unwrapPage<IamPolicySummary>),
 policy:(arn:string)=>http.get(`/aws/policies/${encodeURIComponent(arn)}`).then(unwrap<IamPolicyDetail>),
 validatePolicy:(document:Record<string,unknown>)=>http.post('/aws/policies/validate',{document}).then(unwrap<any>),
 resources:()=>http.get('/aws/resources').then(unwrap<AwsResource[]>),
 requests:(params:Record<string,string|number|undefined>={})=>http.get('/requests',{params:{pageSize:100,...params}}).then(unwrapPage<PermissionRequest>),
 request:(id:string)=>http.get(`/requests/${id}`).then(unwrap<PermissionRequest>),
 createRequest:(payload:unknown)=>http.post('/requests',payload).then(unwrap<PermissionRequest>),
 submitRequest:(id:string)=>http.post(`/requests/${id}/submit`).then(unwrap<PermissionRequest>),
 approve:(id:string,comment:string)=>http.post(`/requests/${id}/approve`,{comment}).then(unwrap<PermissionRequest>),
 reject:(id:string,comment:string)=>http.post(`/requests/${id}/reject`,{comment}).then(unwrap<PermissionRequest>),
 requestInfo:(id:string,comment:string)=>http.post(`/requests/${id}/request-information`,{comment}).then(unwrap<PermissionRequest>),
 simulate:(id:string)=>http.post(`/requests/${id}/simulate`).then(unwrap<any>),
 provision:(id:string)=>http.post(`/requests/${id}/provision`).then(unwrap<any>),
 revoke:(id:string)=>http.post(`/requests/${id}/revoke`).then(unwrap<any>),
 activity:()=>http.get('/activity',{params:{pageSize:100}}).then(unwrapPage<AuditEvent>),
 approvers:()=>http.get('/approvers').then(unwrap<any[]>)
};
