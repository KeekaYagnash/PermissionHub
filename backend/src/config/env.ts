import 'dotenv/config';
import { z } from 'zod';

const schema=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 PORT:z.coerce.number().default(4000),
 DATABASE_URL:z.string().default('postgresql://permissionhub:permissionhub@localhost:5432/permissionhub'),
 REDIS_URL:z.string().default('redis://localhost:6379'),
 JWT_SECRET:z.string().min(16).default('development-secret-change-before-production'),
 JWT_EXPIRES_IN:z.string().default('8h'),
 FRONTEND_URL:z.string().default('http://localhost:5173'),
 AWS_REGION:z.string().default('af-south-1'),
 AWS_ACCOUNT_ID:z.string().default('000000000000'),
 AWS_LIVE_MODE:z.enum(['auto','true','false']).default('auto'),
 PROVISIONING_MODE:z.enum(['MOCK','SIMULATE','LIVE']).default('MOCK'),
 ENABLE_LIVE_PROVISIONING:z.string().transform(v=>v==='true').default(false),
 PROVISIONING_CONFIRMATION:z.string().default(''),
 SES_FROM_EMAIL:z.string().default('access@permissionhub.local')
});
export const env=schema.parse(process.env);
export const liveProvisioningEnabled=env.PROVISIONING_MODE==='LIVE'&&env.ENABLE_LIVE_PROVISIONING&&env.PROVISIONING_CONFIRMATION==='I_UNDERSTAND_THIS_CHANGES_AWS';
