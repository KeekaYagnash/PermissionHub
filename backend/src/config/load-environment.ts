import { config } from 'dotenv';
import { basename,dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory=dirname(fileURLToPath(import.meta.url));
export function resolveBackendRoot(directory:string){const candidateRoot=resolve(directory,'../..');return basename(candidateRoot)==='dist'?resolve(candidateRoot,'..'):candidateRoot}
const backendRoot=resolveBackendRoot(configDirectory);
const workspaceRoot=resolve(backendRoot,'..');

// API and maintenance commands intentionally use the same deterministic files.
// Existing process environment variables always take precedence.
for(const path of [resolve(workspaceRoot,'.env'),resolve(workspaceRoot,'.env.local'),resolve(backendRoot,'.env'),resolve(backendRoot,'.env.local')])config({path,override:false,quiet:true});
