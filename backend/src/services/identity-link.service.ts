import {prisma} from '../config/database.js';
import {Prisma} from '@prisma/client';
import {ApiError} from '../utils/http.js';
import {newProof,tokenHash,verifiedEmail} from './organization.service.js';
import type {SessionUser} from '../types.js';

export async function startIdentityLink(user:SessionUser){
 verifiedEmail(user);if(user.provider!=='cognito')throw new ApiError(403,'Account linking requires Cognito authentication.','LINK_PROVIDER_REQUIRED');
 const proof=newProof();
 await prisma.identityLinkChallenge.create({data:{userId:user.id,tokenHash:tokenHash(proof),expiresAt:new Date(Date.now()+10*60_000)}});
 return {proof,expiresInSeconds:600};
}
export async function acceptIdentityLink(target:SessionUser,proof:string){
 if(target.provider!=='cognito')throw new ApiError(403,'A Cognito-authenticated target identity is required.','LINK_PROVIDER_REQUIRED');
 const email=verifiedEmail(target);
 return prisma.$transaction(async tx=>{
  const challenge=await tx.identityLinkChallenge.findUnique({where:{tokenHash:tokenHash(proof)},include:{user:true}});
  if(!challenge||challenge.consumedAt||challenge.expiresAt<=new Date()||challenge.user.status!=='ACTIVE'||challenge.user.email.toLowerCase()!==email)throw new ApiError(403,'Linking proof is expired, used, or does not match this verified identity. Sign in with your original method to start again.','IDENTITY_LINK_INVALID');
  const existing=await tx.authIdentity.findUnique({where:{provider_providerSubject:{provider:'cognito',providerSubject:target.providerSubject}}});
  if(existing&&existing.userId!==challenge.userId)throw new ApiError(409,'This sign-in method already belongs to another account. Contact support for a reviewed recovery.','IDENTITY_LINK_CONFLICT');
  const claimed=await tx.identityLinkChallenge.updateMany({where:{id:challenge.id,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
  if(claimed.count!==1)throw new ApiError(409,'This linking proof has already been used.','IDENTITY_LINK_REPLAY');
  await tx.authIdentity.upsert({where:{provider_providerSubject:{provider:'cognito',providerSubject:target.providerSubject}},create:{provider:'cognito',providerSubject:target.providerSubject,userId:challenge.userId,providerEmail:email},update:{}});
  // Separate security audit with no bearer proof or provider tokens.
  const memberships=await tx.tenantMembership.findMany({where:{userId:challenge.userId,status:'ACTIVE'},select:{tenantId:true}});
  for(const item of memberships)await tx.connectionAuditEvent.create({data:{tenantId:item.tenantId,actorUserId:challenge.userId,action:'AUTH_IDENTITY_LINKED',outcome:'SUCCESS',metadata:{provider:'cognito'}}});
  return {linked:true};
 },{isolationLevel:'Serializable'}).catch((error:unknown)=>{if(error instanceof Prisma.PrismaClientKnownRequestError&&['P2002','P2034'].includes(error.code))throw new ApiError(409,'This linking operation changed concurrently. Sign in with your original method and start again.','IDENTITY_LINK_CONFLICT');throw error});
}
