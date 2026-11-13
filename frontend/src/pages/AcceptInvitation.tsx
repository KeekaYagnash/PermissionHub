import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import {cognitoEnabled,logoutCognito} from '../lib/cognito';

export default function AcceptInvitation(){
 const navigate=useNavigate(),setSession=useAuthStore(s=>s.setSession),clear=useAuthStore(s=>s.clear);
 const [details,setDetails]=useState<{organizationName:string;role:string;expiresAt:string}>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [proof]=useState(()=>{const fragment=new URLSearchParams(location.hash.slice(1)),value=fragment.get('token');if(value&&/^[A-Za-z0-9_-]{43}$/.test(value))sessionStorage.setItem('permissionhub.invitation',value);if(value)history.replaceState(null,'','/accept-invitation');return sessionStorage.getItem('permissionhub.invitation')??''});
 useEffect(()=>{let active=true;async function load(){try{if(!proof)throw new Error('No invitation link was found. Ask your administrator to send a new invitation.');const session=await api.session();if(!session.authenticated){navigate('/login',{replace:true});return}setSession(session);if(session.profileRequired){navigate('/complete-profile',{replace:true});return}const info=await api.inspectInvitation(proof);if(active)setDetails(info)}catch(e){if((e as {status?:number}).status===401){navigate('/login',{replace:true});return}if(active)setError(e instanceof Error?e.message:'Unable to load invitation.')}}void load();return()=>{active=false}},[proof,navigate,setSession]);
 async function accept(){if(busy)return;setBusy(true);setError('');try{const session=await api.acceptInvitation(proof);sessionStorage.removeItem('permissionhub.invitation');setSession(session);navigate('/',{replace:true})}catch(e){setError(e instanceof Error?e.message:'Could not accept invitation.')}finally{setBusy(false)}}
 async function switchAccount(){if(cognitoEnabled()){try{await api.logout()}finally{clear();await logoutCognito()}}else{await api.logout();clear();navigate('/login',{replace:true})}}
 return <main className="auth-page"><section className="auth-card"><h1>Organisation invitation</h1>{error?<div className="error-box" role="alert">{error}</div>:details?<><p>Join <strong>{details.organizationName}</strong></p><p>Application role: {details.role.replaceAll('_',' ')}</p><p className="muted">Expires {new Date(details.expiresAt).toLocaleString()}. Membership is granted only after you accept.</p><button className="btn primary" disabled={busy} onClick={()=>void accept()}>{busy?'Joining…':'Accept invitation'}</button></>:<p>Checking your invitation…</p>}
 <button className="link-button" disabled={busy} onClick={()=>void switchAccount()}>Sign in with a different account</button><button className="link-button" onClick={()=>{sessionStorage.removeItem('permissionhub.invitation');navigate('/select-tenant')}}>Continue without this invitation</button></section></main>;
}
