import axios from 'axios';
import type { AppContext,AuditEvent,AuthSession,AwsAccountContext,AwsResource,ConnectionStatus,IamIdentity,IamPolicyDetail,IamPolicySummary,Page,PermissionRequest } from '../types';

export const http=axios.create({baseURL:'/api',withCredentials:true});
let csrfToken='';
export const setCsrfToken=(token:string)=>{csrfToken=token};
http.interceptors.request.use(config=>{if(config.method&&!['get','head','options'].includes(config.method.toLowerCase())&&csrfToken)config.headers['X-CSRF-Token']=csrfToken;return config});
http.interceptors.response.use(response=>response,error=>{if(error?.response?.status===401&&!String(error?.config?.url??'').includes('/auth/session')&&!location.pathname.startsWith('/login'))location.assign('/session-expired');return Promise.reject(error)});
const unwrap=<T>(value:{data:{data:T}})=>value.data.data;
const unwrapPage=<T>(value:{data:Page<T>})=>value.data;

export const api={
 session:()=>http.get('/auth/session').then(unwrap<AuthSession>),
 authProviders:()=>http.get('/auth/providers').then(unwrap<any>),
 developmentUsers:()=>http.get('/auth/development-users').then(unwrap<any[]>),
 developmentLogin:(userId:string)=>http.post('/auth/development-login',{userId}).then(unwrap<AuthSession>),
 logout:()=>http.post('/auth/logout').then(unwrap<{redirectUrl:string}>),
 selectTenant:(tenantId:string)=>http.post('/auth/select-tenant',{tenantId}).then(unwrap<AuthSession>),
 selectAccount:(accountId:string)=>http.post('/auth/select-account',{accountId}).then(unwrap<AuthSession>),
 context:()=>http.get('/auth/context').then(unwrap<AppContext>),
 connection:()=>http.get('/aws/connection').then(unwrap<ConnectionStatus>),
 testConnection:()=>http.post('/aws/connection/test').then(unwrap<ConnectionStatus>),
 connections:()=>http.get('/aws/connections').then(unwrap<AwsAccountContext[]>),
 validateReadConnection:()=>http.post('/aws/connection/validate-read').then(unwrap<any>),
 testCapabilities:()=>http.post('/aws/connection/capabilities').then(unwrap<any>),
 validateProvisionConnection:()=>http.post('/aws/connection/validate-provision').then(unwrap<any>),
 setConnectionStatus:(status:'DISABLED'|'PENDING')=>http.post('/aws/connection/status',{status}).then(unwrap<AwsAccountContext>),
 syncOrganisation:(organisationId:string)=>http.post(`/aws/organisations/${encodeURIComponent(organisationId)}/sync`).then(unwrap<any>),
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
 approvers:()=>http.get('/approvers').then(unwrap<any[]>),
 adminDirectory:()=>http.get('/admin/directory').then(unwrap<any>),
 approvalPolicies:()=>http.get('/admin/approval-policies').then(unwrap<any[]>),
 saveScope:(scope:unknown)=>http.post('/admin/scopes',scope).then(unwrap<any>),
 onboardAccount:(input:unknown)=>http.post('/admin/accounts/onboarding',input).then(unwrap<any>)
};
