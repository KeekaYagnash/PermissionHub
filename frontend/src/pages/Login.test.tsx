// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Login from './Login';
import * as cognito from '../lib/cognito';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
vi.mock('../lib/cognito',()=>({cognitoEnabled:()=>true,ensureAccessToken:vi.fn().mockResolvedValue(''),configuredProviders:()=>[],emailNeedsVerification:()=>false,signUpWithCognito:vi.fn(),confirmCognitoSignUp:vi.fn(),signInWithCognito:vi.fn(),startCognitoPasswordReset:vi.fn(),confirmCognitoPasswordReset:vi.fn(),resendCognitoConfirmation:vi.fn(),requestEmailVerification:vi.fn(),verifyEmailAttribute:vi.fn(),startCognitoLogin:vi.fn(),completeCognitoLogin:vi.fn()}));
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{session:vi.fn(),setOrganization:vi.fn()}}));
beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();useAuthStore.getState().clear()});
afterEach(cleanup);
const open=async()=>{render(<MemoryRouter><Login/></MemoryRouter>);await screen.findByRole('button',{name:'Forgot password?'})};
it('email signup verifies email before sign-in and does not silently create an organization',async()=>{
 await open();fireEvent.click(screen.getByRole('button',{name:'Create account'}));fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'New Person'}});fireEvent.change(screen.getByLabelText('Email'),{target:{value:'new@example.com'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'Fake-password-for-tests-123!'}});fireEvent.submit(screen.getByLabelText('Full name').closest('form')!);
 expect(await screen.findByRole('heading',{name:'Verify your email'})).toBeTruthy();expect(cognito.signUpWithCognito).toHaveBeenCalledWith({email:'new@example.com',password:'Fake-password-for-tests-123!',displayName:'New Person'});fireEvent.change(screen.getByLabelText('Verification code'),{target:{value:'123456'}});fireEvent.click(screen.getByRole('button',{name:'Verify email'}));await waitFor(()=>expect(cognito.confirmCognitoSignUp).toHaveBeenCalledWith('new@example.com','123456'));expect(api.setOrganization).not.toHaveBeenCalled();
});
it('password recovery includes entering code and choosing the new password',async()=>{
 await open();fireEvent.change(screen.getByLabelText('Email'),{target:{value:'new@example.com'}});fireEvent.click(screen.getByRole('button',{name:'Forgot password?'}));await screen.findByRole('heading',{name:'Reset your password'});fireEvent.change(screen.getByLabelText('New password'),{target:{value:'New-fake-password-123!'}});fireEvent.change(screen.getByLabelText('Verification code'),{target:{value:'654321'}});fireEvent.click(screen.getByRole('button',{name:'Set new password'}));await waitFor(()=>expect(cognito.confirmCognitoPasswordReset).toHaveBeenCalledWith('new@example.com','654321','New-fake-password-123!'));
});
it('does not render unconfigured Microsoft or Google sign-in buttons',async()=>{await open();expect(screen.queryByRole('button',{name:/Microsoft|Google/})).toBeNull()});
