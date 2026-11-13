import { bootstrapLambdaEnvironment } from './bootstrap.js';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function handler(event?: {action?:'status'|'migrate'}) {
  await bootstrapLambdaEnvironment();
  const taskRoot = process.env.LAMBDA_TASK_ROOT || process.cwd();
  const prismaCli = resolve(taskRoot, 'node_modules/prisma/build/index.js');
  const schemaPath = resolve(taskRoot, 'prisma/schema.prisma');

  if (!existsSync(prismaCli)) {
    throw new Error('Prisma CLI is missing from the Lambda deployment artifact.');
  }
  if (!existsSync(schemaPath)) {
    throw new Error('Prisma schema is missing from the Lambda deployment artifact.');
  }

  const startedAt = Date.now();
  if(process.env.DATABASE_MIGRATION_MODE==='push')throw new Error('Unsafe schema push is disabled. Review/baseline the existing database and configure DATABASE_MIGRATION_MODE=migrate.');
  const migrationMode = event?.action==='status'?'status':'migrate';
  const prismaArgs = [prismaCli, 'migrate', migrationMode==='status'?'status':'deploy', '--schema', schemaPath];
  let stdout='',stderr='';
  try { ({stdout,stderr}=await execFileAsync(
    process.execPath,
    prismaArgs,
    {
      cwd: taskRoot,
      env: process.env,
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    }
  )); } catch(error:unknown) {
    if(migrationMode==='status')return {ok:false,mode:'status',upToDate:false,message:'Migration status requires review. Deployment is blocked until migration history and connectivity are verified.'};
    throw error;
  }

  return {
    ok: true,
    mode: migrationMode,
    upToDate: true,
    message: migrationMode==='status'?'Migration history is up to date.':'Prisma migrations applied.',
    durationMs: Date.now() - startedAt,
    stdout: trimOutput(stdout),
    stderr: trimOutput(stderr)
  };
}

function trimOutput(value: string) {
  return value
    .split('\n')
    .map(line => line.trimEnd())
    .filter(Boolean)
    .slice(-50)
    .join('\n');
}
