import { create } from 'zustand';
import type { AuthSession } from '../types';
import { setCsrfToken } from '../lib/api';

type AuthState={session?:AuthSession;loading:boolean;setSession:(session:AuthSession)=>void;setLoading:(loading:boolean)=>void;clear:()=>void};
export const useAuthStore=create<AuthState>(set=>({loading:true,setSession:session=>{setCsrfToken(session.csrfToken);set({session,loading:false})},setLoading:loading=>set({loading}),clear:()=>{setCsrfToken('');set({session:undefined,loading:false})}}));
