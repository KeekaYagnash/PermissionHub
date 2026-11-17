// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
let current:FakeChannel;
class FakeChannel {
 onmessage:((event:{data:unknown})=>void)|null=null;
 postMessage=vi.fn();
 constructor(){current=this}
}
beforeEach(()=>{vi.resetModules();sessionStorage.clear();localStorage.clear();vi.stubGlobal('BroadcastChannel',FakeChannel)});
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear()});
it('requests a live same-origin session for a new window without persisting tokens in localStorage',async()=>{
 const channel=await import('./sessionChannel');const pending=channel.receiveSession();
 expect(current.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'REQUEST'}));
 const tokens=JSON.stringify({id_token:'mock-id-token',refresh_token:'mock-refresh',expires_at:Date.now()+60000});
 current.onmessage?.({data:{type:'SESSION',tokens}});expect(await pending).toBe(true);
 expect(sessionStorage.getItem('permissionhub.cognito.tokens')).toBe(tokens);expect(localStorage.length).toBe(0);
});
it('clears the current tab and notifies the auth gate on remote logout',async()=>{
 const channel=await import('./sessionChannel');channel.startSessionChannel();sessionStorage.setItem('permissionhub.cognito.tokens','mock');
 const listener=vi.fn();window.addEventListener('permissionhub:session-cleared',listener);
 current.onmessage?.({data:{type:'CLEAR'}});expect(sessionStorage.getItem('permissionhub.cognito.tokens')).toBeNull();expect(listener).toHaveBeenCalledOnce();window.removeEventListener('permissionhub:session-cleared',listener);
 current.onmessage?.({data:{type:'SESSION',tokens:'{"id_token":"old-token"}'}});expect(sessionStorage.getItem('permissionhub.cognito.tokens')).toBeNull();
});
it('shares refreshed tokens only through the live channel and ignores malformed session payloads',async()=>{
 const channel=await import('./sessionChannel');channel.startSessionChannel();current.onmessage?.({data:{type:'SESSION',tokens:'not-json'}});expect(sessionStorage.length).toBe(0);
 sessionStorage.setItem('permissionhub.cognito.tokens','{"id_token":"mock"}');channel.shareSession();expect(current.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'SESSION'}));channel.shareSignOut();expect(current.postMessage).toHaveBeenLastCalledWith({type:'CLEAR'});
});
