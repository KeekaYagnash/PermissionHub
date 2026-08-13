import { useEffect, useRef, useState, type ComponentType, type RefObject } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, FileKey2, GitPullRequestArrow, Grid3X3, Home, KeyRound, Laptop, LogOut, PlugZap, Settings, SunMoon, UserRoundCog, X } from 'lucide-react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { isNavActive, navItems, visibleNavItems, type NavKey } from '../lib/navigation';
import { useThemePreference } from '../lib/theme';
import { useAuthStore } from '../store/auth';
import { shouldAutoSelectAccount } from '../lib/auth';

const icons:Record<NavKey,ComponentType<{size?:number}>>={
 overview:Home,
 requests:GitPullRequestArrow,
 'new-request':FileKey2,
 permissions:KeyRound,
 identities:UserRoundCog,
 activity:Activity,
 administration:Settings,
 connection:PlugZap
};

export default function Layout(){
 const session=useAuthStore(state=>state.session),setSession=useAuthStore(state=>state.setSession),queryClient=useQueryClient();
 const activeAwsAccountRecordId=session?.user?.activeAwsAccountRecordId??session?.user?.activeAccountId;
 const context=useQuery({queryKey:['auth-context',session?.user?.activeTenantId,activeAwsAccountRecordId],queryFn:api.context});
 const {data}=useQuery({queryKey:['connection',activeAwsAccountRecordId],queryFn:api.connection,refetchInterval:60000,enabled:Boolean(activeAwsAccountRecordId)});
 const [drawerOpen,setDrawerOpen]=useState(false);
 const menuButtonRef=useRef<HTMLButtonElement>(null);
 const location=useLocation();
 useEffect(()=>{if(shouldAutoSelectAccount(context.data))void api.selectAccount(context.data!.accounts[0]!.id).then(value=>{setSession(value);queryClient.clear()})},[context.data,queryClient,setSession]);
 useEffect(()=>setDrawerOpen(false),[location.pathname]);
 useEffect(()=>{
  const media=window.matchMedia('(min-width: 1024px)');
  const sync=()=>{if(media.matches)setDrawerOpen(false)};
  sync();
  media.addEventListener('change',sync);
  return ()=>media.removeEventListener('change',sync);
 },[]);
 return <div className="app">
  {session?.developmentAuthenticationActive&&<div className="development-auth-banner" role="status">Development authentication is active</div>}
  <AppHeader connection={data} context={context.data} contextError={Boolean(context.error)} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}/>
  <main id="main-content"><Outlet key={activeAwsAccountRecordId??'no-aws-account'}/></main>
  <MobileBottomNavigation drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} menuButtonRef={menuButtonRef}/>
  <MobileNavigationDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} connection={data} context={context.data} returnFocusRef={menuButtonRef}/>
 </div>;
}

function AppHeader({connection,context,contextError,drawerOpen,setDrawerOpen}:{connection:any;context:any;contextError:boolean;drawerOpen:boolean;setDrawerOpen:(open:boolean)=>void}){
 const location=useLocation();
 const session=useAuthStore(state=>state.session);
 return <>
  <aside className="desktop-sidebar desktop-shell" aria-label="Desktop navigation drawer">
   <Brand/>
   <DesktopNavigation/>
   <div className="desktop-sidebar-footer">
    {visibleNavItems(session).filter(item=>['administration','connection'].includes(item.key)).map(item=>{const Icon=icons[item.key];return <NavLink key={item.key} to={item.path} aria-current={isNavActive(location.pathname,item.key)?'page':undefined} className={isNavActive(location.pathname,item.key)?'active':''}><Icon size={16}/><span>{item.label}</span></NavLink>})}
    <ThemeControl/>
    <UserMenu compact/>
   </div>
  </aside>
  <header className="desktop-account-header desktop-shell"><ContextBar connection={connection} context={context} contextError={contextError}/></header>
  <header className="mobile-header">
   <Brand/>
   <div className="mobile-header-actions"><ConnectionDot connection={connection}/><ThemeControl compact/><button className="mobile-header-menu" aria-label="Open navigation menu" aria-expanded={drawerOpen} aria-controls="mobile-nav-drawer" onClick={()=>setDrawerOpen(true)}><Grid3X3 size={18}/></button></div>
  </header>
 </>;
}

function Brand(){return <Link to="/" className="brand" aria-label="PermissionHub overview"><div className="brand-mark">PH</div><div><strong>PermissionHub</strong><span>AWS permission requests</span></div></Link>}

function DesktopNavigation(){
 const location=useLocation();
 const session=useAuthStore(state=>state.session);
 return <nav className="desktop-nav" aria-label="Primary navigation">{visibleNavItems(session).filter(item=>!['administration','connection'].includes(item.key)).map(item=>{const Icon=icons[item.key];return <NavLink key={item.key} to={item.path} end={item.path==='/' ? true : undefined} aria-current={isNavActive(location.pathname,item.key)?'page':undefined} className={isNavActive(location.pathname,item.key)?'active':''}><Icon size={16}/><span>{item.label}</span></NavLink>})}</nav>;
}

function MobileBottomNavigation({drawerOpen,setDrawerOpen,menuButtonRef}:{drawerOpen:boolean;setDrawerOpen:(open:boolean)=>void;menuButtonRef:RefObject<HTMLButtonElement|null>}){
 const location=useLocation();
 const session=useAuthStore(state=>state.session),visible=visibleNavItems(session,'mobile');
 return <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
  {visible.slice(0,2).map(item=><MobileNavLink key={item.key} item={item} active={isNavActive(location.pathname,item.key)}/>)}
  <button ref={menuButtonRef} className={drawerOpen?'mobile-menu-button open':'mobile-menu-button'} aria-label="Open navigation menu" aria-expanded={drawerOpen} aria-controls="mobile-nav-drawer" onClick={()=>setDrawerOpen(true)}><Grid3X3 size={20}/><span>Menu</span></button>
  {visible.slice(2).map(item=><MobileNavLink key={item.key} item={item} active={isNavActive(location.pathname,item.key)}/>)}
 </nav>;
}

function MobileNavLink({item,active}:{item:typeof navItems[number];active:boolean}){
 const Icon=icons[item.key];
 return <NavLink to={item.path} aria-current={active?'page':undefined} className={active?'active':''}><Icon size={18}/><span>{item.shortLabel}</span></NavLink>;
}

function MobileNavigationDrawer({open,onClose,connection,context,returnFocusRef}:{open:boolean;onClose:()=>void;connection:any;context:any;returnFocusRef:RefObject<HTMLButtonElement|null>}){
 const drawerRef=useRef<HTMLDivElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 const location=useLocation();
 const session=useAuthStore(state=>state.session);
 useEffect(()=>{
  if(!open)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  window.setTimeout(()=>closeRef.current?.focus(),0);
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose();return}
   if(event.key!=='Tab'||!drawerRef.current)return;
   const focusable=[...drawerRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',onKeyDown);
  return ()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKeyDown);returnFocusRef.current?.focus()};
 },[open,onClose,returnFocusRef]);
 if(!open)return null;
 return <div className="drawer-layer" role="presentation">
  <button className="drawer-backdrop" aria-label="Close navigation menu" onClick={onClose}/>
  <aside id="mobile-nav-drawer" className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation" ref={drawerRef}>
   <div className="drawer-head"><Brand/><button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close navigation menu"><X size={18}/></button></div>
   <nav className="drawer-nav" aria-label="Navigation drawer">{visibleNavItems(session,'drawer').map(item=>{const Icon=icons[item.key];const active=isNavActive(location.pathname,item.key);return <NavLink key={item.key} to={item.path} aria-current={active?'page':undefined} className={active?'active':''}><Icon size={18}/><span><strong>{item.label}</strong><small>{item.description}</small></span></NavLink>})}</nav>
   <section className="drawer-utilities" aria-label="Utilities"><h2>Active context</h2><ContextBar connection={connection} context={context} compact/><ThemeControl/><UserMenu/></section>
  </aside>
 </div>;
}

function ThemeControl({compact=false}:{compact?:boolean}){
 const theme=useThemePreference();
 const nextTheme=theme.preference==='system'?'light':theme.preference==='light'?'dark':'system';
 return <button className={compact?'theme-toggle compact':'theme-toggle'} onClick={()=>theme.setPreference(nextTheme)} title={`Theme: ${theme.preference}. Switch to ${nextTheme}.`} aria-label={`Theme: ${theme.preference}. Switch to ${nextTheme}.`}>
  {theme.preference==='system'?<Laptop size={16}/>:<SunMoon size={16}/>}<span>{theme.preference}</span>
 </button>;
}

function ConnectionDot({connection}:{connection:any}){return <span className={connection?.connected?'connection-dot connected':'connection-dot mock'} aria-label={connection?.connected?'AWS connected':'AWS disconnected'}/>}
function ContextBar({connection,context,compact=false,contextError=false}:{connection:any;context:any;compact?:boolean;contextError?:boolean}){const session=useAuthStore(state=>state.session),setSession=useAuthStore(state=>state.setSession),queryClient=useQueryClient(),activeRecordId=session?.user?.activeAwsAccountRecordId??session?.user?.activeAccountId;const active=context?.accounts?.find((account:any)=>account.accountRecordId===activeRecordId);async function changeAccount(accountRecordId:string){const next=await api.selectAccount(accountRecordId);setSession(next);queryClient.clear()}async function changeTenant(tenantId:string){const next=await api.selectTenant(tenantId);setSession(next);queryClient.clear()}if(contextError&&!context)return <div className={compact?'context-bar compact':'context-bar'}><ConnectionDot connection={connection}/><span className="connection-context-warning">Account context unavailable</span>{activeRecordId&&<span className="muted">Selection retained</span>}</div>;return <div className={compact?'context-bar compact':'context-bar'}><ConnectionDot connection={connection}/>{context?.tenants?.length>1&&<select aria-label="Active tenant" value={session?.user?.activeTenantId??''} onChange={event=>void changeTenant(event.target.value)}>{context.tenants.map((item:any)=><option value={item.id} key={item.id}>{item.name}</option>)}</select>}<select aria-label="Active AWS account" value={activeRecordId??''} onChange={event=>void changeAccount(event.target.value)}><option value="" disabled>Select AWS account</option>{context?.accounts?.map((account:any)=><option value={account.accountRecordId} key={account.accountRecordId}>{account.accountName} · {account.awsAccountNumber}</option>)}</select>{active&&<><span className={`account-type ${active.accountType.toLowerCase()}`}>{active.accountType.replaceAll('_',' ')}</span><span>{active.region}</span></>}</div>}
function UserMenu({compact=false}:{compact?:boolean}){const session=useAuthStore(state=>state.session),clear=useAuthStore(state=>state.clear),navigate=useNavigate();async function logout(){try{await api.logout()}finally{clear();navigate('/login',{replace:true})}}return <div className={compact?'user-menu compact':'user-menu'}><span><strong>{session?.user?.displayName}</strong><small>{session?.user?.email}</small></span><button onClick={()=>void logout()} title="Sign out" aria-label="Sign out"><LogOut size={15}/></button></div>}
