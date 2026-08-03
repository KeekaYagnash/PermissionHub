import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma,redis } from './config/database.js';
const server=createServer(app);
server.listen(env.PORT,()=>logger.info({port:env.PORT,provisioningMode:env.PROVISIONING_MODE,docs:`http://localhost:${env.PORT}/api/docs`},'PermissionHub API ready'));
async function shutdown(signal:string){logger.info({signal},'Graceful shutdown started');server.close(async()=>{await Promise.allSettled([prisma.$disconnect(),redis.quit()]);process.exit(0)});setTimeout(()=>process.exit(1),10_000).unref()}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));process.on('unhandledRejection',reason=>logger.error({reason},'Unhandled rejection'));
