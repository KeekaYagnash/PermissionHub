// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {OrganizationPicker} from './OrganizationPicker';
import {useAuthStore} from '../store/auth';
import {api} from '../lib/api';
import type {AuthSession} from '../types';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{selectTenant:vi.fn(),setOrganization:vi.fn()}}));
const session:AuthSession={authenticated:true,authProvider:'test',devAuthAvailable:false,user:{id:'u',email:'user@example.invalid',displayName:'Member',provider:'test',providerSubject:'u',activeTenantId:'a',permissions:[],memberships:[{id:'ma',tenantId:'a',tenantName:'Alpha',tenantSlug:'alpha',role:'REQUESTER',status:'ACTIVE',scopes:[]},{id:'mb',tenantId:'b',tenantName:'Beta',tenantSlug:'beta',role:'REQUESTER',status:'ACTIVE',scopes:[]},{id:'ms',tenantId:'s',tenantName:'Suspended Company',tenantSlug:'suspended',role:'REQUESTER',status:'SUSPENDED',scopes:[]}]}};
beforeEach(()=>{vi.resetAllMocks();useAuthStore.getState().setSession(session)});
afterEach(()=>{cleanup();useAuthStore.getState().clear()});
function open(){const client=new QueryClient();client.setQueryData(['old-tenant-data'],{private:true});render(<QueryClientProvider client={client}><MemoryRouter><OrganizationPicker/></MemoryRouter></QueryClientProvider>);return client}
it('shows only active memberships and clears previous account data after confirmed switching',async()=>{vi.mocked(api.selectTenant).mockResolvedValue({...session,user:{...session.user!,activeTenantId:'b'}});const client=open();expect(screen.queryByRole('option',{name:'Suspended Company'})).toBeNull();fireEvent.change(screen.getByLabelText('Active organization'),{target:{value:'b'}});await waitFor(()=>expect(useAuthStore.getState().session?.user?.activeTenantId).toBe('b'));expect(client.getQueryData(['old-tenant-data'])).toBeUndefined();expect(api.selectTenant).toHaveBeenCalledWith('b')});
it('keeps creation out of the context selector and offers invitation navigation',()=>{open();expect(screen.queryByRole('button',{name:'Add organization'})).toBeNull();expect(screen.getByRole('button',{name:'Invitations'})).toBeTruthy();expect(api.setOrganization).not.toHaveBeenCalled()});
it('keeps the previous organization and its data when switching fails',async()=>{vi.mocked(api.selectTenant).mockRejectedValue(new Error('unavailable'));const client=open();fireEvent.change(screen.getByLabelText('Active organization'),{target:{value:'b'}});await screen.findByRole('alert');expect(useAuthStore.getState().session?.user?.activeTenantId).toBe('a');expect(client.getQueryData(['old-tenant-data'])).toEqual({private:true})});
