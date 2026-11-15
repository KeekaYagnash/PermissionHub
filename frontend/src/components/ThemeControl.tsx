import { Laptop, Moon, Sun } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useThemePreference } from '../lib/theme';
import type { ThemePreference } from '../lib/iam';

export function ThemeControl({compact=false}:{compact?:boolean}){
 const {preference,setPreference}=useThemePreference();
 const Icon=preference==='dark'?Moon:preference==='light'?Sun:Laptop;
 return <label className={`appearance-control${compact?' compact':''}`}>
  <Icon size={16} aria-hidden="true"/>
  <span className="sr-only">Colour theme</span>
  <select aria-label="Colour theme" value={preference} onChange={event=>setPreference(event.target.value as ThemePreference)}>
   <option value="system">System</option>
   <option value="light">Light</option>
   <option value="dark">Dark</option>
  </select>
 </label>;
}

export function PublicThemeControl(){
 const {pathname}=useLocation();
 const publicRoutes=['/login','/auth/callback','/select-tenant','/accept-invitation','/complete-profile','/unauthorised','/session-expired'];
 return publicRoutes.includes(pathname)?<div className="public-appearance"><ThemeControl/></div>:null;
}
