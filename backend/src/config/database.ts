import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const prisma=new PrismaClient({log:env.NODE_ENV==='development'?['warn','error']:['error']});
export const redis=new Redis(env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:1,enableOfflineQueue:false});
redis.on('error',(e:Error)=>logger.debug({error:e.message},'Redis unavailable; continuing without cache'));
