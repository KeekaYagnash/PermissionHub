import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';

const Overview=lazy(()=>import('./pages/Overview'));
const Requests=lazy(()=>import('./pages/Requests'));
const RequestDetail=lazy(()=>import('./pages/RequestDetail'));
const NewRequest=lazy(()=>import('./pages/NewRequest'));
const Permissions=lazy(()=>import('./pages/Permissions'));
const Identities=lazy(()=>import('./pages/Identities'));
const Activity=lazy(()=>import('./pages/Activity'));
const Connection=lazy(()=>import('./pages/Connection'));

export default function App(){
 return <Suspense fallback={<div className="loading-screen">Loading PermissionHub</div>}>
  <Routes>
   <Route element={<Layout/>}>
    <Route index element={<Overview/>}/>
    <Route path="requests" element={<Requests/>}/>
    <Route path="requests/:id" element={<RequestDetail/>}/>
    <Route path="new-request" element={<NewRequest/>}/>
    <Route path="permissions" element={<Permissions/>}/>
    <Route path="identities" element={<Identities/>}/>
    <Route path="activity" element={<Activity/>}/>
    <Route path="connection" element={<Connection/>}/>
   </Route>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
 </Suspense>;
}
