export type ReviewAction='APPROVE'|'APPROVE_AND_PROVISION'|'REJECT'|'REQUEST_INFORMATION';
export type ProvisioningMode='disabled'|'dry-run'|'live'|'local';

export interface LiveConfirmation{phrase:string;safeTargetConfirmed:true;awsMutationConfirmed:true;manualCleanupAccepted?:boolean}
export function buildReviewPayload(action:ReviewAction,comment:string,idempotencyKey?:string,confirmation?:LiveConfirmation){const trimmed=comment.trim();return {action,...(trimmed?{comment:trimmed}:{}),...(idempotencyKey?{idempotencyKey}:{}),...(confirmation?{confirmation}:{})}}
export function approvalProvisionLabel(mode:ProvisioningMode){return mode==='dry-run'?'Approve and validate change':mode==='live'?'Approve and provision':mode==='local'?'Approve and provision locally':'Approve — provisioning disabled'}
export function reviewCommentError(action:ReviewAction,comment:string){const trimmed=comment.trim();if(action==='REJECT'&&!trimmed)return 'Enter a reason before rejecting this request.';if(action==='REQUEST_INFORMATION'&&!trimmed)return 'Explain what additional information is required.';if(trimmed&&trimmed.length<2)return 'Review comments must contain at least 2 characters.';return undefined}
