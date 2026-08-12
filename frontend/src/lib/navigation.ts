import type { AuthSession } from '../types';
import { can, type Capability } from './authz';

type NavItem={key:string;label:string;shortLabel:string;path:string;description:string;mobileVisible:boolean;drawerVisible:boolean;capability?:Capability};
export const navItems=[
 {key:'overview',label:'Overview',shortLabel:'Home',path:'/',description:'Operational summary',mobileVisible:true,drawerVisible:true,capability:undefined},
 {key:'requests',label:'Requests',shortLabel:'Requests',path:'/requests',description:'Request queue and approvals',mobileVisible:true,drawerVisible:true,capability:'REQUEST_VIEW_OWN' as Capability},
 {key:'new-request',label:'New Request',shortLabel:'New',path:'/new-request',description:'Start an IAM permission request',mobileVisible:true,drawerVisible:true,capability:'REQUEST_CREATE' as Capability},
 {key:'permissions',label:'Permissions',shortLabel:'Policies',path:'/permissions',description:'Managed policy catalogue',mobileVisible:false,drawerVisible:true,capability:'PERMISSION_CATALOGUE_VIEW' as Capability},
 {key:'identities',label:'AWS Identities',shortLabel:'Identities',path:'/identities',description:'IAM users and roles',mobileVisible:false,drawerVisible:true,capability:'IDENTITY_VIEW_OWN' as Capability},
 {key:'activity',label:'Activity',shortLabel:'Activity',path:'/activity',description:'Audit and lifecycle events',mobileVisible:true,drawerVisible:true,capability:'ACTIVITY_VIEW' as Capability},
 {key:'administration',label:'Administration',shortLabel:'Admin',path:'/administration',description:'Tenant and approval configuration',mobileVisible:false,drawerVisible:true,capability:'ADMINISTRATION_VIEW' as Capability},
 {key:'connection',label:'Connection',shortLabel:'Connect',path:'/connection',description:'AWS account status',mobileVisible:false,drawerVisible:true,capability:'CONNECTION_VIEW' as Capability}
] as const satisfies readonly NavItem[];

export type NavKey=typeof navItems[number]['key'];

export function activeNavKey(pathname:string):NavKey{
 if(pathname==='/'||pathname==='')return 'overview';
 if(pathname.startsWith('/requests/new'))return 'new-request';
 if(pathname.startsWith('/requests'))return 'requests';
 if(pathname.startsWith('/new-request'))return 'new-request';
 if(pathname.startsWith('/permissions'))return 'permissions';
 if(pathname.startsWith('/identities'))return 'identities';
 if(pathname.startsWith('/activity'))return 'activity';
 if(pathname.startsWith('/administration'))return 'administration';
 if(pathname.startsWith('/connection'))return 'connection';
 return 'overview';
}

export function isNavActive(pathname:string,key:NavKey){
 return activeNavKey(pathname)===key;
}

export function visibleNavItems(session?:AuthSession,placement:'desktop'|'mobile'|'drawer'='desktop'){
 return navItems.filter(item=>{
  if(placement==='mobile'&&!item.mobileVisible)return false;
  if(placement==='drawer'&&!item.drawerVisible)return false;
  return !item.capability||can(session,item.capability);
 });
}
