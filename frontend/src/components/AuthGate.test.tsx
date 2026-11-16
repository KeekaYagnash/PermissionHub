// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {act} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import AuthGate from './AuthGate';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{session:vi.fn()}}));
afterEach(()=>{cleanup();useAuthStore.getState().clear();vi.resetAllMocks()});
async function open(path:string,authenticated=true,profileRequired=false){useAuthStore.getState().setLoading(true);vi.mocked(api.session).mockResolvedValue({authenticated,profileRequired,authProvider:'test',devAuthAvailable:false});render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<AuthGate/>}><Route path="/administration/organizations" element={<p>Own organization inbox</p>}/><Route path="/requests" element={<p>Requests protected</p>}/></Route><Route path="/login" element={<p>Login required</p>}/><Route path="/select-tenant" element={<p>Organization required</p>}/><Route path="/complete-profile" element={<p>Profile required</p>}/></Routes></MemoryRouter>)}
it('allows signed-in invitees without memberships to review their own invitations',async()=>{await open('/administration/organizations');expect(await screen.findByText('Own organization inbox')).toBeTruthy()});
it('retains the organization prerequisite for other protected routes',async()=>{await open('/requests');expect(await screen.findByText('Organization required')).toBeTruthy();expect(screen.queryByText('Requests protected')).toBeNull()});
it('never allows unauthenticated access to organizations',async()=>{await open('/administration/organizations',false);expect(await screen.findByText('Login required')).toBeTruthy()});
it('retains profile completion for invitees',async()=>{await open('/administration/organizations',true,true);expect(await screen.findByText('Profile required')).toBeTruthy()});
it('shows an accessible spinner while the server session is pending',async()=>{
 useAuthStore.getState().setLoading(true);let finish!:(value:{authenticated:boolean;authProvider:string;devAuthAvailable:boolean})=>void;vi.mocked(api.session).mockImplementation(()=>new Promise(resolve=>{finish=resolve}));render(<MemoryRouter initialEntries={['/administration/organizations']}><Routes><Route element={<AuthGate/>}><Route path="/administration/organizations" element={<p>Own organization inbox</p>}/></Route></Routes></MemoryRouter>);const loading=screen.getByRole('status');expect(loading.getAttribute('aria-busy')).toBe('true');expect(loading.textContent).toContain('Checking your PermissionHub session');expect(loading.querySelector('.session-loading-spinner')?.getAttribute('aria-hidden')).toBe('true');await act(async()=>finish({authenticated:true,authProvider:'test',devAuthAvailable:false}));expect(await screen.findByText('Own organization inbox')).toBeTruthy();
});
