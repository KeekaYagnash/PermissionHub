import './load-environment.js';
import { z } from 'zod';

const schema=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 PORT:z.coerce.number().default(4000),
 DATABASE_URL:z.string().default('postgresql://permissionhub:permissionhub@localhost:5432/permissionhub'),
 REDIS_URL:z.string().default('redis://localhost:6379'),
 AUTH_ENABLED:z.string().transform(v=>v==='true').default(true),
 ENABLE_DEV_AUTH:z.string().optional().transform(value=>value===undefined||value.trim()===''?process.env.NODE_ENV!=='production':value==='true'),
 DEV_AUTH_USER_ID:z.string().optional(),
 AWS_CONNECTION_MODE:z.enum(['manual','organisation','hybrid']).default('manual'),
 ENABLE_AWS_DEMO_DATA:z.string().optional().transform(value=>value==='true').default(false),
 MULTI_TENANT_ENABLED:z.string().transform(v=>v==='true').default(true),
 SESSION_SECRET:z.string().min(32).default('development-only-session-secret-change-me'),
 SESSION_COOKIE_NAME:z.string().default('permissionhub.sid'),
 SESSION_MAX_AGE_MINUTES:z.coerce.number().int().min(5).max(1440).default(480),
 FRONTEND_URL:z.string().default('http://localhost:5173'),
 AWS_REGION:z.string().default('af-south-1'),
 AWS_ORGANISATIONS_REGION:z.string().default('us-east-1'),
 AWS_BASE_ROLE_ARN:z.string().optional(),
 AWS_BASE_EXTERNAL_ID_SECRET_REFERENCE:z.string().optional(),
 AWS_ASSUME_ROLE_DURATION_SECONDS:z.coerce.number().int().min(900).max(3600).default(900),
 AWS_READ_ROLE_NAME:z.string().default('PermissionHubReadRole'),
 AWS_PROVISION_ROLE_NAME:z.string().default('PermissionHubProvisionRole'),
 AWS_ROLE_SESSION_PREFIX:z.string().default('PermissionHub'),
 AWS_ROLE_CACHE_TTL_SECONDS:z.coerce.number().int().min(60).max(3600).default(600),
 AWS_DISCOVERY_CACHE_TTL_SECONDS:z.coerce.number().int().min(30).max(86400).default(300),
 AWS_SECRETS_MANAGER_PREFIX:z.string().default('/permissionhub/connections'),
 AWS_DEV_SECRET_PREFIX:z.string().default('PERMISSIONHUB_CONNECTION_SECRET_'),
 IDENTITY_CENTER_INSTANCE_ARN:z.string().optional(),
 IDENTITY_STORE_ID:z.string().optional(),
 AWS_ACCOUNT_ID:z.string().default('000000000000'),
 AWS_LIVE_MODE:z.enum(['auto','true','false']).default('auto'),
 PROVISIONING_MODE:z.enum(['MOCK','SIMULATE','LIVE']).default('MOCK'),
 AWS_PROVISIONING_MODE:z.enum(['disabled','dry-run','live']).default('disabled'),
 ENABLE_LIVE_PROVISIONING:z.string().transform(v=>v==='true').default(false),
 PROVISIONING_CONFIRMATION:z.string().default(''),
 SES_FROM_EMAIL:z.string().default('access@permissionhub.local')
 ,ENABLE_RUNTIME_DEBUG:z.string().optional().transform(value=>value==='true').default(false)
 ,BUILD_COMMIT:z.string().default('development')
 ,AWS_ORGANISATIONS_DISCOVERY_ENABLED:z.string().transform(v=>v==='true').default(false)
 ,IDENTITY_CENTER_ENABLED:z.string().transform(v=>v==='true').default(false)
 ,CROSS_ACCOUNT_PROVISIONING_ENABLED:z.string().transform(v=>v==='true').default(false)
 ,ALLOW_DEV_SELF_APPROVAL:z.string().optional().transform(value=>value==='true').default(false)
 ,ALLOW_LOCAL_PROVISIONING:z.string().optional().transform(value=>value==='true').default(false)
 ,AWS_LIVE_TEST_ALLOWED_PRINCIPALS:z.string().default('')
 ,EXPIRY_REVOCATION_MODE:z.enum(['disabled','manual','worker']).default('disabled')
 ,AWS_ROLE_SESSION_DURATION_SECONDS:z.coerce.number().int().min(900).max(3600).optional()
});
export const env=schema.parse(process.env);
process.env.DATABASE_URL=env.DATABASE_URL;
if(env.NODE_ENV==='production'&&env.ENABLE_DEV_AUTH)throw new Error('ENABLE_DEV_AUTH must never be enabled in production.');
if(env.NODE_ENV==='production'&&env.ALLOW_LOCAL_PROVISIONING)throw new Error('ALLOW_LOCAL_PROVISIONING must never be enabled in production.');
if(env.NODE_ENV==='production'&&env.AWS_CONNECTION_MODE==='manual'&&env.ENABLE_AWS_DEMO_DATA)throw new Error('AWS demo data must not be enabled in production manual mode.');
if(env.NODE_ENV==='production'&&env.SESSION_SECRET.startsWith('development-only'))throw new Error('SESSION_SECRET must be configured in production.');
export const liveProvisioningEnabled=env.AWS_PROVISIONING_MODE==='live'&&env.ENABLE_LIVE_PROVISIONING&&env.CROSS_ACCOUNT_PROVISIONING_ENABLED&&env.PROVISIONING_CONFIRMATION==='I_UNDERSTAND_THIS_CHANGES_AWS';
export const isLocalProvisioningEnabled=()=>env.NODE_ENV==='development'&&env.ALLOW_LOCAL_PROVISIONING;
export const liveTestAllowedPrincipals=env.AWS_LIVE_TEST_ALLOWED_PRINCIPALS.split(',').map(value=>value.trim()).filter(Boolean);
