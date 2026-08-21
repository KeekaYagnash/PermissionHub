// @vitest-environment jsdom
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import NewRequest from './NewRequest';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AppContext,AuthSession,IamIdentity,IamPolicySummary} from '../types';

vi.mock('../lib/api',()=>({
 setCsrfToken:vi.fn(),
 api:{
  users:vi.fn(),
  roles:vi.fn(),
  groups:vi.fn(),
  group:vi.fn(),
  policies:vi.fn(),
  resources:vi.fn(),
  approvers:vi.fn(),
  context:vi.fn(),
  validatePolicy:vi.fn(),
  createRequest:vi.fn(),
  submitRequest:vi.fn()
 }
}));

const session:AuthSession={authenticated:true,csrfToken:'csrf',authProvider:'development',devAuthAvailable:true,user:{id:'user-1',email:'admin@example.com',displayName:'Organisation Admin',provider:'development',providerSubject:'user-1',activeTenantId:'tenant-1',activeAccountId:'account-1',activeAwsAccountRecordId:'account-1',permissions:['REQUEST_CREATE'],memberships:[]}};
const context:AppContext={tenants:[],organisations:[],organisationalUnits:[],accounts:[{id:'account-1',accountRecordId:'account-1',tenantId:'tenant-1',accountId:'143671530412',awsAccountNumber:'143671530412',accountName:'Disraptor Production',accountType:'PRODUCTION',environment:'production',riskTier:'HIGH',region:'af-south-1',connectionType:'LOCAL_DEFAULT_CREDENTIALS',connectionStatus:'CONNECTED',sourceType:'MANUAL',connectionSource:'MANUAL',hasConnection:true,provisioningStatus:'DISABLED',provisioningEnabled:false}],activeTenantId:'tenant-1',activeAccountId:'account-1',activeAwsAccountRecordId:'account-1'};
const group: IamIdentity={id:'group_DR_DevOps',type:'GROUP',name:'DR_DevOps',arn:'arn:aws:iam::143671530412:group/DR_DevOps',path:'/',createdAt:'2026-08-01T10:00:00.000Z',attachedPolicies:[],inlinePolicies:[]};
const member: IamIdentity={id:'user_maya',type:'USER',name:'maya.chen',arn:'arn:aws:iam::143671530412:user/maya.chen',path:'/',createdAt:'2026-08-01T10:00:00.000Z',attachedPolicies:[],inlinePolicies:[]};
const role: IamIdentity={id:'role_deploy',type:'ROLE',name:'DeploymentRole',arn:'arn:aws:iam::143671530412:role/DeploymentRole',path:'/',createdAt:'2026-08-01T10:00:00.000Z',description:'Deployment automation role',maxSessionDuration:3600,attachedPolicies:[{policyName:'AmazonS3ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'}],inlinePolicies:[],trustPolicy:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]}};
const s3Policy:IamPolicySummary={policyName:'AmazonS3ReadOnlyAccess',arn:'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',type:'AWS_MANAGED',currentVersion:'v1',createdAt:'2026-08-01T10:00:00.000Z',updatedAt:'2026-08-01T10:00:00.000Z',attachmentCount:0,services:['s3'],accessLevels:['Read'],risk:{level:'Low',flags:[],services:['s3'],accessLevels:['Read']},deprecated:false};

function page<T>(data:T[]){return {data,pagination:{page:1,pageSize:100,total:data.length,totalPages:1}}}
function renderNewRequest(){
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 return render(<MemoryRouter><QueryClientProvider client={client}><NewRequest/></QueryClientProvider></MemoryRouter>);
}
function iamUserTargetButton(){return screen.getByRole('button',{name:/^iam user(?! group)/i})}

beforeEach(()=>{
 HTMLElement.prototype.scrollIntoView=vi.fn();
 useAuthStore.getState().setSession(session);
 vi.mocked(api.context).mockResolvedValue(context);
 vi.mocked(api.users).mockResolvedValue(page([member]));
 vi.mocked(api.roles).mockResolvedValue(page([role]));
 vi.mocked(api.groups).mockResolvedValue(page([group]));
 vi.mocked(api.group).mockResolvedValue({...group,users:[{userName:'existing.user',arn:'arn:aws:iam::143671530412:user/existing.user'}],attachedPolicies:[{policyName:'ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/ReadOnlyAccess'}]});
 vi.mocked(api.policies).mockResolvedValue(page([s3Policy]));
 vi.mocked(api.resources).mockResolvedValue([]);
 vi.mocked(api.approvers).mockResolvedValue([{id:'approver-1',name:'Security Reviewer'}]);
});

afterEach(()=>{cleanup();vi.clearAllMocks();useAuthStore.getState().clear()});

describe('New Request IAM group target',()=>{
 it('switches between target types without the isGroup initialization runtime error',async()=>{
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam user group/i}));
  await userEvent.click(iamUserTargetButton());
  await userEvent.click(screen.getByRole('button',{name:/iam role or workload/i}));
  await userEvent.click(screen.getByRole('button',{name:/iam user group/i}));
  expect(screen.getByText('Group action')).toBeTruthy();
 });

 it('renders existing IAM groups and enables Continue after selection',async()=>{
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam user group/i}));
  await userEvent.click(screen.getByRole('button',{name:/update existing group/i}));
  const groupName=await screen.findByText('DR_DevOps');
  expect(groupName).toBeTruthy();
  const groupRow=groupName.closest('button');
  expect(groupRow).toBeTruthy();
  await userEvent.click(groupRow!);
  await waitFor(()=>expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByText('1 members · 1 policies')).toBeTruthy();
  expect(screen.queryByText(/existing.user · existing member/)).toBeNull();
  expect(screen.queryByText(/ReadOnlyAccess · already attached/)).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:/view group details/i}));
  const dialog=await screen.findByRole('dialog',{name:'DR_DevOps'});
  expect(within(dialog).getByText('existing.user')).toBeTruthy();
  expect(within(dialog).getByText('ReadOnlyAccess')).toBeTruthy();
 });

 it('shows unknown group counts until selected group detail has loaded',async()=>{
  let resolveDetail:(value:IamIdentity)=>void=()=>{};
  vi.mocked(api.group).mockImplementation(()=>new Promise<IamIdentity>(resolve=>{resolveDetail=resolve}));
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam user group/i}));
  await userEvent.click(screen.getByRole('button',{name:/update existing group/i}));
  const groupRow=(await screen.findByText('DR_DevOps')).closest('button')!;
  expect(within(groupRow).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  await userEvent.click(groupRow);
  expect(screen.getByText(/Loading group details/i)).toBeTruthy();
  expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(true);
  resolveDetail({...group,users:[{userName:'existing.user'}],attachedPolicies:[{policyName:'ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/ReadOnlyAccess'}]});
  await waitFor(()=>expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(false));
 });

 it('blocks continuing when existing group detail fails to load',async()=>{
  vi.mocked(api.group).mockRejectedValueOnce(new Error('GetGroup failed'));
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam user group/i}));
  await userEvent.click(screen.getByRole('button',{name:/update existing group/i}));
  await userEvent.click((await screen.findByText('DR_DevOps')).closest('button')!);
  expect(await screen.findByText('Unable to load group details')).toBeTruthy();
  expect(screen.getByText(/needs the current members and policies/i)).toBeTruthy();
  expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(true);
 });

 it('maps IAM group discovery failures to a useful message with retry',async()=>{
  vi.mocked(api.groups).mockRejectedValueOnce({response:{status:403,data:{error:{code:'ACCESS_DENIED',message:'AccessDenied: not authorized to call iam:ListGroups'}}}});
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam user group/i}));
  await userEvent.click(screen.getByRole('button',{name:/update existing group/i}));
  expect(await screen.findByText('Unable to load IAM groups')).toBeTruthy();
  expect(screen.getByText(/cannot read IAM groups/i)).toBeTruthy();
  expect(screen.getByRole('button',{name:/retry/i})).toBeTruthy();
 });
});

describe('New Request IAM user creation flow',()=>{
 it('does not preselect a user source and blocks duplicate or existing usernames',async()=>{
  renderNewRequest();
  await screen.findByRole('button',{name:/iam user group/i});
  await userEvent.click(iamUserTargetButton());
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole('button',{name:/create new users/i}));
  await userEvent.type(screen.getByLabelText(/iam usernames/i),'maya.chen, demo.user, demo.user');
  expect(await screen.findByText(/IAM user already exists: maya.chen/i)).toBeTruthy();
  expect(screen.getByText(/Duplicate username in request: demo.user/i)).toBeTruthy();
  expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(true);
 });

 it('hides update or remove existing permissions for new IAM users',async()=>{
  renderNewRequest();
  await screen.findByRole('button',{name:/iam user group/i});
  await userEvent.click(iamUserTargetButton());
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/create new users/i}));
  await userEvent.type(screen.getByLabelText(/iam usernames/i),'demo.user');
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(screen.getByRole('button',{name:/create users only/i})).toBeTruthy();
  expect(screen.queryByRole('button',{name:/update\/remove existing permissions/i})).toBeNull();
 });

 it('does not select a permission by default for direct new-user access',async()=>{
  renderNewRequest();
  await screen.findByRole('button',{name:/iam user group/i});
  await userEvent.click(iamUserTargetButton());
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/create new users/i}));
  await userEvent.type(screen.getByLabelText(/iam usernames/i),'demo.user');
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/add permissions directly/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(screen.getByText('0 selected')).toBeTruthy();
  expect((screen.getByRole('checkbox',{name:/AmazonS3ReadOnlyAccess/i}) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(true);
 });

 it('preserves new-user entries when navigating back and forward',async()=>{
  renderNewRequest();
  await screen.findByRole('button',{name:/iam user group/i});
  await userEvent.click(iamUserTargetButton());
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/create new users/i}));
  await userEvent.type(screen.getByLabelText(/iam usernames/i),'demo.one, demo.two');
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(screen.getByRole('heading',{name:/what would you like to do/i})).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:/back/i}));
  expect((screen.getByLabelText(/iam usernames/i) as HTMLTextAreaElement).value).toBe('demo.one, demo.two');
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(screen.getByRole('heading',{name:/what would you like to do/i})).toBeTruthy();
 });

 it('skips permission, resource and duration steps for create users only',async()=>{
  renderNewRequest();
  await screen.findByRole('button',{name:/iam user group/i});
  await userEvent.click(iamUserTargetButton());
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/create new users/i}));
  await userEvent.type(screen.getByLabelText(/iam usernames/i),'demo.one\ndemo.two');
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/create users only/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(screen.getByRole('heading',{name:/why do you need this access/i})).toBeTruthy();
  expect(screen.queryByText(/choose resources/i)).toBeNull();
  fireEvent.change(screen.getByLabelText(/request title/i),{target:{value:'Create demo users'}});
  await waitFor(()=>expect((screen.getByLabelText(/request title/i) as HTMLInputElement).value).toBe('Create demo users'));
  await userEvent.selectOptions(screen.getByLabelText(/approver/i),'Security Reviewer');
  await waitFor(()=>expect((screen.getByLabelText(/approver/i) as HTMLSelectElement).value).toBe('Security Reviewer'));
  fireEvent.change(screen.getByLabelText(/business justification/i),{target:{value:'Create temporary demo IAM users for the PermissionHub onboarding validation.'}});
  await waitFor(()=>expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(false));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(await screen.findByText(/Create 2 IAM users in Disraptor Production without assigning permissions or group membership/i)).toBeTruthy();
 });
});

describe('New Request IAM role flow',()=>{
 it('has no default role action or role selection and never shows Access Duration',async()=>{
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam role or workload/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(screen.getByRole('heading',{name:/what would you like to do/i})).toBeTruthy();
  expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText(/access duration/i)).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:/update an existing iam role/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(screen.getByRole('heading',{name:/existing role details/i})).toBeTruthy();
  expect(screen.getByText(/No role selected/i)).toBeTruthy();
  expect(screen.queryByText(/access duration/i)).toBeNull();
 });

 it('blocks duplicate role names when creating a new role',async()=>{
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam role or workload/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/create a new iam role/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  fireEvent.change(screen.getByLabelText(/role name/i),{target:{value:'DeploymentRole'}});
  expect(await screen.findByText(/IAM role DeploymentRole already exists/i)).toBeTruthy();
  expect((screen.getByRole('button',{name:/continue/i}) as HTMLButtonElement).disabled).toBe(true);
 });

 it('creates a new role request with managed policy and preserves state when navigating back',async()=>{
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam role or workload/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/create a new iam role/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  fireEvent.change(screen.getByLabelText(/role name/i),{target:{value:'FinanceReportingRole'}});
  fireEvent.change(screen.getAllByLabelText(/trusted principal/i).find(item=>item.tagName==='INPUT')!,{target:{value:'lambda.amazonaws.com'}});
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(screen.queryByText(/access duration/i)).toBeNull();
  expect(screen.getByText('0 selected')).toBeTruthy();
  await userEvent.click(screen.getByRole('checkbox',{name:/AmazonS3ReadOnlyAccess/i}));
  await userEvent.click(screen.getByRole('button',{name:/back/i}));
  expect((screen.getByLabelText(/role name/i) as HTMLInputElement).value).toBe('FinanceReportingRole');
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  fireEvent.change(screen.getByLabelText(/request title/i),{target:{value:'Create finance role'}});
  await userEvent.selectOptions(screen.getByLabelText(/approver/i),'Security Reviewer');
  fireEvent.change(screen.getByLabelText(/business justification/i),{target:{value:'Create a finance reporting role for the demo workload validation.'}});
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(await screen.findByText(/Create IAM role FinanceReportingRole and attach AmazonS3ReadOnlyAccess/i)).toBeTruthy();
  expect(screen.getByText(/IAM roles do not expire/i)).toBeTruthy();
 });

 it('supports existing role policy removal and trust relationship review summaries',async()=>{
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam role or workload/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/update an existing iam role/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(await screen.findByText('DeploymentRole'));
  await userEvent.click(screen.getByRole('button',{name:/remove permissions/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('radio',{name:/AmazonS3ReadOnlyAccess/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  fireEvent.change(screen.getByLabelText(/request title/i),{target:{value:'Remove role policy'}});
  await userEvent.selectOptions(screen.getByLabelText(/approver/i),'Security Reviewer');
  fireEvent.change(screen.getByLabelText(/business justification/i),{target:{value:'Remove inherited S3 read access from the deployment role for validation.'}});
  await userEvent.click(screen.getByRole('button',{name:/continue/i}));
  expect(await screen.findByText(/Update DeploymentRole by removing AmazonS3ReadOnlyAccess/i)).toBeTruthy();
 });
});
