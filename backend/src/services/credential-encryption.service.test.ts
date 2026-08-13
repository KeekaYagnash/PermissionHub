import { describe,expect,it } from 'vitest';
import { env } from '../config/env.js';
import { decryptCredential,encryptCredential,maskAccessKeyId } from './credential-encryption.service.js';

describe('credential encryption',()=>{
 it('round trips credential material without exposing plaintext in the ciphertext',()=>{
  env.PERMISSIONHUB_CREDENTIAL_ENCRYPTION_KEY='test-encryption-key-for-access-key-connections';
  const encrypted=encryptCredential('secret-value');
  expect(encrypted).not.toContain('secret-value');
  expect(decryptCredential(encrypted)).toBe('secret-value');
 });

 it('masks access key ids for browser-safe display',()=>{
  expect(maskAccessKeyId('AKIA1234567890ABCD')).toBe('AKIA••••ABCD');
 });
});
