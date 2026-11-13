// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import AcceptInvitation from './AcceptInvitation';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AuthSession} from '../types';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{session:vi.fn(),inspectInvitation:vi.fn(),acceptInvitation:vi.fn(),logout:vi.fn()}}));
vi.mock('../lib/cognito',()=>({cognitoEnabled:()=>false,logoutCognito:vi.fn()}));
const session:AuthSession={authenticated:true,authProvider:'cognito',devAuthAvailable:false,user:{id:'verified-user',email:'new@example.com',displayName:'New Person',provider:'cognito',providerSubject:'stable-subject',emailVerified:true,permissions:[],memberships:[]}};
const proof='x'.repeat(43);
beforeEach(()=>{vi.resetAllMocks();sessionStorage.clear();history.replaceState(null,'',`/accept-invitation#token=${proof}`);useAuthStore.getState().clear();vi.mocked(api.session).mockResolvedValue(session);vi.mocked(api.inspectInvitation).mockResolvedValue({organizationName:'Example Company',role:'REQUESTER',expiresAt:'2027-01-01T00:00:00Z'})});
afterEach(cleanup);
function open(){render(<MemoryRouter initialEntries={['/accept-invitation']}><Routes><Route path="/accept-invitation" element={<AcceptInvitation/>}/><Route path="/" element={<p>Application ready</p>}/></Routes></MemoryRouter>)}
it('keeps proof out of URLs and accepts once before entering the application',async()=>{
 vi.mocked(api.acceptInvitation).mockResolvedValue({...session,user:{...session.user!,activeTenantId:'tenant-new',memberships:[{id:'m',tenantId:'tenant-new',tenantName:'Example',tenantSlug:'example',role:'REQUESTER',status:'ACTIVE',scopes:[]}]}});open();fireEvent.click(await screen.findByRole('button',{name:'Accept invitation'}));await screen.findByText('Application ready');expect(api.acceptInvitation).toHaveBeenCalledExactlyOnceWith(proof);expect(location.hash).toBe('');expect(sessionStorage.getItem('permissionhub.invitation')).toBeNull();
});
it('shows expired/revoked invitation recovery without offering acceptance',async()=>{vi.mocked(api.inspectInvitation).mockRejectedValue(new Error('This invitation has expired. Ask the organisation administrator to resend it.'));open();expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('expired'));expect(screen.queryByRole('button',{name:'Accept invitation'})).toBeNull()});
it('retains a failed acceptance and shows the backend explanation',async()=>{vi.mocked(api.acceptInvitation).mockRejectedValue(new Error('Sign in with the invited, verified email address.'));open();fireEvent.click(await screen.findByRole('button',{name:'Accept invitation'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('verified email'));expect(sessionStorage.getItem('permissionhub.invitation')).toBe(proof)});
