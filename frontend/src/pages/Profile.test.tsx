// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Profile from './Profile';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
vi.mock('../lib/api',()=>({setCsrfToken:vi.fn(),api:{saveProfile:vi.fn(),startIdentityLink:vi.fn()}}));
vi.mock('../lib/cognito',()=>({configuredProviders:()=>[],startCognitoLogin:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();useAuthStore.getState().clear()});
it('removes only the generic Cognito linking control and preserves profile saving',async()=>{vi.mocked(api.saveProfile).mockResolvedValue({authenticated:true,authProvider:'cognito',devAuthAvailable:false});render(<MemoryRouter><Profile/></MemoryRouter>);expect(screen.queryByRole('button',{name:'Link another Cognito sign-in'})).toBeNull();expect(screen.queryByText('Linked sign-in methods')).toBeNull();fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Updated Person'}});fireEvent.click(screen.getByRole('button',{name:'Save profile'}));await waitFor(()=>expect(api.saveProfile).toHaveBeenCalledWith('Updated Person'));expect(api.startIdentityLink).not.toHaveBeenCalled()});
