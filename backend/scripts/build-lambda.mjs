import { build } from 'esbuild';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const workspaceRoot = resolve(root, '..');
const out = resolve(root, 'lambda-dist');
const packagesOut = resolve(out, 'packages');
const entries = ['api', 'provisioning', 'expiry', 'migration'];
const lambdaEngineTarget = 'rhel-openssl-3.0.x';

await rm(out, { recursive: true, force: true });
await mkdir(resolve(out, 'dist/lambda'), { recursive: true });
await mkdir(packagesOut, { recursive: true });

await Promise.all(entries.map(entry => build({
  entryPoints: [resolve(root, `src/lambda/${entry}.ts`)],
  outfile: resolve(out, `dist/lambda/${entry}.js`),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  minify: true,
  external: ['@prisma/client'],
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' }
})));

for (const entry of entries) {
  const packageRoot = resolve(packagesOut, entry);
  await mkdir(resolve(packageRoot, 'dist/lambda'), { recursive: true });
  await cp(resolve(out, `dist/lambda/${entry}.js`), resolve(packageRoot, `dist/lambda/${entry}.js`));
  await writePackageJson(packageRoot, entry === 'migration');
  await copyPrismaClientRuntime(packageRoot);

  if (entry === 'migration') {
    await copyMigrationAssets(packageRoot);
  }
}

await writeBuildManifest();

async function writePackageJson(packageRoot, includePrismaCli) {
  await writeFile(resolve(packageRoot, 'package.json'), JSON.stringify({
    type: 'module',
    dependencies: includePrismaCli
      ? { '@prisma/client': '6.19.3', prisma: '6.19.3' }
      : { '@prisma/client': '6.19.3' }
  }, null, 2));
}

async function copyPrismaClientRuntime(packageRoot) {
  const generatedClient = resolve(workspaceRoot, 'node_modules/.prisma/client');
  const prismaClientPackage = resolve(workspaceRoot, 'node_modules/@prisma/client');
  const targetGenerated = resolve(packageRoot, 'node_modules/.prisma/client');
  const targetClient = resolve(packageRoot, 'node_modules/@prisma/client');

  if (!existsSync(generatedClient)) {
    throw new Error('Generated Prisma client is missing. Run `npm run prisma:generate --workspace backend` first.');
  }
  if (!existsSync(prismaClientPackage)) {
    throw new Error('@prisma/client package is missing. Run `npm ci` first.');
  }

  await mkdir(targetGenerated, { recursive: true });
  await mkdir(resolve(targetClient, 'runtime'), { recursive: true });

  for (const file of ['index.js', 'default.js', 'client.js', 'package.json', 'schema.prisma']) {
    await copyIfExists(resolve(generatedClient, file), resolve(targetGenerated, file));
  }

  await copyMatching(generatedClient, targetGenerated, file => (
    file.includes(lambdaEngineTarget)
  ));

  for (const file of ['index.js', 'default.js', 'package.json', 'runtime/library.js']) {
    await copyIfExists(resolve(prismaClientPackage, file), resolve(targetClient, file));
  }
}

async function copyMigrationAssets(packageRoot) {
  await cp(resolve(root, 'prisma'), resolve(packageRoot, 'prisma'), {
    recursive: true,
    filter: source => !shouldExcludeFromLambda(source)
  });

  const prismaCliPackage = resolve(workspaceRoot, 'node_modules/prisma');
  const targetPrismaCli = resolve(packageRoot, 'node_modules/prisma');
  if (!existsSync(prismaCliPackage)) {
    throw new Error('Prisma CLI package is missing. Run `npm ci` first.');
  }

  await mkdir(targetPrismaCli, { recursive: true });
  await copyIfExists(resolve(prismaCliPackage, 'package.json'), resolve(targetPrismaCli, 'package.json'));
  await copyIfExists(resolve(prismaCliPackage, 'build'), resolve(targetPrismaCli, 'build'));

  const prismaEnginesPackage = resolve(workspaceRoot, 'node_modules/@prisma/engines');
  const targetEngines = resolve(packageRoot, 'node_modules/@prisma/engines');
  if (existsSync(prismaEnginesPackage)) {
    await mkdir(targetEngines, { recursive: true });
    await copyIfExists(resolve(prismaEnginesPackage, 'package.json'), resolve(targetEngines, 'package.json'));
    await copyMatching(prismaEnginesPackage, targetEngines, file => (
      file.includes(lambdaEngineTarget) ||
      file === 'dist/index.js' ||
      file === 'dist/index.d.ts' ||
      file === 'scripts/postinstall.js'
    ));
  }
}

async function copyMatching(sourceRoot, targetRoot, predicate) {
  if (!existsSync(sourceRoot)) return;
  for (const source of await walk(sourceRoot)) {
    const relative = source.slice(sourceRoot.length + 1);
    const normalisedRelative = relative.replaceAll('\\', '/');
    if (!predicate(normalisedRelative)) continue;
    await copyIfExists(source, resolve(targetRoot, relative));
  }
}

async function copyIfExists(source, target) {
  if (!existsSync(source)) return;
  await mkdir(dirname(target), { recursive: true });
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await cp(source, target, {
      recursive: true,
      filter: file => !shouldExcludeFromLambda(file)
    });
    return;
  }
  if (shouldExcludeFromLambda(source)) return;
  await cp(source, target);
}

async function walk(rootDir) {
  const results = [];
  const items = await readdir(rootDir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = join(rootDir, item.name);
    if (shouldExcludeFromLambda(fullPath)) continue;
    if (item.isDirectory()) {
      results.push(...await walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function shouldExcludeFromLambda(file) {
  const normalised = file.replaceAll('\\', '/');
  const extension = extname(file);
  return (
    extension === '.map' ||
    extension === '.ts' ||
    normalised.includes('/node_modules/.cache/') ||
    normalised.includes('/.cache/') ||
    normalised.includes('/tests/') ||
    normalised.includes('/test/') ||
    normalised.includes('/__tests__/') ||
    normalised.includes('query_engine-windows') ||
    normalised.includes('schema-engine-windows') ||
    normalised.includes('prisma-fmt-windows')
  );
}

async function writeBuildManifest() {
  const manifest = {};
  for (const entry of entries) {
    const packageRoot = resolve(packagesOut, entry);
    const files = await walk(packageRoot);
    let bytes = 0;
    for (const file of files) bytes += (await stat(file)).size;
    manifest[entry] = { files: files.length, uncompressedBytes: bytes };
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
}
