import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { activeNavKey, isNavActive, navItems, visibleNavItems } from './navigation';

const session=(roles:string[])=>({authenticated:true,csrfToken:'csrf',authProvider:'development',devAuthAvailable:true,user:{id:'u',email:'u@example',displayName:'User',provider:'development',providerSubject:'u',activeTenantId:'t',permissions:[],memberships:roles.map((role,index)=>({id:`m${index}`,tenantId:'t',tenantName:'Tenant',tenantSlug:'tenant',role,status:'ACTIVE',scopes:[]}))}} as any);

describe('navigation routing',()=>{
 it('matches nested request pages to Requests',()=>{
  expect(activeNavKey('/requests')).toBe('requests');
  expect(activeNavKey('/requests/PR-2001')).toBe('requests');
 });

 it('matches primary route roots consistently',()=>{
  expect(activeNavKey('/')).toBe('overview');
  expect(activeNavKey('/new-request')).toBe('new-request');
  expect(activeNavKey('/requests/new')).toBe('new-request');
  expect(activeNavKey('/permissions')).toBe('permissions');
  expect(activeNavKey('/identities')).toBe('identities');
 });

 it('does not highlight unrelated routes',()=>{
  expect(isNavActive('/permissions','requests')).toBe(false);
  expect(isNavActive('/requests/PR-1','requests')).toBe(true);
 });

 it('uses one shared route configuration for mobile and drawer navigation',()=>{
  expect(navItems.filter(item=>item.mobileVisible).map(item=>item.key)).toEqual(['overview','requests','new-request','activity']);
  expect(navItems.every(item=>item.drawerVisible)).toBe(true);
 });

 it('hides activity administration and connection for requesters',()=>{
  expect(visibleNavItems(session(['REQUESTER'])).map(item=>item.key)).toEqual(['overview','requests','new-request','permissions','identities']);
 });

 it('shows read-only reviewer navigation',()=>{
  expect(visibleNavItems(session(['SECURITY_REVIEWER'])).map(item=>item.key)).toEqual(['overview','requests','new-request','permissions','identities','activity','administration','connection']);
 });
});

describe('navigation shell CSS contract',()=>{
 const css=readFileSync(new URL('../index.css',import.meta.url),'utf8');

 it('defines fixed desktop sidebar and mobile bottom navigation offsets',()=>{
  expect(css).toContain('--desktop-sidebar-width');
  expect(css).toContain('--desktop-account-bar-height');
  expect(css).toContain('--mobile-bottom-nav-height');
  expect(css).toContain('margin-left:calc(var(--desktop-sidebar-width) + 24px)');
 });

 it('uses the intended 1024px breakpoint split',()=>{
  expect(css).toContain('@media (min-width:1024px)');
  expect(css).toContain('@media (max-width:1023px)');
  expect(css).toContain('.desktop-shell{display:block}');
  expect(css).toContain('.mobile-header,.mobile-bottom-nav,.drawer-layer{display:none!important}');
 });

 it('uses a fixed left desktop drawer/sidebar instead of a top primary nav',()=>{
  expect(css).toContain('.desktop-sidebar{position:fixed');
  expect(css).toContain('width:var(--desktop-sidebar-width)');
  expect(css).toContain('left:var(--desktop-sidebar-width)');
  expect(css).toContain('width:calc(100% - var(--desktop-sidebar-width) - 48px)');
 });

 it('positions wizard actions above the mobile bottom navigation',()=>{
  expect(css).toContain('bottom:calc(var(--mobile-bottom-nav-height) + env(safe-area-inset-bottom))');
 });

 it('does not enable page-level horizontal overflow or resize handles on the shell',()=>{
  expect(css).toContain('overflow-x:hidden');
  expect(css).not.toContain('resize:both');
  expect(css).not.toContain('resize: both');
  expect(css).not.toContain('zoom:');
  expect(css).not.toContain('scale(');
 });
});
