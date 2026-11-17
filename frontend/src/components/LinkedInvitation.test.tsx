// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {LinkedInvitation} from './LinkedInvitation';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{inspectInvitation:vi.fn(),acceptInvitation:vi.fn()}}));
const proof='x'.repeat(43);
beforeEach(()=>{vi.resetAllMocks();sessionStorage.setItem('permissionhub.invitation',proof);useAuthStore.getState().setSession({authenticated:true,authProvider:'test',devAuthAvailable:false,user:{id:'invitee',email:'invitee@example.invalid',emailVerified:true,displayName:'Invitee',provider:'test',providerSubject:'invitee',permissions:[],memberships:[]}})});
afterEach(()=>{cleanup();sessionStorage.clear();useAuthStore.getState().clear()});
function open(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><MemoryRouter><LinkedInvitation proof={proof} onResolved={vi.fn()}/></MemoryRouter></QueryClientProvider>)}
it.each(['expired','revoked','already used','wrong email','unauthorized'])('shows recovery for an %s invitation without granting membership',async reason=>{vi.mocked(api.inspectInvitation).mockRejectedValue(new Error(`Invitation ${reason}.`));open();expect((await screen.findByRole('alert')).textContent).toContain(reason);expect(api.acceptInvitation).not.toHaveBeenCalled();expect(sessionStorage.getItem('permissionhub.invitation')).toBe(proof);expect(useAuthStore.getState().session?.user?.memberships).toEqual([])});
it('retains the proof and confirmation after a failed authenticated acceptance',async()=>{vi.mocked(api.inspectInvitation).mockResolvedValue({organizationName:'Inviting Company',role:'REQUESTER',expiresAt:'2027-01-01'});vi.mocked(api.acceptInvitation).mockRejectedValue(new Error('Connection unavailable.'));open();fireEvent.click(await screen.findByRole('button',{name:'Review email invitation'}));fireEvent.click(screen.getByRole('button',{name:'Accept and join organization'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Connection unavailable'));expect(screen.getByRole('dialog')).toBeTruthy();expect(sessionStorage.getItem('permissionhub.invitation')).toBe(proof)});
