import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';

// Keep existing emailed links working, including proofs retained during signup.
export default function AcceptInvitation(){
 const navigate=useNavigate(),setSession=useAuthStore(state=>state.setSession),[error,setError]=useState('');
 const [proof]=useState(()=>{const value=new URLSearchParams(location.hash.slice(1)).get('token');if(value&&/^[A-Za-z0-9_-]{43}$/.test(value))sessionStorage.setItem('permissionhub.invitation',value);if(value)history.replaceState(null,'','/accept-invitation');return sessionStorage.getItem('permissionhub.invitation')??''});
 useEffect(()=>{let active=true;void api.session().then(session=>{if(!active)return;if(!session.authenticated){navigate('/login',{replace:true});return}setSession(session);navigate(session.profileRequired?'/complete-profile':'/administration/organizations#pending-invitations',{replace:true})}).catch(()=>{if(active)setError('Unable to check your session. Sign in again to review your invitations.')});return()=>{active=false}},[navigate,setSession]);
 return <main className="auth-page"><section className="auth-card"><h1>Organization invitation</h1>{error?<p role="alert">{error}</p>:<p role="status">{proof?'Opening your organization invitations…':'Opening your organizations…'}</p>}<Link className="btn secondary" to="/login">Sign in</Link></section></main>;
}
