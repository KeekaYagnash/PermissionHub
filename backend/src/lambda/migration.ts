import { bootstrapLambdaEnvironment } from './bootstrap.js';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function handler() {
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
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [prismaCli, 'migrate', 'deploy', '--schema', schemaPath],
    {
      cwd: taskRoot,
      env: process.env,
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    }
  );

  return {
    ok: true,
    message: 'Prisma migrations applied.',
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
