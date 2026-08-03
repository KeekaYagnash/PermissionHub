import pino from 'pino';
import { env } from './env.js';
export const logger=pino({level:env.NODE_ENV==='production'?'info':'debug',redact:{paths:['req.headers.authorization','req.headers.cookie','req.headers.x-csrf-token','res.headers.set-cookie','password','passwordHash','token','accessToken','refreshToken','clientSecret','secretAccessKey','sessionToken','externalId','ExternalId'],censor:'[redacted]'}});
