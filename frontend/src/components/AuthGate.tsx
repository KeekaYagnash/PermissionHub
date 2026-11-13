import { useEffect,useState } from 'react';
import { Navigate,Outlet,useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { authenticatedLanding } from '../lib/auth';

export default function AuthGate(){
 const {session,loading,setSession,setLoading,clear}=useAuthStore(),location=useLocation();
 const [error,setError]=useState(''),[retry,setRetry]=useState(0),[expired,setExpired]=useState(false);
 useEffect(()=>{let active=true;setError('');setLoading(true);api.session().then(value=>{if(active)setSession(value)}).catch((error:unknown)=>{if(!active)return;const status=(error as {status?:number}).status;if(status===401||error instanceof Error&&error.message.includes('expired')){setExpired(Boolean(useAuthStore.getState().session?.authenticated));clear()}else{setError('Unable to check your session. Your saved context has not been cleared.');setLoading(false)}});return()=>{active=false}},[retry,setLoading,setSession,clear]);
 if(expired)return <Navigate to="/session-expired" replace/>;
 if(error)return <main className="auth-page"><section className="auth-card"><p role="alert">{error}</p><button className="btn primary" onClick={()=>setRetry(value=>value+1)}>Retry</button></section></main>;
 if(loading)return <div className="loading-screen">Checking your PermissionHub session…</div>;
 const landing=session?authenticatedLanding(session):'/login';
 if(landing==='/login')return <Navigate to="/login" state={{from:location.pathname}} replace/>;
 if(landing==='/complete-profile')return <Navigate to="/complete-profile" replace/>;
 if(landing==='/select-tenant')return <Navigate to="/select-tenant" replace/>;
 return <Outlet/>;
}
