// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import OrganizationMembers from './OrganizationMembers';
import {api} from '../lib/api';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{session:vi.fn(),organizationMembers:vi.fn(),inviteMember:vi.fn(),resendInvitation:vi.fn(),revokeInvitation:vi.fn(),changeMember:vi.fn(),removeMember:vi.fn()}}));
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.session).mockResolvedValue({authenticated:true,authProvider:'cognito',devAuthAvailable:false});vi.mocked(api.organizationMembers).mockResolvedValue({members:[],invitations:[]})});
afterEach(cleanup);
function open(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><OrganizationMembers/></QueryClientProvider>)}
it('invites by email without creating an active member or assigning platform administration',async()=>{
 vi.mocked(api.inviteMember).mockResolvedValue({message:'Invitation email sent.',deliveryStatus:'SENT'});open();fireEvent.change(screen.getByLabelText('Invite by email'),{target:{value:'new@example.com'}});fireEvent.click(screen.getByRole('button',{name:'Send invitation'}));await waitFor(()=>expect(api.inviteMember).toHaveBeenCalledWith({email:'new@example.com',role:'REQUESTER'}));expect(await screen.findByRole('status')).toHaveProperty('textContent','Invitation email sent.');expect(screen.queryByRole('option',{name:'PLATFORM_ADMIN'})).toBeNull();
});
it('shows failed delivery and provides a working resend action',async()=>{
 vi.mocked(api.organizationMembers).mockResolvedValue({members:[],invitations:[{id:'invite-one',email:'new@example.com',role:'REQUESTER',status:'PENDING',expiresAt:'2027-01-01T00:00:00Z',deliveryStatus:'FAILED'}]});vi.mocked(api.resendInvitation).mockResolvedValue({message:'Invitation email sent.',deliveryStatus:'SENT'});open();expect(await screen.findByText(/Email not delivered/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Resend'}));await waitFor(()=>expect(api.resendInvitation).toHaveBeenCalledWith('invite-one'));
});
