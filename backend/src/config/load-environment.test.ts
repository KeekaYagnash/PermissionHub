import {describe,expect,it} from 'vitest';
import {resolve} from 'node:path';
import {resolveBackendRoot} from './load-environment.js';

describe('environment file root resolution',()=>{
 it('uses the backend directory when running TypeScript source',()=>{const backend=resolve('C:/workspace/PermissionHub/backend');expect(resolveBackendRoot(resolve(backend,'src/config'))).toBe(backend)});
 it('escapes the dist directory when running the compiled API',()=>{const backend=resolve('C:/workspace/PermissionHub/backend');expect(resolveBackendRoot(resolve(backend,'dist/src/config'))).toBe(backend)});
});
