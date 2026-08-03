import { useEffect,useState } from 'react';
import type { ThemePreference } from './iam';

const key='permissionhub.theme';

export function applyThemePreference(preference:ThemePreference){
 const systemDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
 const resolved=preference==='system'?(systemDark?'dark':'light'):preference;
 document.documentElement.dataset.theme=resolved;
 document.documentElement.style.colorScheme=resolved;
}

export function readThemePreference():ThemePreference{
 const stored=localStorage.getItem(key);
 return stored==='light'||stored==='dark'||stored==='system'?stored:'system';
}

export function useThemePreference(){
 const [preference,setPreferenceState]=useState<ThemePreference>(()=>readThemePreference());
 useEffect(()=>{applyThemePreference(preference);localStorage.setItem(key,preference)},[preference]);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const listener=()=>preference==='system'&&applyThemePreference('system');media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener)},[preference]);
 return {preference,setPreference:setPreferenceState};
}
