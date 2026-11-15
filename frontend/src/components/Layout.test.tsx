// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import Layout from './Layout';
import {useAuthStore} from '../store/auth';
import type {AuthSession,AppRole} from '../types';
vi.mock('../lib/api',()=>({api:{context:vi.fn().mockResolvedValue({accounts:[],tenants:[]}),connection:vi.fn()},setCsrfToken:vi.fn()}));
vi.mock('../lib/cognito',()=>({cognitoEnabled:()=>false,logoutCognito:vi.fn()}));
beforeEach(()=>{
 localStorage.clear();
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
});
afterEach(()=>{cleanup();useAuthStore.getState().clear();vi.unstubAllGlobals();document.body.style.overflow=''});
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
it('traps drawer focus, supports Escape, restores the menu button and unlocks the background',async()=>{
 open('ORGANISATION_ADMIN');
 const menu=screen.getAllByRole('button',{name:'Open navigation menu'})[1]!;
 menu.focus();fireEvent.click(menu);
 const dialog=screen.getByRole('dialog',{name:'Navigation'});
 const close=within(dialog).getByRole('button',{name:'Close navigation menu'});
 await waitFor(()=>expect(document.activeElement).toBe(close));
 expect(document.getElementById('main-content')?.hasAttribute('inert')).toBe(true);
 expect(document.body.style.overflow).toBe('hidden');
 const last=within(dialog).getByRole('button',{name:'Sign out'});last.focus();fireEvent.keyDown(last,{key:'Tab'});
 const first=within(dialog).getByRole('link',{name:'PermissionHub overview'});
 expect(document.activeElement).toBe(first);
 fireEvent.keyDown(first,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);
 fireEvent.keyDown(close,{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Navigation'})).toBeNull());
 expect(document.activeElement).toBe(menu);
 expect(document.body.style.overflow).toBe('');
 expect(document.getElementById('main-content')?.hasAttribute('inert')).toBe(false);
});
it('returns focus to the header opener when the drawer is opened from the header',async()=>{
 open();const menu=screen.getAllByRole('button',{name:'Open navigation menu'})[0]!;
 menu.focus();fireEvent.click(menu);
 const dialog=screen.getByRole('dialog',{name:'Navigation'});
 fireEvent.click(within(dialog).getByRole('button',{name:'Close navigation menu'}));
 expect(document.activeElement).toBe(menu);
});
