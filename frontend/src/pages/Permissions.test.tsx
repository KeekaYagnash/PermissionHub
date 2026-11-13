// @vitest-environment jsdom
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Permissions from './Permissions';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AuthSession,IamPolicyDetail,IamPolicySummary} from '../types';

vi.mock('../lib/api',()=>({
 setCsrfToken:vi.fn(),
 api:{policies:vi.fn(),policy:vi.fn()}
}));

const session:AuthSession={authenticated:true,csrfToken:'csrf',authProvider:'development',devAuthAvailable:true,user:{id:'user-1',email:'requester@example.com',displayName:'Requester',provider:'development',providerSubject:'user-1',activeTenantId:'tenant-1',activeAccountId:'account-1',activeAwsAccountRecordId:'account-1',permissions:['PERMISSION_CATALOGUE_VIEW','REQUEST_CREATE'],memberships:[]}};
const policy:IamPolicySummary={policyName:'AdministratorAccess',arn:'arn:aws:iam::aws:policy/AdministratorAccess',policyId:'ANPA',path:'/',description:'Provides full access to AWS services and resources.',type:'AWS_MANAGED',currentVersion:'v1',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z',attachmentCount:9,permissionsBoundaryUsageCount:0,isAttachable:true,services:['Multiple services'],accessLevels:['Administrator'],risk:{level:'Critical',flags:['Administrative access'],services:['Multiple services'],accessLevels:['Administrator']},deprecated:false};
const policyB:IamPolicySummary={...policy,policyName:'CloudWatchReadOnlyAccess',arn:'arn:aws:iam::aws:policy/CloudWatchReadOnlyAccess',description:'Read-only access to CloudWatch.',attachmentCount:3,risk:{level:'Low',flags:[],services:['CloudWatch'],accessLevels:['Read']},services:['CloudWatch'],accessLevels:['Read']};
const detail:IamPolicyDetail={...policy,document:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:'*',Resource:'*'}]},statements:[{Effect:'Allow',Action:'*',Resource:'*'}],actions:['*'],resources:['*'],conditions:[],attachedUsers:['Yagnash-dev'],attachedRoles:['admin-role'],attachedGroups:[],observations:['Administrative access']};
const detailB:IamPolicyDetail={...policyB,document:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:'cloudwatch:GetMetricData',Resource:'*'}]},statements:[{Effect:'Allow',Action:'cloudwatch:GetMetricData',Resource:'*'}],actions:['cloudwatch:GetMetricData'],resources:['*'],conditions:[],attachedUsers:[],attachedRoles:[],attachedGroups:[],observations:['CloudWatch read only detail']};

function page<T>(data:T[]){return {data,pagination:{page:1,pageSize:100,total:data.length,totalPages:1},isComplete:true,loadedCount:data.length}}
function LocationProbe(){const location=useLocation();return <output aria-label="location">{location.pathname}{location.search}</output>}
function renderPermissions(){
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 return render(<MemoryRouter initialEntries={['/permissions']}><QueryClientProvider client={client}><Routes><Route path="/permissions" element={<><Permissions/><LocationProbe/></>}/><Route path="/new-request" element={<LocationProbe/>}/></Routes></QueryClientProvider></MemoryRouter>);
}

beforeEach(()=>{
 HTMLElement.prototype.scrollIntoView=vi.fn();
 useAuthStore.setState({session,loading:false});
 vi.mocked(api.policies).mockResolvedValue(page([policy]));
 vi.mocked(api.policy).mockResolvedValue(detail);
});

afterEach(()=>{cleanup();vi.clearAllMocks();useAuthStore.getState().clear()});

describe('Permissions table detail modal',()=>{
 it('opens policy details from a row and closes without clearing the table',async()=>{
  const user=userEvent.setup();
  renderPermissions();
  const rowText=(await screen.findAllByText('AdministratorAccess'))[0]!;
  await user.click(rowText);
  const dialog=await screen.findByRole('dialog',{name:'AdministratorAccess'});
  expect(dialog).toBeTruthy();
  expect(within(dialog).getByText('Policy details')).toBeTruthy();
  expect(within(dialog).getByText('Access summary')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Close policy details'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'AdministratorAccess'})).toBeNull());
   expect(screen.getAllByText('AdministratorAccess').length).toBeGreaterThan(0);
 });

 it('keeps Request permission as a row action and does not open the modal first',async()=>{
  const user=userEvent.setup();
  renderPermissions();
  await screen.findAllByText('AdministratorAccess');
  await user.click(screen.getAllByRole('button',{name:'Request permission'})[0]!);
  expect(screen.queryByRole('dialog',{name:'AdministratorAccess'})).toBeNull();
  expect(screen.getByLabelText('location').textContent).toContain(`/new-request?policyArn=${encodeURIComponent(policy.arn)}`);
 });

 it('preserves search filters after opening and closing a policy modal',async()=>{
  const user=userEvent.setup();
  renderPermissions();
  await user.type(await screen.findByLabelText('Search permissions'),'admin');
  await user.click((await screen.findAllByText('AdministratorAccess'))[0]!);
  await user.click(screen.getByRole('button',{name:'Close policy details'}));
  expect((screen.getByLabelText('Search permissions') as HTMLInputElement).value).toBe('admin');
 });

 it('does not show previous policy detail while the next policy is loading',async()=>{
  const user=userEvent.setup();
  let resolveB:(value:IamPolicyDetail)=>void=()=>{};
  useAuthStore.setState({session:{...session,user:{...session.user!,activeAccountId:'account-switch',activeAwsAccountRecordId:'account-switch'}},loading:false});
  vi.mocked(api.policies).mockResolvedValue(page([policy,policyB]));
  vi.mocked(api.policy).mockImplementation(async arn=>{
   if(arn===policy.arn)return detail;
   return new Promise<IamPolicyDetail>(resolve=>{resolveB=resolve});
  });
  renderPermissions();
  await user.click((await screen.findAllByText('AdministratorAccess'))[0]!);
  expect(await screen.findByText('Administrative access')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Close policy details'}));
  await user.click(screen.getAllByText('CloudWatchReadOnlyAccess')[0]!);
  const dialog=await screen.findByRole('dialog',{name:'CloudWatchReadOnlyAccess'});
  expect(within(dialog).queryByText('Administrative access')).toBeNull();
  expect(within(dialog).getAllByRole('generic').length).toBeGreaterThan(0);
  resolveB(detailB);
  expect(await within(dialog).findByText('CloudWatch read only detail')).toBeTruthy();
 });
});
