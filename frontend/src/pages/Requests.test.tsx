// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Requests from './Requests';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
import type {PermissionRequest,Page} from '../types';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{requests:vi.fn()}}));
const row=(id:string,status:PermissionRequest['status']='Pending approval'):PermissionRequest=>({id,title:`Access ${id}`,status,requester:'Test requester',approver:'Approver',targetName:'Target',targetArn:'arn:aws:iam::123456789012:user/Target',targetType:'USER',items:[],scope:{type:'ALL',resources:[]},duration:'7 days',startDate:new Date().toISOString(),priority:'Normal',justification:'Access for a test support task.',createdAt:new Date().toISOString(),timeline:[]});
const page=(data:PermissionRequest[],number=1,total=1):Page<PermissionRequest>=>({data,pagination:{page:number,pageSize:100,total:data.length,totalPages:total}});
beforeEach(()=>{vi.resetAllMocks();useAuthStore.setState({session:{authenticated:true,authProvider:'test',devAuthAvailable:false,user:{id:'reviewer',email:'reviewer@example.invalid',displayName:'Reviewer',provider:'test',providerSubject:'reviewer',activeTenantId:'tenant',memberships:[],permissions:['REQUEST_REVIEW']}}})});
afterEach(()=>{cleanup();useAuthStore.getState().clear()});
function open(){return render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Requests/></QueryClientProvider></MemoryRouter>)}
it('keeps approved and failed requests visible in the default reviewer All view',async()=>{
 vi.mocked(api.requests).mockResolvedValue(page([row('TES-PR-1001','Approved'),row('TES-PR-1002','Provisioning failed')]));open();expect((await screen.findAllByText('TES-PR-1001')).length).toBeGreaterThan(0);expect(screen.getAllByText('TES-PR-1002').length).toBeGreaterThan(0);
});
it('renders the first page before background pagination completes and passes cancellation signals',async()=>{
 let finish!:(value:Page<PermissionRequest>)=>void;vi.mocked(api.requests).mockResolvedValueOnce(page([row('TES-PR-1001')],1,2)).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));open();expect((await screen.findAllByText('TES-PR-1001')).length).toBeGreaterThan(0);await waitFor(()=>expect(api.requests).toHaveBeenCalledTimes(2));expect(api.requests).toHaveBeenNthCalledWith(2,{page:2},expect.any(AbortSignal));finish(page([row('TES-PR-1002')],2,2));expect((await screen.findAllByText('TES-PR-1002')).length).toBeGreaterThan(0);
});
