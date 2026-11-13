// @vitest-environment jsdom
import {afterEach,it,expect} from 'vitest';
import {onboardingDestination} from './onboarding';
import type {AuthSession} from '../types';
afterEach(()=>sessionStorage.clear());
it('preserves invitation through profile completion without granting membership on sign-in',()=>{
 const session:AuthSession={authenticated:true,authProvider:'cognito',devAuthAvailable:false,profileRequired:true};sessionStorage.setItem('permissionhub.invitation','fake-pending-proof');expect(onboardingDestination(session)).toBe('/complete-profile');expect(onboardingDestination({...session,profileRequired:false})).toBe('/accept-invitation');sessionStorage.clear();expect(onboardingDestination({...session,profileRequired:false})).toBe('/select-tenant');expect(onboardingDestination({...session,authenticated:false})).toBe('/login');
});
