import {Check,Clipboard} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';

export function CopyButton({value,label='Copy'}:{value:string;label?:string}){
 const [copied,setCopied]=useState(false),timer=useRef<number|undefined>(undefined);
 useEffect(()=>()=>window.clearTimeout(timer.current),[]);
 async function copy(){await navigator.clipboard.writeText(value);setCopied(true);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setCopied(false),2000)}
 return <button type="button" className="guide-copy" onClick={()=>void copy()} aria-label={`${label}: ${copied?'Copied':'copy to clipboard'}`}>{copied?<Check size={14}/>:<Clipboard size={14}/>} {copied?'Copied':label}<span className="sr-only" aria-live="polite">{copied?'Copied to clipboard':''}</span></button>;
}

export function PolicyCodeBlock({label,value}:{label:string;value:string}){
 return <div className="guide-code"><div><strong>{label}</strong><CopyButton value={value}/></div><pre><code>{value}</code></pre></div>;
}
