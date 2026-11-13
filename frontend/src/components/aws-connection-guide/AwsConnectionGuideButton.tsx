import {CircleHelp} from 'lucide-react';
import {forwardRef,useEffect,useState} from 'react';
import {guideStorageKey} from './guide-content';

export const AwsConnectionGuideButton=forwardRef<HTMLButtonElement,{onOpen:()=>void;attention:boolean;userId?:string}>(({onOpen,attention,userId},ref)=>{
 const [opened,setOpened]=useState(()=>typeof localStorage!=='undefined'&&localStorage.getItem(guideStorageKey(userId))==='true');
 const [reducedMotion,setReducedMotion]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{if(typeof matchMedia==='undefined')return;const query=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReducedMotion(query.matches);query.addEventListener?.('change',update);return()=>query.removeEventListener?.('change',update)},[]);
 function open(){localStorage.setItem(guideStorageKey(userId),'true');setOpened(true);onOpen()}
 return <button ref={ref} type="button" className={`connection-guide-button ${attention&&!opened&&!reducedMotion?'needs-attention':''}`} onClick={open} title="How to connect an AWS account" aria-label="How to connect an AWS account"><CircleHelp size={17}/><span>Connection guide</span></button>;
});
AwsConnectionGuideButton.displayName='AwsConnectionGuideButton';
