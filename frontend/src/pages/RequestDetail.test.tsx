// @vitest-environment jsdom
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import RequestDetail,{CapabilityChecklist,isLiveConfirmationReady} from './RequestDetail';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AuthSession,PermissionRequest,ReviewCapabilities} from '../types';

vi.mock('../lib/api',()=>({
 setCsrfToken:vi.fn(),
 api:{request:vi.fn(),connection:vi.fn(),activity:vi.fn(),approvers:vi.fn(),review:vi.fn(),reassignApprover:vi.fn(),simulate:vi.fn(),provision:vi.fn(),revoke:vi.fn()}
}));

const capabilities:ReviewCapabilities={requestId:'PR-1009',canReview:true,canApprove:false,canProvision:false,approvalAllowed:false,provisioningAllowed:false,provisioningMode:'dry-run',reason:'CURRENT_USER_NOT_ELIGIBLE_APPROVER',blockingReasons:['CURRENT_USER_NOT_ELIGIBLE_APPROVER','PROVISIONING_MODE_DRY_RUN'],requiredApproverRoles:['SECURITY_REVIEWER'],currentUserRoles:['ORGANISATION_ADMIN'],checklist:[{key:'approvalEligibility',label:'Eligible approver',passed:false,reason:'Assign the required reviewer role.'},{key:'planValidation',label:'Provisioning plan valid',passed:true}],planValid:true,plannedOperations:[],blockingFields:[],liveTestAllowedPrincipals:[],provisionRoleStatus:'NOT_VALIDATED',expiryRevocationMode:'disabled',selfApprovalAllowed:false};
const session:AuthSession={authenticated:true,csrfToken:'csrf',authProvider:'development',devAuthAvailable:true,user:{id:'reviewer',email:'reviewer@example.com',displayName:'Security Reviewer',provider:'development',providerSubject:'reviewer',activeTenantId:'tenant-1',activeAccountId:'account-1',activeAwsAccountRecordId:'account-1',permissions:['REQUEST_REVIEW','REQUEST_APPROVE','REQUEST_REJECT','REQUEST_VIEW_ALL'],memberships:[]}};
const request:PermissionRequest={id:'PR-1007',title:'Attach S3 read access for finance investigation',requester:'Maya Chen',requesterUserId:'maya',approver:'Security Reviewer',approverUserId:'reviewer',targetType:'USER',targetName:'maya.chen',targetArn:'arn:aws:iam::143671530412:user/maya.chen',items:[{mode:'MANAGED_POLICY',policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],scope:{type:'RESOURCE',resources:['finance-reports-dev']},duration:'7 days',startDate:'2026-08-14T08:33:00.000Z',expiryDate:'2026-08-21T08:33:00.000Z',priority:'High',justification:'Finance reporting job failed and engineering needs read-only bucket access to compare generated report objects with source records.',status:'Pending approval',submittedAt:'2026-08-14T08:33:00.000Z',createdAt:'2026-08-14T08:30:00.000Z',timeline:[{label:'Submitted',timestamp:'2026-08-14T08:33:00.000Z'}],requiredApprovalStages:['ACCOUNT_APPROVER','SECURITY_REVIEWER'],completedApprovalStages:[],accountType:'PRODUCTION',reviewContext:{accountName:'Production',awsAccountNumber:'143671530412',accountType:'PRODUCTION',region:'af-south-1',connectionStatus:'CONNECTED',provisionRoleConfigured:false},reviewCapabilities:capabilities,preview:{estimate:true,before:{managedPolicies:[{policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],inlinePolicies:[],effectiveActions:'estimate'},change:{policiesToAttach:[{policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],policiesToDetach:[],resourceScope:{type:'RESOURCE',resources:['finance-reports-dev']}},after:{managedPolicies:[{policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'},{policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],newlyAllowedActions:[],riskFlags:['Data read access']},awsOperation:'AttachUserPolicy'}};
function renderDetail(value:PermissionRequest=request){const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});return render(<MemoryRouter initialEntries={[`/requests/${value.id}`]}><QueryClientProvider client={client}><Routes><Route path="/requests/:id" element={<RequestDetail/>}/></Routes></QueryClientProvider></MemoryRouter>)}

beforeEach(()=>{useAuthStore.setState({session,loading:false});vi.mocked(api.request).mockResolvedValue(request);vi.mocked(api.approvers).mockResolvedValue([]);vi.mocked(api.activity).mockResolvedValue({data:[],pagination:{page:1,pageSize:10,total:0,totalPages:1}} as any);vi.mocked(api.connection).mockResolvedValue({} as any)});
afterEach(()=>{cleanup();vi.clearAllMocks();useAuthStore.getState().clear()});

it('uses the server stage action for an Account Approver without Provisioner access, prevents double clicks and refreshes the next stage',async()=>{
 const action={action:'APPROVE_AND_PROVISION' as const,currentStage:'ACCOUNT_APPROVER',nextStage:'ORGANISATION_ADMIN',isFinalStage:false,allowed:true,label:'Approve & send to organisation admin',reason:'Approval advances this request to organisation admin. No AWS changes will be made.',willProvision:false};
 const value={...request,reviewCapabilities:{...capabilities,canApprove:true,approvalAllowed:true,canProvision:false,provisioningAllowed:false,provisioningMode:'live' as const,approvalAction:action}};
 vi.mocked(api.request).mockResolvedValue(value);let complete!:(value:{request:PermissionRequest})=>void;vi.mocked(api.review).mockImplementation(()=>new Promise(resolve=>{complete=resolve}));renderDetail(value);
 const button=await screen.findByRole('button',{name:action.label});expect((button as HTMLButtonElement).disabled).toBe(false);expect(screen.getByRole('button',{name:'Request more information'})).toBeTruthy();
 fireEvent.click(button);fireEvent.click(button);await waitFor(()=>expect(api.review).toHaveBeenCalledOnce());expect((button as HTMLButtonElement).disabled).toBe(true);expect(screen.getByText('This request is being processed. Please wait.')).toBeTruthy();expect(screen.queryByRole('dialog')).toBeNull();
 const updated={...value,approver:'Organisation Admin',completedApprovalStages:['ACCOUNT_APPROVER'],reviewCapabilities:{...value.reviewCapabilities,approvalAllowed:false,approvalAction:{...action,currentStage:'ORGANISATION_ADMIN',nextStage:undefined,isFinalStage:true,allowed:false,label:'Approve & provision',reason:'This stage requires organisation admin; your account role is not eligible.'}}};vi.mocked(api.request).mockResolvedValue(updated);complete({request:updated});
 await waitFor(()=>expect((screen.getByRole('button',{name:'Approve & provision'}) as HTMLButtonElement).disabled).toBe(true));expect(screen.getAllByText(/This stage requires organisation admin/).length).toBeGreaterThan(0);expect(api.provision).not.toHaveBeenCalled();
});
it('explains account-scope denial and enables a final approval from server capability rather than a cached Provisioner role',async()=>{
 const action={action:'APPROVE_AND_PROVISION' as const,currentStage:'ACCOUNT_APPROVER',isFinalStage:true,allowed:false,label:'Approve & provision',reason:'You are not assigned approval access for this AWS account.',willProvision:true};const value={...request,reviewCapabilities:{...capabilities,approvalAction:action}};vi.mocked(api.request).mockResolvedValue(value);const view=renderDetail(value);
 expect((await screen.findByRole('button',{name:action.label}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getAllByText(action.reason).length).toBeGreaterThan(0);view.unmount();
 vi.mocked(api.request).mockResolvedValue({...value,reviewCapabilities:{...value.reviewCapabilities,approvalAllowed:true,approvalAction:{...action,allowed:true,reason:'Final approval queues the approved change.'}}});renderDetail(value);expect((await screen.findByRole('button',{name:action.label}) as HTMLButtonElement).disabled).toBe(false);
});
it('keeps a failed queue delivery actionable and retries the same persisted review operation',async()=>{
 const action={action:'APPROVE_AND_PROVISION' as const,currentStage:'ACCOUNT_APPROVER',isFinalStage:true,allowed:true,label:'Approve and validate change',reason:'Final approval.',willProvision:false};const value={...request,reviewCapabilities:{...capabilities,approvalAllowed:true,approvalAction:action}};vi.mocked(api.request).mockResolvedValue(value);vi.mocked(api.review).mockImplementationOnce(async()=>{vi.mocked(api.request).mockResolvedValue({...value,status:'Approved'});throw Object.assign(new Error('Approval was saved, but delivery failed. Retry queue delivery.'),{response:{data:{error:{code:'PROVISIONING_ENQUEUE_FAILED',message:'Approval was saved, but delivery failed. Retry queue delivery.'}}}})}).mockResolvedValueOnce({request:{...value,status:'Approved'}});
 renderDetail(value);fireEvent.click(await screen.findByRole('button',{name:action.label}));const retry=await screen.findByRole('button',{name:'Retry queue delivery'});await waitFor(()=>expect((retry as HTMLButtonElement).disabled).toBe(false));fireEvent.click(retry);await waitFor(()=>expect(api.review).toHaveBeenCalledTimes(2));expect(vi.mocked(api.review).mock.calls[1]?.[3]).toBe(vi.mocked(api.review).mock.calls[0]?.[3]);expect(api.provision).not.toHaveBeenCalled();
});
describe('request provisioning capability UI',()=>{
 it('renders an approver label containing capital T without treating it as a date',async()=>{
  const value={...request,id:'TES-PR-1001',approver:'ACCOUNT_APPROVER'};vi.mocked(api.request).mockResolvedValue(value);renderDetail(value);
  expect(await screen.findByRole('heading',{name:/TES-PR-1001/})).toBeTruthy();expect(screen.queryByText('Unable to display this request')).toBeNull();expect(screen.queryByRole('button',{name:'Approve request'})).toBeNull();
 });
 it('renders a recoverable detail error instead of an endless skeleton for an empty response',async()=>{
  vi.mocked(api.request).mockResolvedValue(null as unknown as PermissionRequest);renderDetail();expect(await screen.findByText('Request not available')).toBeTruthy();expect(screen.getByRole('link',{name:'Back to Requests'})).toBeTruthy();
 });
 it('allows approved IAM role provisioning when the server validates stored credentials without a provision-role ARN',async()=>{
  useAuthStore.setState({session:{...session,user:{...session.user!,permissions:[...session.user!.permissions,'PROVISION_EXECUTE']}}});
  const value:PermissionRequest={...request,targetType:'ROLE',targetName:'FinanceReader',status:'Approved',reviewCapabilities:{...capabilities,provisioningMode:'live',canProvision:true,planValid:true,checklist:[{key:'provisionRole',label:'Connected credentials',passed:true}]}};
  vi.mocked(api.request).mockResolvedValue(value);renderDetail(value);
  expect((await screen.findByRole('button',{name:'Provision access'}) as HTMLButtonElement).disabled).toBe(false);
  expect(api.provision).not.toHaveBeenCalled();
 });
 it('does not enable role provisioning when server credential validation fails',async()=>{
  useAuthStore.setState({session:{...session,user:{...session.user!,permissions:[...session.user!.permissions,'PROVISION_EXECUTE']}}});
  const value:PermissionRequest={...request,targetType:'ROLE',status:'Approved',reviewCapabilities:{...capabilities,provisioningMode:'live',checklist:[{key:'provisionRole',label:'Provision role validated',passed:false}]}};
  vi.mocked(api.request).mockResolvedValue(value);renderDetail(value);
  expect((await screen.findByRole('button',{name:'Provision access'}) as HTMLButtonElement).disabled).toBe(true);
  expect(api.provision).not.toHaveBeenCalled();
 });
 it('shows a recoverable loading failure instead of an endless skeleton',async()=>{
  vi.mocked(api.request).mockRejectedValue(new Error('Connection unavailable'));renderDetail();
  expect(await screen.findByText('Unable to open this request')).toBeTruthy();
  expect(screen.getByRole('link',{name:'Back to Requests'})).toBeTruthy();
 });
 it('renders blocker codes and remediation',()=>{const html=renderToStaticMarkup(<CapabilityChecklist capabilities={capabilities}/>);expect(html).toContain('CURRENT_USER_NOT_ELIGIBLE_APPROVER');expect(html).toContain('Assign the required reviewer role.');expect(html).toContain('SECURITY_REVIEWER');expect(html).toContain('ORGANISATION_ADMIN')});
 it('requires the exact request phrase and both acknowledgements',()=>{expect(isLiveConfirmationReady('PR-1009','PROVISION PR-1009',true,true)).toBe(true);expect(isLiveConfirmationReady('PR-1009','PROVISION PR-1008',true,true)).toBe(false);expect(isLiveConfirmationReady('PR-1009','PROVISION PR-1009',false,true)).toBe(false)});
 it('renders the development bypass without a Provisioner role',()=>{const html=renderToStaticMarkup(<CapabilityChecklist capabilities={{...capabilities,provisioningMode:'local',localProvisioningEnabled:true,canApprove:true,canProvision:true,approvalAllowed:true,provisioningAllowed:true,blockingReasons:[],requiredApproverRoles:['DEVELOPMENT_REVIEW'],currentUserRoles:['REQUESTER'],checklist:[{key:'local',label:'Development provisioning authorization bypass',passed:true}]}}/>);expect(html).toContain('Development provisioning authorization bypass');expect(html).toContain('DEVELOPMENT_REVIEW');expect(html).toContain('REQUESTER')});
 it('renders a compact request overview without duplicate access summary sections',async()=>{renderDetail();const summary=await screen.findByLabelText('Request summary');expect(summary).toBeTruthy();expect(within(summary).getByText(/Maya Chen is requesting/)).toBeTruthy();expect(within(summary).getAllByText('AmazonS3ReadOnlyAccess').length).toBeGreaterThan(0);expect(within(summary).getByText('AWS account')).toBeTruthy();expect(within(summary).getByText('Target identity')).toBeTruthy();expect(screen.getByText('Business justification')).toBeTruthy();expect(screen.getByText('Requested access')).toBeTruthy();expect(screen.queryByText('Access summary')).toBeNull();expect(screen.queryByText('Scope and timing')).toBeNull();expect(screen.queryByText('Requested change')).toBeNull()});
 it('summarises permission preview without a before/requested/after diagram',async()=>{renderDetail();const preview=await screen.findByText('Permission change preview');expect(preview).toBeTruthy();expect(screen.getByText('No effective change')).toBeTruthy();expect(screen.getByText("AmazonS3ReadOnlyAccess is already attached to maya.chen. Approving this request will not change the user's effective permissions.")).toBeTruthy();expect(screen.getByText('Current status')).toBeTruthy();expect(screen.getByText('Already attached: AmazonS3ReadOnlyAccess')).toBeTruthy();expect(screen.getByText('Effective change')).toBeTruthy();expect(screen.queryByText('Before')).toBeNull();expect(screen.queryByText('After')).toBeNull();expect(screen.getByText('View technical details')).toBeTruthy()});
});
