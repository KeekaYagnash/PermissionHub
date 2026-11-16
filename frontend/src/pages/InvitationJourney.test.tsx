// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import Login from './Login';
import Organizations from './Organizations';
import {api} from '../lib/api';
import * as cognito from '../lib/cognito';
import {useAuthStore} from '../store/auth';
import type {AuthSession} from '../types';
vi.mock('../lib/cognito',()=>({cognitoEnabled:()=>true,ensureAccessToken:vi.fn().mockResolvedValue(''),configuredProviders:()=>[],emailNeedsVerification:()=>false,signUpWithCognito:vi.fn(),confirmCognitoSignUp:vi.fn(),signInWithCognito:vi.fn(),startCognitoPasswordReset:vi.fn(),confirmCognitoPasswordReset:vi.fn(),resendCognitoConfirmation:vi.fn(),requestEmailVerification:vi.fn(),verifyEmailAttribute:vi.fn(),startCognitoLogin:vi.fn(),completeCognitoLogin:vi.fn()}));
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{session:vi.fn(),inspectInvitation:vi.fn(),pendingInvitations:vi.fn(),acceptPendingInvitation:vi.fn(),declineInvitation:vi.fn(),setOrganization:vi.fn(),selectTenant:vi.fn()}}));
const session:AuthSession={authenticated:true,authProvider:'cognito',devAuthAvailable:false,user:{id:'invitee',email:'invitee@example.invalid',emailVerified:true,displayName:'Invited Person',provider:'cognito',providerSubject:'stable-subject',permissions:[],memberships:[]}};
beforeEach(()=>{vi.clearAllMocks();history.replaceState(null,'','/login');sessionStorage.clear();sessionStorage.setItem('permissionhub.invitation','x'.repeat(43));useAuthStore.getState().clear();vi.mocked(api.session).mockResolvedValue(session);vi.mocked(api.inspectInvitation).mockResolvedValue({organizationName:'Inviting Company',role:'ACCOUNT_APPROVER',expiresAt:'2027-01-01'});vi.mocked(api.pendingInvitations).mockResolvedValue([{id:'invite',organizationName:'Inviting Company',role:'ACCOUNT_APPROVER',expiresAt:'2027-01-01'}]);vi.mocked(api.acceptPendingInvitation).mockResolvedValue({...session,user:{...session.user!,activeTenantId:'invited-tenant',memberships:[{id:'m',tenantId:'invited-tenant',tenantName:'Inviting Company',tenantSlug:'inviting',role:'ACCOUNT_APPROVER',status:'ACTIVE',scopes:[]}]}})});
afterEach(()=>{cleanup();sessionStorage.clear();useAuthStore.getState().clear()});
it.each(['new registration','existing sign-in'])('preserves the %s journey and exposes accepted membership in the selector',async journey=>{
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/login']}><Routes><Route path="/login" element={<Login/>}/><Route path="/administration/organizations" element={<Organizations/>}/></Routes></MemoryRouter></QueryClientProvider>);
 await screen.findByRole('button',{name:'Forgot password?'});
 if(journey==='new registration'){
  fireEvent.click(screen.getByRole('button',{name:'Create account'}));fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Invited Person'}});fireEvent.change(screen.getByLabelText('Email'),{target:{value:'invitee@example.invalid'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'Test-only-password-123!'}});fireEvent.submit(screen.getByLabelText('Email').closest('form')!);await screen.findByRole('heading',{name:'Verify your email'});fireEvent.change(screen.getByLabelText('Verification code'),{target:{value:'123456'}});fireEvent.click(screen.getByRole('button',{name:'Verify email'}));await screen.findByRole('heading',{name:'Sign in'});expect(cognito.confirmCognitoSignUp).toHaveBeenCalledWith('invitee@example.invalid','123456');
 }
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'invitee@example.invalid'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'Test-only-password-123!'}});fireEvent.submit(screen.getByLabelText('Email').closest('form')!);await screen.findByRole('heading',{name:'Organizations'});expect(api.acceptPendingInvitation).not.toHaveBeenCalled();expect(api.setOrganization).not.toHaveBeenCalled();
 fireEvent.click(await screen.findByRole('button',{name:'Review invitation'}));const dialog=screen.getByRole('dialog');expect(within(dialog).getByText('ACCOUNT APPROVER')).toBeTruthy();fireEvent.click(within(dialog).getByRole('button',{name:'Accept invitation'}));await waitFor(()=>expect(screen.getByRole('option',{name:'Inviting Company'})).toBeTruthy());expect(useAuthStore.getState().session?.user?.memberships[0]).toMatchObject({tenantId:'invited-tenant',role:'ACCOUNT_APPROVER'});expect(sessionStorage.getItem('permissionhub.invitation')).toBeNull();expect(screen.queryByRole('link',{name:'Manage members'})).toBeNull();
});
