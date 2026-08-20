import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AuthGate from './components/AuthGate';
import { useAuthStore } from './store/auth';
import { can, type Capability } from './lib/authz';

const Overview=lazy(()=>import('./pages/Overview'));
const Requests=lazy(()=>import('./pages/Requests'));
const RequestDetail=lazy(()=>import('./pages/RequestDetail'));
const NewRequest=lazy(()=>import('./pages/NewRequest'));
const Permissions=lazy(()=>import('./pages/Permissions'));
const Identities=lazy(()=>import('./pages/Identities'));
const Activity=lazy(()=>import('./pages/Activity'));
const Connection=lazy(()=>import('./pages/Connection'));
const Login=lazy(()=>import('./pages/Login'));
const SelectTenant=lazy(()=>import('./pages/SelectTenant'));
const Unauthorised=lazy(()=>import('./pages/Unauthorised'));
const SessionExpired=lazy(()=>import('./pages/SessionExpired'));
const Administration=lazy(()=>import('./pages/Administration'));

export default function App(){
 return <Suspense fallback={<div className="loading-screen">Loading PermissionHub</div>}>
  <Routes>
   <Route path="login" element={<Login/>}/>
   <Route path="auth/callback" element={<Login/>}/>
   <Route path="select-tenant" element={<SelectTenant/>}/>
   <Route path="unauthorised" element={<Unauthorised/>}/>
   <Route path="session-expired" element={<SessionExpired/>}/>
   <Route element={<AuthGate/>}>
   <Route element={<Layout/>}>
    <Route index element={<Overview/>}/>
    <Route path="requests" element={<Requests/>}/>
    <Route path="requests/:id" element={<RequestDetail/>}/>
    <Route path="new-request" element={<RequireCapability capability="REQUEST_CREATE"><NewRequest/></RequireCapability>}/>
    <Route path="permissions" element={<RequireCapability capability="PERMISSION_CATALOGUE_VIEW"><Permissions/></RequireCapability>}/>
    <Route path="identities" element={<RequireCapability capability="IDENTITY_VIEW_OWN"><Identities/></RequireCapability>}/>
    <Route path="activity" element={<RequireCapability capability="ACTIVITY_VIEW"><Activity/></RequireCapability>}/>
    <Route path="connection" element={<RequireCapability capability="CONNECTION_VIEW"><Connection/></RequireCapability>}/>
    <Route path="administration" element={<RequireCapability capability="ADMINISTRATION_VIEW"><Administration/></RequireCapability>}/>
   </Route>
   </Route>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
 </Suspense>;
}

function RequireCapability({capability,children}:{capability:Capability;children:ReactNode}){
 const session=useAuthStore(state=>state.session);
 return can(session,capability)?children:<Navigate to="/unauthorised" replace/>;
}
