// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import AcceptInvitation from './AcceptInvitation';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AuthSession} from '../types';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{session:vi.fn()}}));
const session:AuthSession={authenticated:true,authProvider:'cognito',devAuthAvailable:false,user:{id:'verified-user',email:'new@example.com',displayName:'New Person',provider:'cognito',providerSubject:'stable-subject',emailVerified:true,permissions:[],memberships:[]}};
const proof='x'.repeat(43);
beforeEach(()=>{vi.resetAllMocks();sessionStorage.clear();history.replaceState(null,'','/accept-invitation#token='+proof);useAuthStore.getState().clear();vi.mocked(api.session).mockResolvedValue(session)});
afterEach(cleanup);
function open(){render(<MemoryRouter initialEntries={['/accept-invitation']}><Routes><Route path="/accept-invitation" element={<AcceptInvitation/>}/><Route path="/administration/organizations" element={<p>Organization invitations</p>}/><Route path="/login" element={<p>Login required</p>}/><Route path="/complete-profile" element={<p>Profile required</p>}/></Routes></MemoryRouter>)}
it('opens Administration Organizations directly and keeps proof out of the URL',async()=>{open();await screen.findByText('Organization invitations');expect(location.hash).toBe('');expect(sessionStorage.getItem('permissionhub.invitation')).toBe(proof)});
it('preserves invitation through sign-in or registration for a new invitee',async()=>{vi.mocked(api.session).mockResolvedValue({...session,authenticated:false,user:undefined});open();await screen.findByText('Login required');expect(sessionStorage.getItem('permissionhub.invitation')).toBe(proof)});
it('preserves profile completion before organization invitation review',async()=>{vi.mocked(api.session).mockResolvedValue({...session,profileRequired:true});open();await screen.findByText('Profile required');expect(sessionStorage.getItem('permissionhub.invitation')).toBe(proof)});
it('shows a recovery message when session discovery fails',async()=>{vi.mocked(api.session).mockRejectedValue(new Error('network'));open();expect(await screen.findByRole('alert')).toBeTruthy();expect(sessionStorage.getItem('permissionhub.invitation')).toBe(proof)});
