import { create } from 'zustand';

type Role='Administrator'|'Manager'|'Engineer'|'Auditor'|'Viewer';

type AppState = {
  sidebarOpen:boolean; commandOpen:boolean; notificationsOpen:boolean; role:Role; organization:string;
  toggleSidebar:()=>void; setCommandOpen:(v:boolean)=>void; setNotificationsOpen:(v:boolean)=>void; setRole:(r:Role)=>void; setOrganization:(o:string)=>void;
};
export const useAppStore=create<AppState>((set)=>({
 sidebarOpen:false,commandOpen:false,notificationsOpen:false,role:'Administrator',organization:'Acme Financial Group',
 toggleSidebar:()=>set(s=>({sidebarOpen:!s.sidebarOpen})),setCommandOpen:v=>set({commandOpen:v}),setNotificationsOpen:v=>set({notificationsOpen:v}),setRole:role=>set({role}),setOrganization:organization=>set({organization})
}));
