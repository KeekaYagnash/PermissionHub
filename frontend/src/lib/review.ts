export type ReviewAction='APPROVE'|'APPROVE_AND_PROVISION'|'REJECT'|'REQUEST_INFORMATION';
export type ProvisioningMode='disabled'|'dry-run'|'live'|'local';

export interface LiveConfirmation{permissionsReviewed:true;liveChangesAcknowledged:true}
export function buildReviewPayload(action:ReviewAction,comment:string,idempotencyKey?:string,confirmation?:LiveConfirmation){const trimmed=comment.trim();return {action,...(trimmed?{comment:trimmed}:{}),...(idempotencyKey?{idempotencyKey}:{}),...(confirmation?{confirmation}:{})}}
export function approvalProvisionLabel(mode:ProvisioningMode){return mode==='dry-run'?'Approve and validate change':mode==='live'?'Approve and provision':mode==='local'?'Approve and Provision':'Approve — provisioning disabled'}
export function reviewProvisionButtonDisabled(mode:ProvisioningMode,busy:boolean,pending:boolean,allowed:boolean){return busy||(mode==='local'?false:!pending||!allowed)}
/** The server recognizes either selected access keys or a validated execution role. */
export function provisionCredentialsReady(capabilities?:{checklist:{key:string;passed:boolean}[]}){return capabilities?.checklist.some(item=>item.key==='provisionRole'&&item.passed)??false}
export function reviewCommentError(action:ReviewAction,comment:string){const trimmed=comment.trim();if(action==='REJECT'&&!trimmed)return 'Enter a reason before rejecting this request.';if(action==='REQUEST_INFORMATION'&&!trimmed)return 'Explain what additional information is required.';if(trimmed&&trimmed.length<2)return 'Review comments must contain at least 2 characters.';return undefined}
