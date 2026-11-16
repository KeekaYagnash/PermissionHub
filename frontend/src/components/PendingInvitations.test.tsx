// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {PendingInvitations} from './PendingInvitations';
import {useAuthStore} from '../store/auth';
import {api} from '../lib/api';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{pendingInvitations:vi.fn(),acceptPendingInvitation:vi.fn(),declineInvitation:vi.fn()}}));
beforeEach(()=>{vi.resetAllMocks();useAuthStore.getState().setSession({authenticated:true,authProvider:'test',devAuthAvailable:false,user:{id:'u',email:'invitee@example.invalid',emailVerified:true,displayName:'Invitee',provider:'test',providerSubject:'u',permissions:[],memberships:[]}});vi.mocked(api.pendingInvitations).mockResolvedValue([{id:'invitation',organizationName:'Inviting Company',role:'REQUESTER',expiresAt:'2027-01-01'}])});
afterEach(()=>{cleanup();useAuthStore.getState().clear()});
function open(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><PendingInvitations/></MemoryRouter></QueryClientProvider>)}
it('separates invitations from memberships and requires review before acceptance',async()=>{vi.mocked(api.acceptPendingInvitation).mockResolvedValue({authenticated:true,authProvider:'test',devAuthAvailable:false});open();await screen.findByText('Inviting Company');expect(api.acceptPendingInvitation).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Review invitation'}));expect(screen.getByRole('dialog',{name:'Review organization invitation'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Accept invitation'}));await waitFor(()=>expect(api.acceptPendingInvitation).toHaveBeenCalledWith('invitation'))});
it('supports authenticated decline without accepting membership',async()=>{vi.mocked(api.declineInvitation).mockResolvedValue({declined:true});open();fireEvent.click(await screen.findByRole('button',{name:'Review invitation'}));fireEvent.click(screen.getByRole('button',{name:'Decline invitation'}));await waitFor(()=>expect(api.declineInvitation).toHaveBeenCalledWith('invitation'));expect(api.acceptPendingInvitation).not.toHaveBeenCalled()});
it('keeps a failed invitation action visible for recovery',async()=>{vi.mocked(api.acceptPendingInvitation).mockRejectedValue(new Error('expired'));open();fireEvent.click(await screen.findByRole('button',{name:'Review invitation'}));fireEvent.click(screen.getByRole('button',{name:'Accept invitation'}));expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.getByRole('dialog')).toBeTruthy()});
