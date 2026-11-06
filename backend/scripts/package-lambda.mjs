// Shared cross-platform packager used by CI and the existing PowerShell wrapper.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
const root=resolve(import.meta.dirname,'../..'),out=resolve(root,'artifacts');
const functions={api:'api',provisioning:'provisioning',expiry:'expiry',migration:'db-migration'};
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isSymbolicLink())throw Error(`Symlinks are not allowed: ${path}`);if(entry.isDirectory())result.push(...await files(path));else result.push(path)}return result.sort()}
await mkdir(out,{recursive:true});const manifest={};
for(const [name,suffix] of Object.entries(functions)){
 const base=resolve(root,'backend/lambda-dist/packages',name),paths=await files(base),local=[],central=[];let offset=0,total=0;
 const expected=`dist/lambda/${name}.js`,names=paths.map(path=>relative(base,path).replaceAll('\\','/'));
 if(!names.includes(expected)||names.some(path=>/^dist\/lambda\/.*\.js$/.test(path)&&path!==expected))throw Error(`Invalid handler layout for ${name}`);
 const handler=await import(pathToFileURL(resolve(base,expected)).href);
 if(typeof handler.handler!=='function')throw Error(`Missing handler export: ${name}`);
 for(let index=0;index<paths.length;index++){
  const path=paths[index],filename=Buffer.from(names[index]),data=await readFile(path),compressed=deflateRawSync(data,{level:9}),crc=crc32(data);
  total+=data.length;if(total>=150*1024*1024)throw Error(`${name} exceeds the 150 MiB safety budget (Lambda limit: 250 MiB)`);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
  local.push(header,filename,compressed);
  const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(0x314,4);header.copy(directory,6,4,30);directory.writeUInt32LE(((names[index].includes('schema-engine-')?0o100755:0o100644)<<16)>>>0,38);directory.writeUInt32LE(offset,42);central.push(directory,filename);offset+=header.length+filename.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(paths.length,8);end.writeUInt16LE(paths.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 const zip=Buffer.concat([...local,directory,end]),digest=createHash('sha256').update(zip).digest(),file=`permissionhub-${suffix}-demo.zip`;
 await writeFile(resolve(out,file),zip);manifest[name]={file,handler:expected.replace('.js','.handler'),sha256:digest.toString('hex'),sourceHash:digest.toString('base64'),key:`lambda/${name}/${digest.toString('hex')}.zip`,uncompressedBytes:total,zipBytes:zip.length,files:paths.length};
 console.log(`${name}: ${zip.length} ZIP bytes; ${total} uncompressed bytes; ${manifest[name].handler}`);
}
await writeFile(resolve(out,'lambda-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
