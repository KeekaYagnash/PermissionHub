import {afterEach,it,expect} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {createMutationFeedback} from './mutationFeedback';
import {useFeedbackStore} from '../store/feedback';
afterEach(()=>useFeedbackStore.setState({items:[]}));
it('retains pending feedback until the server resolves, then shows one success',async()=>{
 const cache=createMutationFeedback(),client=new QueryClient({mutationCache:cache});let finish!:(value:unknown)=>void;const task=cache.build(client,{mutationFn:()=>new Promise(resolve=>{finish=resolve})}).execute(undefined);
 await Promise.resolve();await Promise.resolve();expect(useFeedbackStore.getState().items[0]?.tone).toBe('loading');finish({saved:true});await task;expect(useFeedbackStore.getState().items).toHaveLength(1);expect(useFeedbackStore.getState().items[0]?.tone).toBe('success');client.clear();
});
it('does not show success when validation or email delivery fails',async()=>{
 for(const result of [{success:false},{deliveryStatus:'FAILED'},{validation:{success:false}}]){const cache=createMutationFeedback(),client=new QueryClient({mutationCache:cache});await cache.build(client,{mutationFn:async()=>result}).execute(undefined);expect(useFeedbackStore.getState().items.at(-1)?.tone).toBe('warning');client.clear()}
});
it('never exposes raw server error details or secrets in a toast',async()=>{
 const cache=createMutationFeedback(),client=new QueryClient({mutationCache:cache});await expect(cache.build(client,{mutationFn:async()=>{throw new Error('private-token stacktrace')}}).execute(undefined)).rejects.toThrow();expect(JSON.stringify(useFeedbackStore.getState().items)).not.toContain('private-token');expect(useFeedbackStore.getState().items[0]?.tone).toBe('error');client.clear();
});
it('waits for existing follow-up workflow callbacks before reporting success',async()=>{
 const cache=createMutationFeedback(),client=new QueryClient({mutationCache:cache});let finish!:()=>void;
 const completed=cache.build(client,{mutationFn:async()=>({created:true}),onSuccess:()=>new Promise<void>(resolve=>{finish=resolve})}).execute(undefined);
 for(let i=0;i<10&&!finish;i++)await Promise.resolve();expect(useFeedbackStore.getState().items[0]?.tone).toBe('loading');finish();await completed;expect(useFeedbackStore.getState().items[0]?.tone).toBe('success');client.clear();
});
