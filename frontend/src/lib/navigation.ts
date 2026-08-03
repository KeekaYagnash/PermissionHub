export const navItems=[
 {key:'overview',label:'Overview',shortLabel:'Home',path:'/',description:'Operational summary',mobileVisible:true,drawerVisible:true},
 {key:'requests',label:'Requests',shortLabel:'Requests',path:'/requests',description:'Request queue and approvals',mobileVisible:true,drawerVisible:true},
 {key:'new-request',label:'New Request',shortLabel:'New',path:'/new-request',description:'Start an IAM permission request',mobileVisible:true,drawerVisible:true},
 {key:'permissions',label:'Permissions',shortLabel:'Policies',path:'/permissions',description:'Managed policy catalogue',mobileVisible:false,drawerVisible:true},
 {key:'identities',label:'AWS Identities',shortLabel:'Identities',path:'/identities',description:'IAM users and roles',mobileVisible:false,drawerVisible:true},
 {key:'activity',label:'Activity',shortLabel:'Activity',path:'/activity',description:'Audit and lifecycle events',mobileVisible:true,drawerVisible:true},
 {key:'connection',label:'Connection',shortLabel:'Connect',path:'/connection',description:'AWS account status',mobileVisible:false,drawerVisible:true}
] as const;

export type NavKey=typeof navItems[number]['key'];

export function activeNavKey(pathname:string):NavKey{
 if(pathname==='/'||pathname==='')return 'overview';
 if(pathname.startsWith('/requests/new'))return 'new-request';
 if(pathname.startsWith('/requests'))return 'requests';
 if(pathname.startsWith('/new-request'))return 'new-request';
 if(pathname.startsWith('/permissions'))return 'permissions';
 if(pathname.startsWith('/identities'))return 'identities';
 if(pathname.startsWith('/activity'))return 'activity';
 if(pathname.startsWith('/connection'))return 'connection';
 return 'overview';
}

export function isNavActive(pathname:string,key:NavKey){
 return activeNavKey(pathname)===key;
}
