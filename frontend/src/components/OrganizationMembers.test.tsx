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
 vi.mocked(api.inviteMember).mockResolvedValue({message:'Invitation email sent.',deliveryStatus:'SENT'});open();expect(screen.queryByLabelText('Invite by email')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Invite member'}));fireEvent.change(screen.getByLabelText('Invite by email'),{target:{value:'new@example.com'}});fireEvent.click(screen.getByRole('button',{name:'Send invitation'}));await waitFor(()=>expect(api.inviteMember).toHaveBeenCalledWith({email:'new@example.com',role:'REQUESTER'}));expect(await screen.findByRole('status')).toHaveProperty('textContent','Invitation email sent.');expect(screen.queryByRole('option',{name:'PLATFORM_ADMIN'})).toBeNull();
});
it('shows failed delivery and provides a working resend action',async()=>{
 vi.mocked(api.organizationMembers).mockResolvedValue({members:[],invitations:[{id:'invite-one',email:'new@example.com',role:'REQUESTER',status:'PENDING',expiresAt:'2027-01-01T00:00:00Z',deliveryStatus:'FAILED'}]});vi.mocked(api.resendInvitation).mockResolvedValue({message:'Invitation email sent.',deliveryStatus:'SENT'});open();expect(await screen.findByText(/Email not delivered/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Resend'}));await waitFor(()=>expect(api.resendInvitation).toHaveBeenCalledWith('invite-one'));
});
it('retains entered email and role, and the modal, when delivery fails',async()=>{
 vi.mocked(api.inviteMember).mockResolvedValue({message:'Invitation saved, but email could not be delivered.',deliveryStatus:'FAILED'});open();fireEvent.click(screen.getByRole('button',{name:'Invite member'}));fireEvent.change(screen.getByLabelText('Invite by email'),{target:{value:'new@example.com'}});fireEvent.change(screen.getByLabelText(/Organisation role/),{target:{value:'SECURITY_REVIEWER'}});fireEvent.click(screen.getByRole('button',{name:'Send invitation'}));expect(await screen.findByText('Invitation saved, but email could not be delivered.')).toBeTruthy();expect(screen.getByRole('dialog')).toBeTruthy();expect((screen.getByLabelText('Invite by email') as HTMLInputElement).value).toBe('new@example.com');expect((screen.getByLabelText(/Organisation role/) as HTMLSelectElement).value).toBe('SECURITY_REVIEWER');
});
it('requires confirmation to discard an unsent invitation',()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);open();fireEvent.click(screen.getByRole('button',{name:'Invite member'}));fireEvent.change(screen.getByLabelText('Invite by email'),{target:{value:'unsent@example.com'}});fireEvent.keyDown(document,{key:'Escape'});expect(confirm).toHaveBeenCalled();expect(screen.getByRole('dialog')).toBeTruthy();confirm.mockRestore();
});
it('keeps loading visible and prevents duplicate invitation submissions',async()=>{
 let finish!:(value:{message:string;deliveryStatus:string})=>void;vi.mocked(api.inviteMember).mockImplementation(()=>new Promise(resolve=>{finish=resolve}));open();fireEvent.click(screen.getByRole('button',{name:'Invite member'}));fireEvent.change(screen.getByLabelText('Invite by email'),{target:{value:'new@example.com'}});fireEvent.click(screen.getByRole('button',{name:'Send invitation'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Sending invitation…'})).toHaveProperty('disabled',true));fireEvent.click(screen.getByRole('button',{name:'Sending invitation…'}));fireEvent.keyDown(document,{key:'Escape'});expect(screen.getByRole('dialog')).toBeTruthy();expect(api.inviteMember).toHaveBeenCalledTimes(1);finish({message:'Invitation email sent.',deliveryStatus:'SENT'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
