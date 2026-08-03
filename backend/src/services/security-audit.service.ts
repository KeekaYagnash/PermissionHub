import { randomUUID } from 'node:crypto';
export interface SecurityAuditEvent{id:string;tenantId?:string;awsAccountId?:string;actorUserId?:string;action:string;outcome:'SUCCESS'|'FAILED'|'INFO';metadata:Record<string,unknown>;createdAt:string}
export class SecurityAuditService {readonly events:SecurityAuditEvent[]=[];record(input:Omit<SecurityAuditEvent,'id'|'createdAt'>){const event={id:randomUUID(),createdAt:new Date().toISOString(),...input,metadata:this.sanitise(input.metadata)};this.events.unshift(event);return event}private sanitise(metadata:Record<string,unknown>){return Object.fromEntries(Object.entries(metadata).map(([key,value])=>[key,/secret|token|credential|externalid|cookie/i.test(key)?'[redacted]':value]))}}
export const securityAudit=new SecurityAuditService();
