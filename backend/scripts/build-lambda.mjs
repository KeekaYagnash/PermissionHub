import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
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
  banner: { js: 'import { createRequire } from "node:module"; import { fileURLToPath } from "node:url"; import { dirname as __pathDirname } from "node:path"; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = __pathDirname(__filename);' }
})));

for (const entry of entries) {
  const packageRoot = resolve(packagesOut, entry);
  const includePrismaClient = entry === 'api' || entry === 'migration';
  await mkdir(resolve(packageRoot, 'dist/lambda'), { recursive: true });
  await cp(resolve(out, `dist/lambda/${entry}.js`), resolve(packageRoot, `dist/lambda/${entry}.js`));
  await writePackageJson(packageRoot, includePrismaClient, entry === 'migration');

  if (includePrismaClient) {
    await copyPrismaClientRuntime(packageRoot);
  }

  if (entry === 'migration') {
    await copyMigrationAssets(packageRoot);
  }
}

await writeBuildManifest();

async function writePackageJson(packageRoot, includePrismaClient, includePrismaCli) {
  const dependencies = {};
  if (includePrismaClient) dependencies['@prisma/client'] = '6.19.3';
  if (includePrismaCli) dependencies.prisma = '6.19.3';

  await writeFile(resolve(packageRoot, 'package.json'), JSON.stringify({
    type: 'module',
    dependencies
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

  await copyNodePackageWithDependencies('prisma', packageRoot, new Set());
  await downloadMigrationSchemaEngine(packageRoot);
}

async function copyNodePackageWithDependencies(packageName, packageRoot, copied) {
  if (copied.has(packageName)) return;
  copied.add(packageName);

  const sourcePackage = resolve(workspaceRoot, 'node_modules', packageName);
  const targetPackage = resolve(packageRoot, 'node_modules', packageName);
  if (!existsSync(sourcePackage)) {
    throw new Error(`${packageName} package is missing. Run \`npm ci\` first.`);
  }

  if (packageName === '@prisma/engines') {
    await mkdir(targetPackage, { recursive: true });
    await copyIfExists(resolve(sourcePackage, 'package.json'), resolve(targetPackage, 'package.json'));
    await copyMatching(sourcePackage, targetPackage, file => (
      file.includes(lambdaEngineTarget) ||
      file === 'dist/index.js' ||
      file === 'dist/index.d.ts' ||
      file === 'scripts/postinstall.js'
    ));
  } else {
    await copyIfExists(sourcePackage, targetPackage);
  }

  const packageJson = JSON.parse(await readFile(resolve(sourcePackage, 'package.json'), 'utf8'));
  const dependencies = Object.keys(packageJson.dependencies ?? {});
  for (const dependency of dependencies) {
    await copyNodePackageWithDependencies(dependency, packageRoot, copied);
  }
}

async function downloadMigrationSchemaEngine(packageRoot) {
  const { BinaryType, download } = require('@prisma/fetch-engine');
  const { enginesVersion } = require('@prisma/engines-version');
  const engineTargetFolder = resolve(packageRoot, 'node_modules/@prisma/engines');
  await mkdir(engineTargetFolder, { recursive: true });
  await download({
    binaries: { [BinaryType.SchemaEngineBinary]: engineTargetFolder },
    binaryTargets: [lambdaEngineTarget],
    version: enginesVersion,
    showProgress: false
  });
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
  const isPrismaProviderWasm = (
    normalised.includes('/prisma/build/query_engine_bg.') ||
    normalised.includes('/prisma/build/query_compiler_bg.')
  );

  return (
    extension === '.map' ||
    extension === '.ts' ||
    (isPrismaProviderWasm && !normalised.includes('.postgresql.')) ||
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
