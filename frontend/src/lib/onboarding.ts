import type {AuthSession} from '../types';
export function onboardingDestination(session:AuthSession){if(!session.authenticated)return '/login';if(session.profileRequired)return '/complete-profile';if(sessionStorage.getItem('permissionhub.invitation'))return '/accept-invitation';return session.user?.activeTenantId?'/':'/select-tenant'}
