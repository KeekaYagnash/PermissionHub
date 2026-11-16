// @vitest-environment jsdom
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Connection from './Connection';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AuthSession,AwsAccountContext} from '../types';

vi.mock('../lib/api',()=>({
 setCsrfToken:vi.fn(),
 api:{
  connections:vi.fn(),
  awsDiagnostics:vi.fn(),
  createAwsAccount:vi.fn(),
  updateAwsAccount:vi.fn(),
  validateAccessKeys:vi.fn(),
  validateAwsAccount:vi.fn(),
  validateProvisionRole:vi.fn(),
  repairAwsAccount:vi.fn(),
  convertAwsAccount:vi.fn(),
  removeAwsAccount:vi.fn(),
  resetAwsAccount:vi.fn(),
  selectAccount:vi.fn(),
  session:vi.fn(),
  validateLocalCredentials:vi.fn(),
  clearAccount:vi.fn(),
  clearAwsCache:vi.fn()
 }
}));

const session:AuthSession={
 authenticated:true,
 csrfToken:'csrf',
 authProvider:'development',
 devAuthAvailable:true,
 user:{
  id:'user-1',
  email:'admin@example.com',
  displayName:'Organisation Admin',
  provider:'development',
  providerSubject:'user-1',
  activeTenantId:'tenant-1',
  permissions:['CONNECTION_MANAGE'],
  memberships:[{id:'membership-1',tenantId:'tenant-1',tenantName:'Disraptor',tenantSlug:'disraptor',role:'ORGANISATION_ADMIN',status:'ACTIVE',scopes:[]}]
 }
};

const account:AwsAccountContext={
 id:'account-record-1',
 accountRecordId:'account-record-1',
 tenantId:'tenant-1',
 accountId:'143671530412',
 awsAccountNumber:'143671530412',
 accountName:'Disraptor',
 accountType:'PRODUCTION',
 environment:'production',
 riskTier:'HIGH',
 region:'af-south-1',
 connectionType:'LOCAL_DEFAULT_CREDENTIALS',
 connectionStatus:'CONNECTED',
 sourceType:'MANUAL',
 connectionSource:'MANUAL',
 hasConnection:true,
 availableActions:['SELECT','VALIDATE','EDIT','REMOVE'],
 provisioningStatus:'DISABLED',
 provisioningEnabled:false,
 provisionRoleStatus:'NOT_VALIDATED'
};

function renderConnection(){
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 return render(<QueryClientProvider client={client}><Connection/></QueryClientProvider>);
}

beforeEach(()=>{
 vi.mocked(api.connections).mockResolvedValue([account]);
 vi.mocked(api.awsDiagnostics).mockResolvedValue({activeTenantId:'tenant-1',diagnosticStatus:'ACCOUNT_REQUIRED',observedAt:'2026-11-16T00:00:00Z',source:'SAVED_CONNECTION_STATUS'});
 vi.mocked(api.createAwsAccount).mockResolvedValue({account:{accountRecordId:'new-account'}});
 vi.mocked(api.session).mockResolvedValue(session);
 vi.mocked(api.validateLocalCredentials).mockResolvedValue({success:true});
 useAuthStore.setState({session,loading:false});
});

afterEach(()=>{
 cleanup();
 vi.clearAllMocks();
 vi.unstubAllGlobals();
 useAuthStore.getState().clear();
});

describe('Connection Add Account modal',()=>{
 it('keeps direct credentials independent of role ARNs and omits role fields from the request',async()=>{
  const user=userEvent.setup();renderConnection();await user.click(screen.getByRole('button',{name:'Add account'}));const dialog=screen.getByRole('dialog',{name:'Add AWS account'});expect(within(dialog).queryByLabelText('Read role ARN')).toBeNull();expect(within(dialog).queryByLabelText('Provision role ARN (optional)')).toBeNull();await user.type(screen.getByLabelText('Account name'),'Direct Account');await user.type(screen.getByLabelText('AWS account ID'),'123456789012');await user.type(screen.getByLabelText('AWS Access Key ID'),'TESTONLYACCESSKEY');await user.type(screen.getByLabelText('AWS Secret Access Key'),'test-only-secret-never-sent-to-aws');await user.click(within(dialog).getByRole('button',{name:'Save and validate later'}));await waitFor(()=>expect(api.createAwsAccount).toHaveBeenCalled());const payload=vi.mocked(api.createAwsAccount).mock.calls[0]![0];expect(payload).toMatchObject({connectionType:'ACCESS_KEYS',accessKeyId:'TESTONLYACCESSKEY'});expect(payload).not.toHaveProperty('readRoleArn');expect(payload).not.toHaveProperty('provisionRoleArn');expect(payload).not.toHaveProperty('externalIdSecretReference');
 });
 it('requires a valid account-specific read role only for Assume role and excludes direct credentials',async()=>{
  const user=userEvent.setup();renderConnection();await user.click(screen.getByRole('button',{name:'Add account'}));await user.type(screen.getByLabelText('Account name'),'Role Account');await user.type(screen.getByLabelText('AWS account ID'),'123456789012');await user.selectOptions(screen.getByLabelText('Authentication method'),'ASSUME_ROLE');const dialog=screen.getByRole('dialog',{name:'Add AWS account'}),save=within(dialog).getByRole('button',{name:'Add account'});expect(screen.getByLabelText('Read role ARN')).toHaveProperty('required',true);expect(save).toHaveProperty('disabled',true);await user.type(screen.getByLabelText('Read role ARN'),'arn:aws:iam::999999999999:role/ReadRole');expect(save).toHaveProperty('disabled',true);await user.clear(screen.getByLabelText('Read role ARN'));await user.type(screen.getByLabelText('Read role ARN'),'arn:aws:iam::123456789012:role/ReadRole');expect(save).toHaveProperty('disabled',false);await user.click(save);await waitFor(()=>expect(api.createAwsAccount).toHaveBeenCalled());const payload=vi.mocked(api.createAwsAccount).mock.calls[0]![0];expect(payload).toMatchObject({connectionType:'ASSUME_ROLE',readRoleArn:'arn:aws:iam::123456789012:role/ReadRole'});expect(payload).not.toHaveProperty('accessKeyId');expect(payload).not.toHaveProperty('secretAccessKey');
 });
 it('clears hidden role fields when returning from Assume role to direct credentials',async()=>{
  const user=userEvent.setup();renderConnection();await user.click(screen.getByRole('button',{name:'Add account'}));await user.selectOptions(screen.getByLabelText('Authentication method'),'ASSUME_ROLE');await user.type(screen.getByLabelText('Read role ARN'),'arn:aws:iam::123456789012:role/ReadRole');await user.type(screen.getByLabelText('Provision role ARN (optional)'),'arn:aws:iam::123456789012:role/ProvisionRole');await user.selectOptions(screen.getByLabelText('Authentication method'),'ACCESS_KEYS');expect(screen.queryByLabelText('Read role ARN')).toBeNull();expect(screen.queryByLabelText('Provision role ARN (optional)')).toBeNull();await user.selectOptions(screen.getByLabelText('Authentication method'),'ASSUME_ROLE');expect(screen.getByLabelText('Read role ARN')).toHaveProperty('value','');
 });
 it('opens Add Account in a modal and does not render the form inline',async()=>{
  const user=userEvent.setup();
  renderConnection();
  expect(screen.queryByLabelText('Account name')).toBeNull();
  await user.click(screen.getByRole('button',{name:'Add account'}));
  expect(screen.getByRole('dialog',{name:'Add AWS account'})).toBeTruthy();
  expect(within(screen.getByRole('dialog',{name:'Add AWS account'})).getByText('Organization: Disraptor')).toBeTruthy();
  expect(screen.getByText('This AWS account will be added only to this organization. Existing accounts will not be moved.')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Close add account'})).toBeTruthy();
  expect(document.querySelector('.connection-account-list')).toBeTruthy();
 });

 it('keeps Account name focused while typing multiple characters',async()=>{
  const user=userEvent.setup();
  renderConnection();
  await user.click(screen.getByRole('button',{name:'Add account'}));
  const input=screen.getByLabelText('Account name') as HTMLInputElement;
  await user.click(input);
  await user.type(input,'Disraptor Sandbox');
  expect(input.value).toBe('Disraptor Sandbox');
  expect(document.activeElement).toBe(input);
  expect(api.connections).toHaveBeenCalledTimes(1);
 });

 it('keeps AWS account ID and Region focused while typing',async()=>{
  const user=userEvent.setup();
  renderConnection();
  await user.click(screen.getByRole('button',{name:'Add account'}));
  const accountId=screen.getByLabelText('AWS account ID') as HTMLInputElement;
  await user.click(accountId);
  await user.type(accountId,'854924711147');
  expect(accountId.value).toBe('854924711147');
  expect(document.activeElement).toBe(accountId);
  const region=screen.getByLabelText('Region') as HTMLInputElement;
  await user.clear(region);
  await user.type(region,'eu-west-1');
  expect(region.value).toBe('eu-west-1');
  expect(document.activeElement).toBe(region);
 });

 it('does not wipe account details when authentication method changes',async()=>{
  const user=userEvent.setup();
  renderConnection();
  await user.click(screen.getByRole('button',{name:'Add account'}));
  await user.type(screen.getByLabelText('Account name'),'Disraptor Sandbox');
  await user.type(screen.getByLabelText('AWS account ID'),'854924711147');
  await user.selectOptions(screen.getByLabelText('Authentication method'),'ASSUME_ROLE');
  expect((screen.getByLabelText('Account name') as HTMLInputElement).value).toBe('Disraptor Sandbox');
  expect((screen.getByLabelText('AWS account ID') as HTMLInputElement).value).toBe('854924711147');
 });

 it('asks before closing a dirty modal and closes pristine modals immediately',async()=>{
  const user=userEvent.setup();
  renderConnection();
  await user.click(screen.getByRole('button',{name:'Add account'}));
  await user.click(screen.getByRole('button',{name:'Close add account'}));
  expect(screen.queryByRole('dialog',{name:'Add AWS account'})).toBeNull();
  await user.click(screen.getByRole('button',{name:'Add account'}));
  await user.type(screen.getByLabelText('Account name'),'Unsaved');
  const confirm=vi.fn().mockReturnValue(false);
  vi.stubGlobal('confirm',confirm);
  await user.click(screen.getByRole('button',{name:'Close add account'}));
  expect(confirm).toHaveBeenCalledWith('Discard this AWS connection?\n\nYour unsaved connection details will be lost.');
  expect(screen.getByRole('dialog',{name:'Add AWS account'})).toBeTruthy();
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button',{name:'Close add account'}));
  expect(screen.queryByRole('dialog',{name:'Add AWS account'})).toBeNull();
 });

 it('closes with Escape/backdrop only when discard is confirmed and ignores inside clicks',async()=>{
  const user=userEvent.setup();
  renderConnection();
  await user.click(screen.getByRole('button',{name:'Add account'}));
  await user.type(screen.getByLabelText('Account name'),'Unsaved');
  const confirm=vi.fn().mockReturnValue(false);
  vi.stubGlobal('confirm',confirm);
  fireEvent.mouseDown(screen.getByRole('dialog',{name:'Add AWS account'}));
  expect(screen.getByRole('dialog',{name:'Add AWS account'})).toBeTruthy();
  fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.getByRole('dialog',{name:'Add AWS account'})).toBeTruthy();
  confirm.mockReturnValue(true);
  fireEvent.mouseDown(document.querySelector('.modal-backdrop')!);
  expect(screen.queryByRole('dialog',{name:'Add AWS account'})).toBeNull();
 });

 it('successful add closes the modal and refreshes the grid',async()=>{
  const user=userEvent.setup();
  renderConnection();
  await user.click(screen.getByRole('button',{name:'Add account'}));
  await user.type(screen.getByLabelText('Account name'),'Disraptor Sandbox');
  await user.type(screen.getByLabelText('AWS account ID'),'854924711147');
  await user.click(screen.getByLabelText(/Save as pending and validate later/i));
  await user.click(within(screen.getByRole('dialog',{name:'Add AWS account'})).getByRole('button',{name:'Save pending account'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Add AWS account'})).toBeNull());
  expect(api.createAwsAccount).toHaveBeenCalledWith(expect.objectContaining({accountName:'Disraptor Sandbox',accountId:'854924711147'}),expect.anything());
  expect(api.session).toHaveBeenCalled();
  expect(api.connections).toHaveBeenCalledTimes(2);
 });
});

