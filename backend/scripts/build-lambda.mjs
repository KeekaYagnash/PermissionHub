import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'lambda-dist');

await rm(out, { recursive: true, force: true });
await mkdir(resolve(out, 'dist/lambda'), { recursive: true });

const entries = ['api', 'provisioning', 'expiry', 'migration'];
await Promise.all(entries.map(entry => build({
  entryPoints: [resolve(root, `src/lambda/${entry}.ts`)],
  outfile: resolve(out, `dist/lambda/${entry}.js`),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: ['@prisma/client'],
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' }
})));

await cp(resolve(root, 'prisma'), resolve(out, 'prisma'), { recursive: true });
await cp(resolve(root, 'package.json'), resolve(out, 'package.json'));
await writeFile(resolve(out, 'package.json'), JSON.stringify({
  type: 'module',
  dependencies: {
    '@prisma/client': '6.12.0',
    prisma: '6.12.0'
  }
}, null, 2));

const prismaClient = resolve(root, '..', 'node_modules/.prisma');
const prismaPackage = resolve(root, '..', 'node_modules/@prisma/client');
const prismaCli = resolve(root, '..', 'node_modules/prisma');
const prismaPackages = resolve(root, '..', 'node_modules/@prisma');
if (existsSync(prismaClient)) await cp(prismaClient, resolve(out, 'node_modules/.prisma'), { recursive: true });
if (existsSync(prismaPackage)) await cp(prismaPackage, resolve(out, 'node_modules/@prisma/client'), { recursive: true });
if (existsSync(prismaCli)) await cp(prismaCli, resolve(out, 'node_modules/prisma'), { recursive: true });
if (existsSync(prismaPackages)) await cp(prismaPackages, resolve(out, 'node_modules/@prisma'), { recursive: true });
