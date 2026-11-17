/** Same-origin, live-tab handoff only. No tokens are written to localStorage. */
const tokenKey='permissionhub.cognito.tokens';
type SessionMessage={type:'REQUEST'|'SESSION'|'CLEAR';requestId?:string;tokens?:string};
let channel:BroadcastChannel|undefined,pending:((available:boolean)=>void)[]=[];
export function startSessionChannel(){
 if(channel||typeof window==='undefined'||!('BroadcastChannel' in window))return;
 channel=new window.BroadcastChannel('permissionhub.auth.session');
 channel.onmessage=(event:MessageEvent<SessionMessage>)=>{
  const message=event.data;if(!message||typeof message!=='object')return;
  if(message.type==='REQUEST'){const tokens=sessionStorage.getItem(tokenKey);if(tokens)channel?.postMessage({type:'SESSION',requestId:message.requestId,tokens});}
  if(message.type==='SESSION'&&typeof message.tokens==='string'){
   if(!sessionStorage.getItem(tokenKey)&&pending.length===0)return; // Ignore delayed handoffs after sign-out.
   try{const value=JSON.parse(message.tokens) as {id_token?:string;access_token?:string;refresh_token?:string};if(!value.id_token&&!value.access_token)return;sessionStorage.setItem(tokenKey,message.tokens);pending.splice(0).forEach(resolve=>resolve(true));}catch{/* Invalid handoffs never establish a session. */}
  }
  if(message.type==='CLEAR'){sessionStorage.removeItem(tokenKey);pending.splice(0).forEach(resolve=>resolve(false));window.dispatchEvent(new Event('permissionhub:session-cleared'));}
 };
}
export function shareSession(){startSessionChannel();const tokens=sessionStorage.getItem(tokenKey);if(tokens)channel?.postMessage({type:'SESSION',tokens});}
export function shareSignOut(){startSessionChannel();channel?.postMessage({type:'CLEAR'});}
export async function receiveSession(){
 startSessionChannel();if(sessionStorage.getItem(tokenKey))return true;if(!channel)return false;
 return new Promise<boolean>(resolve=>{const finish=(value:boolean)=>{clearTimeout(timer);pending=pending.filter(item=>item!==finish);resolve(value)};const timer=window.setTimeout(()=>finish(false),500);pending.push(finish);channel!.postMessage({type:'REQUEST',requestId:crypto.randomUUID()});});
}
