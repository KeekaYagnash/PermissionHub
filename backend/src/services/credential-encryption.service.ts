import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

const VERSION='v1';

function keyMaterial(){
 const configured=env.PERMISSIONHUB_CREDENTIAL_ENCRYPTION_KEY??(env.NODE_ENV==='production'?undefined:`development:${env.SESSION_SECRET}`);
 if(!configured)throw new ApiError(500,'Credential encryption is not configured on the PermissionHub backend.','CREDENTIAL_ENCRYPTION_NOT_CONFIGURED');
 return createHash('sha256').update(configured).digest();
}

export function encryptCredential(value:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keyMaterial(),iv),ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]),tag=cipher.getAuthTag();
 return [VERSION,iv.toString('base64url'),tag.toString('base64url'),ciphertext.toString('base64url')].join(':');
}

export function decryptCredential(value:string){
 const [version,iv,tag,ciphertext]=value.split(':');
 if(version!==VERSION||!iv||!tag||!ciphertext)throw new ApiError(500,'Stored credential material is malformed.','CREDENTIAL_DECRYPTION_FAILED');
 try{
  const decipher=createDecipheriv('aes-256-gcm',keyMaterial(),Buffer.from(iv,'base64url'));
  decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext,'base64url')),decipher.final()]).toString('utf8');
 }catch{
  throw new ApiError(500,'Stored credential material could not be decrypted.','CREDENTIAL_DECRYPTION_FAILED');
 }
}

export function maskAccessKeyId(value:string){
 const clean=value.trim();
 if(clean.length<=8)return '••••';
 return `${clean.slice(0,4)}••••${clean.slice(-4)}`;
}

export function buildEncryptedStaticCredentials(input:{accessKeyId:string;secretAccessKey:string;sessionToken?:string}){
 return {accessKeyIdEncrypted:encryptCredential(input.accessKeyId.trim()),secretAccessKeyEncrypted:encryptCredential(input.secretAccessKey.trim()),sessionTokenEncrypted:input.sessionToken?.trim()?encryptCredential(input.sessionToken.trim()):null,accessKeyIdMasked:maskAccessKeyId(input.accessKeyId),credentialUpdatedAt:new Date()};
}
