import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const runner=vi.hoisted(()=>vi.fn());
vi.mock('./bootstrap.js',()=>({bootstrapLambdaEnvironment:vi.fn().mockResolvedValue(undefined)}));
vi.mock('node:util',()=>({promisify:()=>runner}));
vi.mock('node:fs',()=>({existsSync:()=>true}));
import {handler} from './migration.js';
beforeEach(()=>{vi.stubEnv('DATABASE_MIGRATION_MODE','migrate');runner.mockReset();runner.mockResolvedValue({stdout:'Migration check complete',stderr:''})});
afterEach(()=>vi.unstubAllEnvs());
describe('controlled migration Lambda',()=>{
 it('uses migrate deploy, never schema push or accept-data-loss',async()=>{
  expect(await handler({action:'migrate'})).toMatchObject({ok:true,mode:'migrate'});
  expect(runner.mock.calls[0]![1]).toEqual(expect.arrayContaining(['migrate','deploy']));
  expect(runner.mock.calls[0]![1]).not.toContain('--accept-data-loss');
 });
 it('checks migration status without applying changes',async()=>{
  expect(await handler({action:'status'})).toMatchObject({ok:true,mode:'status',upToDate:true});
  expect(runner.mock.calls[0]![1]).toEqual(expect.arrayContaining(['migrate','status']));
  expect(runner.mock.calls[0]![1]).not.toContain('deploy');
 });
 it('blocks deployment for pending, divergent or unavailable migration history',async()=>{
  runner.mockRejectedValue(new Error('status exited 1'));
  expect(await handler({action:'status'})).toMatchObject({ok:false,upToDate:false});
 });
 it('rejects the legacy destructive mode without starting Prisma',async()=>{
  vi.stubEnv('DATABASE_MIGRATION_MODE','push');
  await expect(handler()).rejects.toThrow('Unsafe schema push is disabled');
  expect(runner).not.toHaveBeenCalled();
 });
});
