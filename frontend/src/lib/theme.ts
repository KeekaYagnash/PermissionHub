import { useEffect,useSyncExternalStore } from 'react';
import type { ThemePreference } from './iam';

const key='permissionhub.theme';
const changeEvent='permissionhub:theme-change';
let unavailableStoragePreference:ThemePreference|undefined;

export function applyThemePreference(preference:ThemePreference){
 const systemDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
 const resolved=preference==='system'?(systemDark?'dark':'light'):preference;
 document.documentElement.dataset.theme=resolved;
 document.documentElement.style.colorScheme=resolved;
}

export function readThemePreference():ThemePreference{
 if(unavailableStoragePreference)return unavailableStoragePreference;
 try{
  const stored=localStorage.getItem(key);
  return stored==='light'||stored==='dark'||stored==='system'?stored:'system';
 }catch{return 'system'}
}

export function setThemePreference(preference:ThemePreference){
 try{localStorage.setItem(key,preference);unavailableStoragePreference=undefined}catch{unavailableStoragePreference=preference}
 applyThemePreference(preference);
 window.dispatchEvent(new Event(changeEvent));
}

function subscribe(listener:()=>void){
 const storage=(event:StorageEvent)=>{if(event.key===key||event.key===null){unavailableStoragePreference=undefined;listener()}};
 window.addEventListener(changeEvent,listener);
 window.addEventListener('storage',storage);
 return()=>{window.removeEventListener(changeEvent,listener);window.removeEventListener('storage',storage)};
}

export function useThemePreference(){
 const preference=useSyncExternalStore(subscribe,readThemePreference,()=> 'system' as ThemePreference);
 useEffect(()=>{applyThemePreference(preference)},[preference]);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const listener=()=>preference==='system'&&applyThemePreference('system');media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener)},[preference]);
 return {preference,setPreference:setThemePreference};
}
