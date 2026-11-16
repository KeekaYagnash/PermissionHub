import {create} from 'zustand';

export type FeedbackTone='success'|'warning'|'error'|'loading';
export interface Feedback {id:string;message:string;tone:FeedbackTone;revision:number}
export const useFeedbackStore=create<{items:Feedback[]}>()(()=>({items:[]}));
export const feedback={
 show(id:string,message:string,tone:FeedbackTone){useFeedbackStore.setState(state=>({items:[...state.items.filter(item=>item.id!==id),{id,message,tone,revision:Date.now()}]}));},
 dismiss(id:string){useFeedbackStore.setState(state=>({items:state.items.filter(item=>item.id!==id)}));}
};
