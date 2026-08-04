import axios from 'axios';
import type { AppContext,AuditEvent,AuthSession,AwsAccountContext,AwsResource,ConnectionStatus,IamIdentity,IamPolicyDetail,IamPolicySummary,Page,PermissionRequest } from '../types';
import {buildReviewPayload,type LiveConfirmation,type ReviewAction} from './review';

export const http=axios.create({baseURL:'/api',withCredentials:true});
let csrfToken='';
export const setCsrfToken=(token:string)=>{csrfToken=token};
http.interceptors.request.use(config=>{if(config.method&&!['get','head','options'].includes(config.method.toLowerCase())&&csrfToken)config.headers['X-CSRF-Token']=csrfToken;return config});
http.interceptors.response.use(response=>response,error=>{if(error?.response?.status===401&&!String(error?.config?.url??'').includes('/auth/session')&&!location.pathname.startsWith('/login'))location.assign('/session-expired');return Promise.reject(error)});
const unwrap=<T>(value:{data:{data:T}})=>value.data.data;
const unwrapPage=<T>(value:{data:Page<T>})=>value.data;

export const api={
 session:()=>http.get('/auth/session').then(unwrap<AuthSession>),
 developmentUsers:()=>http.get('/auth/development-users').then(unwrap<any[]>),
 developmentLogin:(userId:string)=>http.post('/auth/development-login',{userId}).then(unwrap<AuthSession>),
 logout:()=>http.post('/auth/logout').then(unwrap<{redirectUrl:string}>),
 selectTenant:(tenantId:string)=>http.post('/auth/select-tenant',{tenantId}).then(unwrap<AuthSession>),
 selectAccount:async(accountRecordId:string)=>{await http.post('/aws/active-account',{accountRecordId});return http.get('/auth/session').then(unwrap<AuthSession>)},
 clearAccount:()=>http.post('/auth/clear-account').then(unwrap<AuthSession>),
 context:()=>http.get('/auth/context').then(unwrap<AppContext>),
 connection:()=>http.get('/aws/connection').then(unwrap<ConnectionStatus>),
 testConnection:()=>http.post('/aws/connection/test').then(unwrap<ConnectionStatus>),
 connections:()=>http.get('/aws/accounts').then(unwrap<AwsAccountContext[]>),
 createAwsAccount:(input:unknown)=>http.post('/aws/accounts',input).then(unwrap<any>),
 validateLocalCredentials:()=>http.post('/aws/local-credentials/validate').then(unwrap<any>),
 validateAwsAccount:(accountId:string)=>http.post(`/aws/accounts/${encodeURIComponent(accountId)}/validate`).then(unwrap<any>),
 updateAwsAccount:(accountId:string,input:unknown)=>http.patch(`/aws/accounts/${encodeURIComponent(accountId)}`,input).then(unwrap<AwsAccountContext>),
 repairAwsAccount:(accountId:string)=>http.post(`/aws/accounts/${encodeURIComponent(accountId)}/repair-connection`,{confirm:true}).then(unwrap<AwsAccountContext>),
 convertAwsAccount:(accountId:string)=>http.post(`/aws/accounts/${encodeURIComponent(accountId)}/convert-to-manual`,{confirm:true}).then(unwrap<AwsAccountContext>),
 removeAwsAccount:(accountId:string)=>http.delete(`/aws/accounts/${encodeURIComponent(accountId)}`).then(unwrap<any>),
 resetAwsAccount:(accountRecordId:string,dryRun=true,confirm=false)=>http.post(`/aws/accounts/${encodeURIComponent(accountRecordId)}/reset`,{dryRun,confirm}).then(unwrap<any>),
 runtimeDebug:()=>http.get('/debug/runtime').then(unwrap<any>),
 clearAwsCache:()=>http.post('/aws/cache/clear').then(unwrap<any>),
 awsDiagnostics:()=>http.get('/aws/diagnostics').then(unwrap<any>),
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
 review:(id:string,action:ReviewAction,comment:string,idempotencyKey:string,confirmation?:LiveConfirmation)=>http.post(`/requests/${id}/review`,buildReviewPayload(action,comment,idempotencyKey,confirmation)).then(unwrap<any>),
 approve:(id:string,comment:string)=>http.post(`/requests/${id}/approve`,buildReviewPayload('APPROVE',comment)).then(unwrap<PermissionRequest>),
 reject:(id:string,comment:string)=>http.post(`/requests/${id}/reject`,buildReviewPayload('REJECT',comment)).then(unwrap<PermissionRequest>),
 requestInfo:(id:string,comment:string)=>http.post(`/requests/${id}/request-information`,buildReviewPayload('REQUEST_INFORMATION',comment)).then(unwrap<PermissionRequest>),
 simulate:(id:string)=>http.post(`/requests/${id}/simulate`).then(unwrap<any>),
 provision:(id:string)=>http.post(`/requests/${id}/provision`).then(unwrap<any>),
 revoke:(id:string)=>http.post(`/requests/${id}/revoke`).then(unwrap<any>),
 activity:()=>http.get('/activity',{params:{pageSize:100}}).then(unwrapPage<AuditEvent>),
 approvers:(requestId?:string)=>http.get('/approvers',{params:{requestId}}).then(unwrap<any[]>),
 reassignApprover:(requestId:string,approverUserId:string)=>http.post(`/requests/${requestId}/reassign-approver`,{approverUserId}).then(unwrap<any>),
 validateProvisionRole:(accountRecordId:string)=>http.post(`/aws/accounts/${encodeURIComponent(accountRecordId)}/validate-provision-role`).then(unwrap<any>),
 adminDirectory:()=>http.get('/admin/directory').then(unwrap<any>),
 approvalPolicies:()=>http.get('/admin/approval-policies').then(unwrap<any[]>),
 saveScope:(scope:unknown)=>http.post('/admin/scopes',scope).then(unwrap<any>),
 onboardAccount:(input:unknown)=>http.post('/admin/accounts/onboarding',input).then(unwrap<any>)
};
