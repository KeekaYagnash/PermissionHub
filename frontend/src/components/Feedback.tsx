import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,AlertTriangle,Loader2,X} from 'lucide-react';
import {feedback,useFeedbackStore,type Feedback} from '../store/feedback';

export function FeedbackCenter(){const items=useFeedbackStore(state=>state.items);return <section className="feedback-center" aria-label="Notifications">{items.map(item=><Toast key={`${item.id}:${item.revision}`} item={item}/>)}</section>}
function Toast({item}:{item:Feedback}){
 const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),remaining=useRef(5000);
 useEffect(()=>{if(hovered||focused||item.tone==='loading')return;const start=Date.now(),timer=window.setTimeout(()=>feedback.dismiss(item.id),remaining.current);return()=>{window.clearTimeout(timer);remaining.current=Math.max(0,remaining.current-(Date.now()-start))}},[hovered,focused,item.id,item.tone]);
 const Icon=item.tone==='loading'?Loader2:item.tone==='success'?CheckCircle2:AlertTriangle;
 return <div className={`feedback-toast ${item.tone}`} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFocused(false)}}><div role={item.tone==='error'?'alert':'status'} aria-live={item.tone==='error'?'assertive':'polite'} aria-atomic="true"><Icon size={18} aria-hidden="true"/><span>{item.message}</span></div><button className="icon-btn" aria-label="Dismiss notification" onClick={()=>feedback.dismiss(item.id)}><X size={16}/></button></div>;
}

/** Persistent feedback for async flows outside React Query (including Cognito). */
export function usePendingFeedback(pending:boolean,label:string,sharedId?:string){const id=useRef(`pending-${crypto.randomUUID()}`);useEffect(()=>{const key=sharedId??id.current;if(pending)feedback.show(key,label,'loading');else feedback.dismiss(key);return()=>feedback.dismiss(key)},[pending,label,sharedId]);}
