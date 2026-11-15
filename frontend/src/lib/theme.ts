import { useEffect,useSyncExternalStore } from 'react';
import type { ThemePreference } from './iam';

const key='permissionhub.theme';
const changeEvent='permissionhub:theme-change';
let unavailableStoragePreference:ThemePreference|undefined;

export function applyThemePreference(preference:ThemePreference){
 const resolved=preference==='dark'?'dark':'light';
 document.documentElement.dataset.theme=resolved;
 document.documentElement.style.colorScheme=resolved;
}

export function readThemePreference():ThemePreference{
 if(unavailableStoragePreference)return unavailableStoragePreference;
 try{
  const stored=localStorage.getItem(key);
  return stored==='dark'?'dark':'light';
 }catch{return 'light'}
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
 const preference=useSyncExternalStore(subscribe,readThemePreference,()=> 'light' as ThemePreference);
 useEffect(()=>{applyThemePreference(preference)},[preference]);
 return {preference,setPreference:setThemePreference};
}
