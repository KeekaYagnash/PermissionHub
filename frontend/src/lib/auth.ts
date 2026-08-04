import type { AppContext,AuthSession } from '../types';
export function authenticatedLanding(session:AuthSession){if(!session.authenticated)return '/login';return session.user?.activeTenantId?'/':'/select-tenant'}
export function shouldAutoSelectAccount(context?:AppContext){return Boolean(context&&!context.activeAccountId&&context.accounts.length===1&&['CONNECTED','DEGRADED'].includes(context.accounts[0]!.connectionStatus))}
export function hasTenantRole(session:AuthSession|undefined,role:string){return Boolean(session?.user?.memberships.some(membership=>membership.tenantId===session.user?.activeTenantId&&membership.status==='ACTIVE'&&membership.role===role))}
