// @vitest-environment jsdom
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import NewRequest from './NewRequest';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AppContext,AuthSession,IamIdentity} from '../types';

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

function page<T>(data:T[]){return {data,pagination:{page:1,pageSize:100,total:data.length,totalPages:1}}}
function renderNewRequest(){
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 return render(<MemoryRouter><QueryClientProvider client={client}><NewRequest/></QueryClientProvider></MemoryRouter>);
}

beforeEach(()=>{
 HTMLElement.prototype.scrollIntoView=vi.fn();
 useAuthStore.getState().setSession(session);
 vi.mocked(api.context).mockResolvedValue(context);
 vi.mocked(api.users).mockResolvedValue(page([member]));
 vi.mocked(api.roles).mockResolvedValue(page([]));
 vi.mocked(api.groups).mockResolvedValue(page([group]));
 vi.mocked(api.group).mockResolvedValue({...group,users:[{userName:'existing.user',arn:'arn:aws:iam::143671530412:user/existing.user'}],attachedPolicies:[{policyName:'ReadOnlyAccess',policyArn:'arn:aws:iam::aws:policy/ReadOnlyAccess'}]});
 vi.mocked(api.policies).mockResolvedValue(page([]));
 vi.mocked(api.resources).mockResolvedValue([]);
 vi.mocked(api.approvers).mockResolvedValue([{id:'approver-1',name:'Security Reviewer'}]);
});

afterEach(()=>{cleanup();vi.clearAllMocks();useAuthStore.getState().clear()});

describe('New Request IAM group target',()=>{
 it('switches between target types without the isGroup initialization runtime error',async()=>{
  renderNewRequest();
  await userEvent.click(await screen.findByRole('button',{name:/iam user group/i}));
  await userEvent.click(screen.getByRole('button',{name:/legacy iam user/i}));
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
