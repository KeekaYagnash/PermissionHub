// @vitest-environment jsdom
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Identities from './Identities';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AuthSession,IamIdentity} from '../types';

vi.mock('../lib/api',()=>({
 setCsrfToken:vi.fn(),
 api:{users:vi.fn(),roles:vi.fn(),user:vi.fn(),role:vi.fn(),requests:vi.fn()}
}));

const session:AuthSession={authenticated:true,csrfToken:'csrf',authProvider:'development',devAuthAvailable:true,user:{id:'user-1',email:'admin@example.com',displayName:'Organisation Admin',provider:'development',providerSubject:'user-1',activeTenantId:'tenant-1',activeAccountId:'account-1',activeAwsAccountRecordId:'account-1',permissions:['IDENTITY_VIEW_ALL','REQUEST_CREATE'],memberships:[]}};
const iamUser:IamIdentity={id:'user_yagnash',type:'USER',name:'Yagnash-dev',arn:'arn:aws:iam::143671530412:user/Yagnash-dev',path:'/',createdAt:'2023-05-25T00:00:00.000Z',passwordEnabled:undefined,attachedPolicies:[{policyName:'AdministratorAccess',policyArn:'arn:aws:iam::aws:policy/AdministratorAccess'}],inlinePolicies:[]};
const iamUserB:IamIdentity={...iamUser,id:'user_glen',name:'Glen-dev',arn:'arn:aws:iam::143671530412:user/Glen-dev',attachedPolicies:[],inlinePolicies:['GlenInlinePolicy']};
const iamRole:IamIdentity={id:'role_lambda',type:'ROLE',name:'add-advisor_lambda_role',arn:'arn:aws:iam::143671530412:role/service-role/add-advisor_lambda_role',path:'/service-role/',description:'Lambda execution role',createdAt:'2024-07-14T00:00:00.000Z',maxSessionDuration:3600,attachedPolicies:[{policyName:'AWSLambdaBasicExecutionRole',policyArn:'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'}],inlinePolicies:['AdminCreateUserPolicy'],trustPolicy:{Statement:[{Principal:{Service:'lambda.amazonaws.com'}}]}};
const iamRoleB:IamIdentity={...iamRole,id:'role_batch',name:'batch_worker_role',arn:'arn:aws:iam::143671530412:role/batch_worker_role',description:'Batch worker role',attachedPolicies:[],inlinePolicies:['BatchInlinePolicy'],trustPolicy:{Statement:[{Principal:{Service:'ecs-tasks.amazonaws.com'}}]}};

function page<T>(data:T[]){return {data,pagination:{page:1,pageSize:100,total:data.length,totalPages:1}}}
function LocationProbe(){const location=useLocation();return <output aria-label="location">{location.pathname}{location.search}</output>}
function renderIdentities(){
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 return render(<MemoryRouter initialEntries={['/identities']}><QueryClientProvider client={client}><Routes><Route path="/identities" element={<><Identities/><LocationProbe/></>}/><Route path="/new-request" element={<LocationProbe/>}/></Routes></QueryClientProvider></MemoryRouter>);
}

beforeEach(()=>{
 HTMLElement.prototype.scrollIntoView=vi.fn();
 useAuthStore.setState({session,loading:false});
 vi.mocked(api.users).mockResolvedValue(page([iamUser]));
 vi.mocked(api.roles).mockResolvedValue(page([iamRole]));
 vi.mocked(api.user).mockResolvedValue({...iamUser,tags:{Owner:'Platform'}});
 vi.mocked(api.role).mockResolvedValue(iamRole);
 vi.mocked(api.requests).mockResolvedValue(page([] as any[]));
});

afterEach(()=>{cleanup();vi.clearAllMocks();useAuthStore.getState().clear()});

describe('AWS Identities table detail modals',()=>{
 it('opens IAM user details from a row and closes from backdrop',async()=>{
  const user=userEvent.setup();
  renderIdentities();
  await user.click((await screen.findAllByText('Yagnash-dev'))[0]!);
  expect(await screen.findByRole('dialog',{name:'Yagnash-dev'})).toBeTruthy();
  expect(within(screen.getByRole('dialog',{name:'Yagnash-dev'})).getByText('IAM User details')).toBeTruthy();
  expect(within(screen.getByRole('dialog',{name:'Yagnash-dev'})).getByText(/Managed policies/)).toBeTruthy();
  fireEvent.mouseDown(document.querySelector('.modal-backdrop')!);
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Yagnash-dev'})).toBeNull());
  expect(screen.getAllByText('Yagnash-dev').length).toBeGreaterThan(0);
 });

 it('opens IAM role details and closes with Escape',async()=>{
  const user=userEvent.setup();
  renderIdentities();
  await user.click(screen.getByRole('button',{name:'IAM roles'}));
  await user.click((await screen.findAllByText('add-advisor_lambda_role'))[0]!);
  expect(await screen.findByRole('dialog',{name:'add-advisor_lambda_role'})).toBeTruthy();
  expect(screen.getByText('Trust relationship')).toBeTruthy();
  fireEvent.keyDown(document,{key:'Escape'});
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'add-advisor_lambda_role'})).toBeNull());
 });

 it('preserves identity search after opening and closing a modal',async()=>{
  const user=userEvent.setup();
  renderIdentities();
  const input=await screen.findByPlaceholderText('Search name, ARN, path or description');
  await user.type(input,'Yagnash');
  await user.click(screen.getAllByText('Yagnash-dev')[0]!);
  await user.click(screen.getByRole('button',{name:'Close iam user details'}));
  expect((input as HTMLInputElement).value).toBe('Yagnash');
 });

 it('preselects the identity when requesting access from the modal',async()=>{
  const user=userEvent.setup();
  renderIdentities();
  await user.click((await screen.findAllByText('Yagnash-dev'))[0]!);
  await user.click(screen.getByRole('button',{name:'Request additional access'}));
  expect(screen.getByLabelText('location').textContent).toContain(`/new-request?targetType=USER&targetName=Yagnash-dev`);
 });

 it('does not show previous IAM user detail while another user is loading',async()=>{
  const user=userEvent.setup();
  let resolveB:(value:IamIdentity)=>void=()=>{};
  vi.mocked(api.users).mockResolvedValue(page([iamUser,iamUserB]));
  vi.mocked(api.user).mockImplementation(async name=>{
   if(name==='Yagnash-dev')return {...iamUser,tags:{Owner:'Platform'}};
   return new Promise<IamIdentity>(resolve=>{resolveB=resolve});
  });
  renderIdentities();
  await user.click((await screen.findAllByText('Yagnash-dev'))[0]!);
  expect(await screen.findByText('Owner')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Close iam user details'}));
  await user.click(screen.getAllByText('Glen-dev')[0]!);
  const dialog=await screen.findByRole('dialog',{name:'Glen-dev'});
  expect(within(dialog).queryByText('Owner')).toBeNull();
  resolveB(iamUserB);
  expect(await within(dialog).findByText('GlenInlinePolicy')).toBeTruthy();
 });

 it('does not show previous IAM role detail while another role is loading',async()=>{
  const user=userEvent.setup();
  let resolveB:(value:IamIdentity)=>void=()=>{};
  vi.mocked(api.roles).mockResolvedValue(page([iamRole,iamRoleB]));
  vi.mocked(api.role).mockImplementation(async name=>{
   if(name==='add-advisor_lambda_role')return iamRole;
   return new Promise<IamIdentity>(resolve=>{resolveB=resolve});
  });
  renderIdentities();
  await user.click(screen.getByRole('button',{name:'IAM roles'}));
  await user.click((await screen.findAllByText('add-advisor_lambda_role'))[0]!);
  expect(await screen.findByText('AdminCreateUserPolicy')).toBeTruthy();
  fireEvent.keyDown(document,{key:'Escape'});
  await user.click(screen.getAllByText('batch_worker_role')[0]!);
  const dialog=await screen.findByRole('dialog',{name:'batch_worker_role'});
  expect(within(dialog).queryByText('AdminCreateUserPolicy')).toBeNull();
  resolveB(iamRoleB);
  expect(await within(dialog).findByText('BatchInlinePolicy')).toBeTruthy();
 });
});
