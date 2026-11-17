interface ApprovalState {status?:string;requiredApprovalStages?:string[];completedApprovalStages?:string[]}
/** Security review is audit-only. Never auto-provision an old pending request. */
export function approvalWorkflow(request:ApprovalState){
 const stored=(request.requiredApprovalStages??['ACCOUNT_APPROVER']).filter(stage=>stage!=='PROVISIONER');
 const stages=stored.filter(stage=>stage!=='SECURITY_REVIEWER');if(!stages.length)stages.push('ACCOUNT_APPROVER');
 const recorded=request.completedApprovalStages??[];
 let completed=recorded.filter(stage=>stage!=='SECURITY_REVIEWER');
 const legacySecurity=stored.includes('SECURITY_REVIEWER');
 const resetAssignment=request.status==='Pending approval'&&legacySecurity&&(stored[recorded.length]==='SECURITY_REVIEWER'||completed.length>=stages.length||stored.every(stage=>stage==='SECURITY_REVIEWER'));
 if(resetAssignment&&completed.length>=stages.length)completed=completed.slice(0,stages.length-1);
 return {stages,completed,resetAssignment,legacySecurity};
}
export function approvalView<T extends ApprovalState&{approver?:string;approverUserId?:string}>(request:T){const flow=approvalWorkflow(request);return {...request,requiredApprovalStages:[...flow.stages,'PROVISIONER'],completedApprovalStages:flow.completed,...(flow.resetAssignment?{approver:flow.stages[flow.completed.length]?.replaceAll('_',' ')??'ACCOUNT APPROVER',approverUserId:undefined}:{})}}
