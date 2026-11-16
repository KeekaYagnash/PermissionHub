import { Fragment, useCallback, useEffect, useRef, useState, type ComponentType, type RefObject } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, FileKey2, GitPullRequestArrow, Menu, Home, KeyRound, LogOut, PlugZap, Settings, UserRoundCog, X } from 'lucide-react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cognitoEnabled,logoutCognito } from '../lib/cognito';
import { isNavActive, visibleNavItems, type NavKey } from '../lib/navigation';
import { ThemeControl } from './ThemeControl';
import { useAuthStore } from '../store/auth';
import { shouldAutoSelectAccount } from '../lib/auth';
import {OrganizationPicker} from './OrganizationPicker';

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
 const closeDrawer=useCallback(()=>setDrawerOpen(false),[]);
 const menuButtonRef=useRef<HTMLButtonElement>(null);
 const location=useLocation();
 const contextChanging=useAuthStore(state=>state.contextChanging);
 useEffect(()=>{if(!contextChanging&&shouldAutoSelectAccount(context.data))void api.selectAccount(context.data!.accounts[0]!.id).then(value=>{setSession(value);queryClient.clear()}).catch(()=>{/* Keep selection available for a deliberate retry. */})},[context.data,contextChanging,queryClient,setSession]);
 useEffect(()=>setDrawerOpen(false),[location.pathname,session?.user?.activeTenantId]);
 useEffect(()=>{
  const media=window.matchMedia('(min-width: 1024px)');
  const sync=()=>{if(media.matches)setDrawerOpen(false)};
  sync();
  media.addEventListener('change',sync);
  return ()=>media.removeEventListener('change',sync);
 },[]);
 return <div className="app">
  <a className="skip-link" href="#main-content">Skip to main content</a>
  {session?.developmentAuthenticationActive&&<div className="development-auth-banner" role="status">Development authentication is active</div>}
  <AppHeader connection={data} context={context.data} contextError={Boolean(context.error)} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} menuButtonRef={menuButtonRef}/>
  <main id="main-content" tabIndex={-1} inert={drawerOpen||undefined}><Outlet key={`${session?.user?.activeTenantId}:${activeAwsAccountRecordId??'no-aws-account'}`}/></main>
  <MobileNavigationDrawer open={drawerOpen} onClose={closeDrawer} connection={data} context={context.data} returnFocusRef={menuButtonRef}/>
 </div>;
}

function AppHeader({connection,context,contextError,drawerOpen,setDrawerOpen,menuButtonRef}:{connection:any;context:any;contextError:boolean;drawerOpen:boolean;setDrawerOpen:(open:boolean)=>void;menuButtonRef:RefObject<HTMLButtonElement|null>}){
 const location=useLocation();
 const session=useAuthStore(state=>state.session);
 return <>
  <aside className="desktop-sidebar desktop-shell" aria-label="Desktop navigation drawer">
   <Brand/>
   <OrganizationPicker/>
   <DesktopNavigation/>
   <div className="desktop-sidebar-footer">
    {visibleNavItems(session).some(item=>['administration','connection'].includes(item.key))&&<span className="navigation-group-label">Organization management</span>}
    {visibleNavItems(session).filter(item=>['administration','connection'].includes(item.key)).map(item=>{const Icon=icons[item.key];return <NavLink key={item.key} to={item.path} aria-current={isNavActive(location.pathname,item.key)?'page':undefined} className={isNavActive(location.pathname,item.key)?'active':''}><Icon size={16}/><span>{item.label}</span></NavLink>})}
    <ThemeControl/>
    <UserMenu compact/>
    <img className="maker-logo" src="/DR_Logo_Colour.png" alt="Disraptor"/>
   </div>
  </aside>
  <header className="desktop-account-header desktop-shell"><ContextBar connection={connection} context={context} contextError={contextError}/></header>
  <header className="mobile-header">
   <Brand/>
   <div className="mobile-header-actions"><ThemeControl compact/><button ref={menuButtonRef} className="mobile-header-menu" aria-label="Open navigation menu" aria-expanded={drawerOpen} aria-controls="mobile-nav-drawer" onClick={()=>setDrawerOpen(true)}><Menu size={18}/></button></div>
  </header>
  <div className="mobile-context-strip"><OrganizationIdentity/><ContextBar connection={connection} context={context} contextError={contextError} compact/></div>
 </>;
}

function Brand(){return <Link to="/" className="brand" aria-label="PermissionHub overview"><img className="product-icon" src="/DR_Icon_Colour.png" alt=""/><div><strong>PermissionHub</strong><span>AWS permission requests</span></div></Link>}

function OrganizationIdentity(){const session=useAuthStore(state=>state.session);const membership=session?.user?.memberships.find(item=>item.tenantId===session.user?.activeTenantId&&item.status==='ACTIVE');return membership?<div className="organization-identity"><small>Organization</small><strong title={membership.tenantName}>{membership.tenantName}</strong></div>:null}

function DesktopNavigation(){
 const location=useLocation();
 const session=useAuthStore(state=>state.session);
 return <nav className="desktop-nav" aria-label="Primary navigation">{visibleNavItems(session).filter(item=>!['administration','connection'].includes(item.key)).map(item=>{const Icon=icons[item.key];return <NavLink key={item.key} to={item.path} end={item.path==='/' ? true : undefined} aria-current={isNavActive(location.pathname,item.key)?'page':undefined} className={isNavActive(location.pathname,item.key)?'active':''}><Icon size={16}/><span>{item.label}</span></NavLink>})}</nav>;
}

function MobileNavigationDrawer({open,onClose,connection,context,returnFocusRef}:{open:boolean;onClose:()=>void;connection:any;context:any;returnFocusRef:RefObject<HTMLButtonElement|null>}){
 const drawerRef=useRef<HTMLDivElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 const location=useLocation();
 const session=useAuthStore(state=>state.session);
 useEffect(()=>{
  if(!open)return;
  const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const focusTimer=window.setTimeout(()=>closeRef.current?.focus(),0);
  const onKeyDown=(event:KeyboardEvent)=>{
   // A portal dialog owns focus/Escape until its own guarded close succeeds.
   if(document.querySelector('.modal[aria-modal="true"]'))return;
   if(event.key==='Escape'){event.preventDefault();onClose();return}
   if(event.key!=='Tab'||!drawerRef.current)return;
   const focusable=[...drawerRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',onKeyDown);
  return ()=>{window.clearTimeout(focusTimer);document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKeyDown);(previousFocus?.isConnected?previousFocus:returnFocusRef.current)?.focus()};
 },[open,onClose,returnFocusRef]);
 if(!open)return null;
 return <div className="drawer-layer" role="presentation">
  <button className="drawer-backdrop" aria-label="Close navigation menu" onClick={onClose}/>
  <aside id="mobile-nav-drawer" className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation" ref={drawerRef}>
   <div className="drawer-head"><Brand/><button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close navigation menu"><X size={18}/></button></div>
   <nav className="drawer-nav" aria-label="Navigation drawer">{visibleNavItems(session,'drawer').map(item=>{const Icon=icons[item.key];const active=isNavActive(location.pathname,item.key),startManagement=item.key==='administration'||item.key==='connection'&&!visibleNavItems(session).some(link=>link.key==='administration');return <Fragment key={item.key}>{startManagement&&<span className="navigation-group-label">Organization management</span>}<NavLink to={item.path} aria-current={active?'page':undefined} className={active?'active':''}><Icon size={18}/><span><strong>{item.label}</strong><small>{item.description}</small></span></NavLink></Fragment>})}</nav>
   <section className="drawer-utilities" aria-label="Utilities"><OrganizationPicker/><h2>Active context</h2><ContextBar connection={connection} context={context} compact/><ThemeControl/><UserMenu/><img className="maker-logo" src="/DR_Logo_Colour.png" alt="Disraptor"/></section>
  </aside>
 </div>;
}

function ConnectionDot({connection}:{connection:any}){return <span className={connection?.connected?'connection-dot connected':'connection-dot mock'} aria-label={connection?.connected?'AWS connected':'AWS disconnected'}/>}
function ContextBar({connection,context,compact=false,contextError=false}:{connection:any;context:any;compact?:boolean;contextError?:boolean}){
 const session=useAuthStore(state=>state.session),setSession=useAuthStore(state=>state.setSession),queryClient=useQueryClient();
 const contextChanging=useAuthStore(state=>state.contextChanging);
 const [changing,setChanging]=useState(false),[selectionError,setSelectionError]=useState('');
 const activeRecordId=session?.user?.activeAwsAccountRecordId??session?.user?.activeAccountId;
 const active=context?.accounts?.find((account:any)=>account.accountRecordId===activeRecordId);
 async function changeSelection(value:string,kind:'account'|'tenant'){
  if(changing||contextChanging)return;setChanging(true);setSelectionError('');
  try{const next=await(kind==='account'?api.selectAccount(value):api.selectTenant(value));await queryClient.cancelQueries();queryClient.clear();setSession(next)}
  catch{setSelectionError('Could not switch context. Your previous selection is retained. Please try again.')}
  finally{setChanging(false)}
 }
 const status=contextError?'Account context unavailable':changing?'Switching account…':!context?'Loading accounts…':!activeRecordId?'Select an AWS account to get started':connection?.connected?'Connected':active?.connectionStatus?.replaceAll('_',' ').toLowerCase()??'Checking connection…';
 return <div className={compact?'context-bar compact':'context-bar'}>
  <ConnectionDot connection={connection}/>
  <select aria-label="Active AWS account" disabled={changing||contextChanging||!context||!context.accounts?.length} value={activeRecordId??''} onChange={event=>void changeSelection(event.target.value,'account')}><option value="" disabled>Select AWS account</option>{context?.accounts?.map((account:any)=><option value={account.accountRecordId} key={account.accountRecordId}>{account.accountName} · {account.awsAccountNumber}</option>)}</select>
  {active&&<><span className={`account-type ${active.accountType.toLowerCase()}`}>{active.accountType.replaceAll('_',' ')}</span><span>{active.region}</span></>}
  <span className="context-status" role="status">{status}</span>
  {!activeRecordId&&visibleNavItems(session).some(item=>item.key==='connection')&&<Link className="context-next-action" to="/connection">Manage AWS connections</Link>}
  {selectionError&&<span className="error-text" role="alert">{selectionError}</span>}
 </div>
}
function UserMenu({compact=false}:{compact?:boolean}){const session=useAuthStore(state=>state.session),clear=useAuthStore(state=>state.clear),navigate=useNavigate(),queryClient=useQueryClient();async function logout(){try{if(cognitoEnabled()){try{await api.logout()}finally{await logoutCognito()}}else await api.logout()}finally{queryClient.clear();clear();if(!cognitoEnabled())navigate('/login',{replace:true})}}return <div className={compact?'user-menu compact':'user-menu'}><NavLink to="/profile"><strong>{session?.user?.displayName}</strong><small>{session?.user?.email}</small></NavLink><button onClick={()=>void logout()} title="Sign out" aria-label="Sign out"><LogOut size={15}/></button></div>}
