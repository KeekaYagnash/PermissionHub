import { useEffect } from 'react';
import { Navigate,Outlet,useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { authenticatedLanding } from '../lib/auth';

export default function AuthGate(){const {session,loading,setSession,setLoading}=useAuthStore(),location=useLocation();useEffect(()=>{let active=true;api.session().then(value=>{if(active)setSession(value)}).catch(()=>{if(active)setLoading(false)});return()=>{active=false}},[setLoading,setSession]);if(loading)return <div className="loading-screen">Checking your PermissionHub session…</div>;const landing=session?authenticatedLanding(session):'/login';if(landing==='/login')return <Navigate to="/login" state={{from:location.pathname}} replace/>;if(landing==='/select-tenant')return <Navigate to="/select-tenant" replace/>;return <Outlet/>}
