// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import Layout from './Layout';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {AuthSession,AppRole} from '../types';
import {applicationVersion} from '../lib/version';
vi.mock('../lib/api',()=>({api:{context:vi.fn().mockResolvedValue({accounts:[],tenants:[]}),connection:vi.fn(),selectAccount:vi.fn()},setCsrfToken:vi.fn()}));
vi.mock('../lib/cognito',()=>({cognitoEnabled:()=>false,logoutCognito:vi.fn()}));
beforeEach(()=>{
 localStorage.clear();
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
});
afterEach(()=>{cleanup();useAuthStore.getState().clear();vi.clearAllMocks();vi.unstubAllGlobals();document.body.style.overflow=''});
function open(role:AppRole='REQUESTER'){
 const session:AuthSession={authenticated:true,authProvider:'test',devAuthAvailable:false,user:{id:'u',displayName:'Test Reviewer',email:'test@example.invalid',provider:'test',providerSubject:'u',activeTenantId:'tenant',permissions:[],memberships:[{id:'m',tenantId:'tenant',tenantName:'Test Company',tenantSlug:'test',role,status:'ACTIVE',scopes:[]}]}};
 useAuthStore.getState().setSession(session);
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><MemoryRouter><Routes><Route element={<Layout/>}><Route index element={<h1>Overview content</h1>}/><Route path="requests" element={<h1>Requests content</h1>}/></Route></Routes></MemoryRouter></QueryClientProvider>);
}
it('preserves capability-filtered desktop navigation and existing request routes',async()=>{
 open();const navigation=screen.getByRole('navigation',{name:'Primary navigation'});
 expect(within(navigation).queryByRole('link',{name:'Administration'})).toBeNull();
 fireEvent.click(within(navigation).getByRole('link',{name:'Requests'}));
 expect(await screen.findByRole('heading',{name:'Requests content'})).toBeTruthy();
 expect(screen.getByRole('link',{name:'Skip to main content'}).getAttribute('href')).toBe('#main-content');
});
it('keeps IAMOps artwork without the redundant shell subtitle',()=>{
 open();expect(screen.queryByText('AWS permission requests')).toBeNull();expect(screen.getAllByAltText('IAMOps').length).toBeGreaterThan(0);
});
it('shows package-derived version and separately destructive sign-out controls with stacked profile details',()=>{
 open();expect(screen.queryByRole('img',{name:'Disraptor'})).toBeNull();expect(screen.getByText(`Version ${applicationVersion}`)).toBeTruthy();for(const button of screen.getAllByRole('button',{name:'Sign out'}))expect(button.classList.contains('sign-out-btn')).toBe(true);const profile=document.querySelector('.desktop-account-header .user-menu a')!;expect(profile.querySelector('strong')?.textContent).toBe('Test Reviewer');expect(profile.querySelector('small')?.textContent).toBe('test@example.invalid');
});
it('traps drawer focus, supports Escape, restores the menu button and unlocks the background',async()=>{
 open('ORGANISATION_ADMIN');
 const menu=screen.getByRole('button',{name:'More navigation'});
 menu.focus();fireEvent.click(menu);
 const dialog=screen.getByRole('dialog',{name:'Navigation'});
 const close=within(dialog).getByRole('button',{name:'Close navigation menu'});
 await waitFor(()=>expect(document.activeElement).toBe(close));
 expect(document.getElementById('main-content')?.hasAttribute('inert')).toBe(true);
 expect(document.body.style.overflow).toBe('hidden');
 const last=within(dialog).getByRole('button',{name:'Switch to dark theme'});last.focus();fireEvent.keyDown(last,{key:'Tab'});
 const first=within(dialog).getByRole('link',{name:'IAMOps overview'});
 expect(document.activeElement).toBe(first);
 fireEvent.keyDown(first,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);
 fireEvent.keyDown(close,{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Navigation'})).toBeNull());
 expect(document.activeElement).toBe(menu);
 expect(document.body.style.overflow).toBe('');
 expect(document.getElementById('main-content')?.hasAttribute('inert')).toBe(false);
});
it('returns focus to More when the drawer is dismissed',async()=>{
 open();const menu=screen.getAllByRole('button',{name:'More navigation'})[0]!;
 menu.focus();fireEvent.click(menu);
 const dialog=screen.getByRole('dialog',{name:'Navigation'});
 fireEvent.click(within(dialog).getByRole('button',{name:'Close navigation menu'}));
 expect(document.activeElement).toBe(menu);
});
it('shows organization context and four fixed mobile destinations',()=>{
 open();expect(screen.getAllByText('Test Company').length).toBeGreaterThan(0);
 const bottom=screen.getByRole('navigation',{name:'Mobile primary navigation'});expect(within(bottom).getAllByRole('link').map(item=>item.textContent)).toEqual(['Overview','Requests','New Request']);expect(within(bottom).getByRole('button',{name:'More navigation'})).toBeTruthy();
 expect(screen.getAllByRole('button',{name:'More navigation'})).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'More navigation'}));
 const drawer=screen.getByRole('dialog',{name:'Navigation'});
 expect(within(drawer).queryByRole('link',{name:/Administration/})).toBeNull();
 expect(within(drawer).queryByRole('link',{name:/AWS Connection/})).toBeNull();
 expect(within(drawer).getByRole('link',{name:/Permissions/})).toBeTruthy();
});
it('keeps organization administration and connections discoverable for authorized administrators',()=>{
 open('ORGANISATION_ADMIN');fireEvent.click(screen.getByRole('button',{name:'More navigation'}));
 const drawer=screen.getByRole('dialog',{name:'Navigation'});
 expect(within(drawer).getByRole('link',{name:/Administration/}).getAttribute('href')).toBe('/administration');
 expect(within(drawer).getByRole('link',{name:/AWS Connection/}).getAttribute('href')).toBe('/connection');
});
it('confines remaining destinations to More and dismisses with the backdrop',()=>{
 open();expect(screen.getAllByRole('combobox',{name:'Active organization'}).length).toBeGreaterThan(0);fireEvent.click(screen.getByRole('button',{name:'More navigation'}));const drawer=screen.getByRole('dialog',{name:'Navigation'});expect(within(drawer).getByRole('link',{name:/Organizations/}).getAttribute('href')).toBe('/administration/organizations');expect(within(drawer).queryByRole('link',{name:'Requests'})).toBeNull();expect(within(drawer).queryByRole('combobox')).toBeNull();fireEvent.click(document.querySelector('.drawer-backdrop')!);expect(screen.queryByRole('dialog')).toBeNull();
});
it('retains the session and gives a recovery message when account selection fails',async()=>{
 vi.mocked(api.context).mockResolvedValue({tenants:[],organisations:[],organisationalUnits:[],accounts:[{id:'record-2',accountRecordId:'record-2',tenantId:'tenant',accountId:'123456789012',accountName:'Authorized account',awsAccountNumber:'123456789012',accountType:'DEVELOPMENT',environment:'development',riskTier:'LOW',region:'af-south-1',connectionType:'ACCESS_KEYS',connectionStatus:'PENDING'}]});
 vi.mocked(api.selectAccount).mockRejectedValue(new Error('Connection unavailable'));
 open();await screen.findAllByRole('option',{name:'Authorized account · 123456789012'});
 fireEvent.change(screen.getAllByRole('combobox',{name:'Active AWS account'})[0]!,{target:{value:'record-2'}});
 expect((await screen.findAllByText('Could not switch context. Your previous selection is retained. Please try again.')).length).toBeGreaterThan(0);
 expect(useAuthStore.getState().session?.user?.activeTenantId).toBe('tenant');
 expect(api.selectAccount).toHaveBeenCalledWith('record-2');
});
