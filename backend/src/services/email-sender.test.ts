import {describe,expect,it} from 'vitest';
import {DEFAULT_EMAIL_SENDER,ALTERNATE_EMAIL_SENDER,resolveEmailSender} from './email-sender.js';
const arn=(identity:string,region='us-east-1')=>`arn:aws:ses:${region}:143671530412:identity/${identity}`;
describe('no-reply sender configuration (not live SES verification)',()=>{
 it('defaults to the requested no-reply address, including a blank setting',()=>{
  expect(DEFAULT_EMAIL_SENDER).toBe('no-reply@disraptor.co.za');expect(resolveEmailSender()).toBe(DEFAULT_EMAIL_SENDER);expect(resolveEmailSender(' ')).toBe(DEFAULT_EMAIL_SENDER);
 });
 it('accepts a matching configured domain without claiming it is verified',()=>expect(resolveEmailSender(DEFAULT_EMAIL_SENDER,arn('disraptor.co.za'))).toBe(DEFAULT_EMAIL_SENDER));
 it('accepts the no-reply alternate backed by the known existing domain',()=>expect(resolveEmailSender(ALTERNATE_EMAIL_SENDER,arn('disraptor-internal.net'))).toBe(ALTERNATE_EMAIL_SENDER));
 it('normalizes the sender consistently with its IAM From-address condition',()=>expect(resolveEmailSender(' NO-REPLY@disraptor-internal.net ',arn('disraptor-internal.net'))).toBe(ALTERNATE_EMAIL_SENDER));
 it('does not treat verification of info@ as authorization for no-reply@',()=>expect(()=>resolveEmailSender(DEFAULT_EMAIL_SENDER,arn('info@disraptor.co.za'))).toThrow(expect.objectContaining({code:'EMAIL_SENDER_IDENTITY_MISMATCH'})));
 it('rejects a sender/identity-domain mismatch and a wrong SES region',()=>{
  expect(()=>resolveEmailSender(DEFAULT_EMAIL_SENDER,arn('disraptor-internal.net'))).toThrow(expect.objectContaining({code:'EMAIL_SENDER_IDENTITY_MISMATCH'}));
  expect(()=>resolveEmailSender(ALTERNATE_EMAIL_SENDER,arn('disraptor-internal.net','af-south-1'))).toThrow(expect.objectContaining({code:'EMAIL_SENDER_IDENTITY_MISMATCH'}));
 });
 it('retains legacy verified-sender configuration',()=>{
  expect(resolveEmailSender('info@disraptor.co.za',arn('info@disraptor.co.za'))).toBe('info@disraptor.co.za');
  expect(resolveEmailSender('notifications@disraptor-internal.net',arn('disraptor-internal.net'))).toBe('notifications@disraptor-internal.net');
 });
 it('rejects unrelated contacts, domains and injected headers',()=>{
  for(const value of ['contact@disraptor.co.za','no-reply@unrelated.example','no-reply@disraptor.co.za\r\nBcc: private@example.invalid'])expect(()=>resolveEmailSender(value)).toThrow(expect.objectContaining({code:'EMAIL_SENDER_NOT_ALLOWED'}));
 });
});
