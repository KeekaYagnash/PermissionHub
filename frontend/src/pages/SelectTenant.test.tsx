// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {useAuthStore} from '../store/auth';
import {api} from '../lib/api';
import SelectTenant from './SelectTenant';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{session:vi.fn(),selectTenant:vi.fn(),setOrganization:vi.fn()}}));
afterEach(()=>{cleanup();useAuthStore.getState().clear();vi.resetAllMocks()});
function open(){
 useAuthStore.getState().setSession({authenticated:true,authProvider:'cognito',devAuthAvailable:false,csrfToken:'',user:{id:'new',email:'new@example.com',displayName:'New user',provider:'cognito',providerSubject:'subject',permissions:[],memberships:[]}});
 render(<MemoryRouter><SelectTenant/></MemoryRouter>);
}
describe('organisation onboarding',()=>{
 it('offers company setup instead of an empty tenant selector',()=>{
  open();expect(screen.getByRole('heading',{name:'Set up your organisation'})).toBeTruthy();
  expect(screen.getByLabelText('Company name')).toBeTruthy();
 });
 it('retains company details and displays an actionable error when saving fails',async()=>{
  vi.mocked(api.setOrganization).mockRejectedValue(new Error('unavailable'));
  open();fireEvent.change(screen.getByLabelText('Company name'),{target:{value:'Example Company'}});
  fireEvent.click(screen.getByRole('button',{name:'Create organisation'}));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((screen.getByLabelText('Company name') as HTMLInputElement).value).toBe('Example Company');
  await waitFor(()=>expect((screen.getByRole('button',{name:'Create organisation'}) as HTMLButtonElement).disabled).toBe(false));
 });
});
