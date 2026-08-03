import type { NextFunction,Request,Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
export class ApiError extends Error{constructor(public status:number,message:string,public code='API_ERROR',public details?:unknown){super(message)}}
export const asyncHandler=(fn:(req:any,res:Response,next:NextFunction)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>Promise.resolve(fn(req,res,next)).catch(next);
export function errorHandler(error:Error,req:Request,res:Response,_next:NextFunction){if(error instanceof ZodError)return res.status(422).json({error:{code:'VALIDATION_ERROR',message:'Request validation failed',details:error.issues,correlationId:(req as any).correlationId}});const e=error instanceof ApiError?error:new ApiError(500,'An unexpected error occurred','INTERNAL_ERROR');logger.error({err:error,path:req.path,correlationId:(req as any).correlationId},'API request failed');return res.status(e.status).json({error:{code:e.code,message:e.message,details:e.details,correlationId:(req as any).correlationId}})}
export const page=(items:unknown[],pageNumber=1,pageSize=25)=>({data:items.slice((pageNumber-1)*pageSize,pageNumber*pageSize),pagination:{page:pageNumber,pageSize,total:items.length,totalPages:Math.ceil(items.length/pageSize)}});
