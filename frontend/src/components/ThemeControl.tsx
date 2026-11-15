import { Moon, Sun } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useThemePreference } from '../lib/theme';

export function ThemeControl({compact=false}:{compact?:boolean}){
 const {preference,setPreference}=useThemePreference();
 const dark=preference==='dark',Icon=dark?Sun:Moon;
 return <button type="button" className={`appearance-control theme-toggle${compact?' compact':''}`} aria-label={dark?'Switch to light theme':'Switch to dark theme'} title={dark?'Switch to light theme':'Switch to dark theme'} onClick={()=>setPreference(dark?'light':'dark')}>
  <Icon size={16} aria-hidden="true"/>
  {!compact&&<span>{dark?'Light theme':'Dark theme'}</span>}
 </button>;
}

export function PublicThemeControl(){
 const {pathname}=useLocation();
 const publicRoutes=['/login','/auth/callback','/select-tenant','/accept-invitation','/complete-profile','/unauthorised','/session-expired'];
 return publicRoutes.includes(pathname)?<div className="public-appearance"><ThemeControl/></div>:null;
}
