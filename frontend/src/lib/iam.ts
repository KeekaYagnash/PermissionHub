import Fuse from 'fuse.js';
import type { AwsResource,IamIdentity,IamPolicySummary,RiskLevel } from '../types';

export type ThemePreference='light'|'dark'|'system';
export type RequestPriority='Normal'|'High'|'Urgent';
export type AccessDuration='1 hour'|'8 hours'|'1 day'|'7 days'|'30 days'|'Custom'|'Permanent';

export const actionCatalogue=[
 {service:'s3',action:'s3:ListBucket',description:'List objects in an S3 bucket',keywords:['s3 read bucket list amazon s three']},
 {service:'s3',action:'s3:GetObject',description:'Read objects from an S3 bucket',keywords:['s3 read object download amazon s three']},
 {service:'s3',action:'s3:PutObject',description:'Write objects to an S3 bucket',keywords:['s3 write upload object']},
 {service:'s3',action:'s3:DeleteObject',description:'Delete objects from an S3 bucket',keywords:['s3 delete destructive object']},
 {service:'ec2',action:'ec2:DescribeInstances',description:'View EC2 instance metadata',keywords:['ec2 read only describe compute']},
 {service:'ec2',action:'ec2:StartInstances',description:'Start EC2 instances',keywords:['ec2 start compute write']},
 {service:'ec2',action:'ec2:StopInstances',description:'Stop EC2 instances',keywords:['ec2 stop compute write']},
 {service:'rds',action:'rds:DescribeDBInstances',description:'View RDS DB instance metadata',keywords:['rds database read describe']},
 {service:'rds',action:'rds:DescribeDBClusters',description:'View RDS DB cluster metadata',keywords:['rds aurora cluster read describe']},
 {service:'lambda',action:'lambda:InvokeFunction',description:'Invoke a Lambda function',keywords:['lambda execute run invoke function']},
 {service:'lambda',action:'lambda:GetFunction',description:'View Lambda function configuration',keywords:['lambda read get function']},
 {service:'iam',action:'iam:PassRole',description:'Pass an IAM role to an AWS service',keywords:['iam pass role privilege escalation']},
 {service:'iam',action:'iam:AttachUserPolicy',description:'Attach a managed policy to a user',keywords:['iam permission management attach user policy']},
 {service:'iam',action:'iam:CreateAccessKey',description:'Create an IAM access key',keywords:['iam credential access key high risk']},
 {service:'apigateway',action:'apigateway:GET',description:'Read API Gateway configuration',keywords:['api gateway admin read']},
 {service:'cloudwatch',action:'cloudwatch:GetMetricData',description:'Read CloudWatch metric data',keywords:['cloud watch metrics read cloud wach']}
];

export function fuzzyPolicies(policies:IamPolicySummary[],query:string){
 if(!query.trim())return policies;
 const normalized=normalizeSearch(query);
 const fuse=new Fuse(policies,{includeScore:true,threshold:.38,ignoreLocation:true,keys:[{name:'policyName',weight:.45},{name:'arn',weight:.2},{name:'description',weight:.15},{name:'services',weight:.12},{name:'accessLevels',weight:.08}]});
 return fuse.search(normalized).sort((a,b)=>rankPolicy(a.item,normalized,a.score??1)-rankPolicy(b.item,normalized,b.score??1)).map(result=>result.item);
}

export function fuzzyIdentities(identities:IamIdentity[],query:string,includeServiceLinked=true){
 const filtered=includeServiceLinked?identities:identities.filter(identity=>!identity.path.startsWith('/aws-service-role/'));
 if(!query.trim())return filtered;
 const fuse=new Fuse(filtered,{threshold:.35,ignoreLocation:true,keys:['name','arn','path','description']});
 return fuse.search(normalizeSearch(query)).map(result=>result.item);
}

export function fuzzyResources(resources:AwsResource[],query:string){
 if(!query.trim())return resources;
 const fuse=new Fuse(resources,{threshold:.34,ignoreLocation:true,keys:['name','arn','service','region','tags.Owner','tags.Environment']});
 return fuse.search(normalizeSearch(query)).map(result=>result.item);
}

export function validateArnList(value:string,expectedServices:string[]=[]){
 const arns=value.split(/\n|,/).map(item=>item.trim()).filter(Boolean);
 const errors:string[]=[];
 const pattern=/^arn:aws[a-zA-Z-]*:[a-z0-9-]*:[a-z0-9-]*:\d{0,12}:.+/;
 for(const arn of arns){
  if(!pattern.test(arn))errors.push(`${arn} is not a valid AWS ARN.`);
  const service=arn.split(':')[2];
  if(expectedServices.length&&service&&!expectedServices.includes(service))errors.push(`${arn} does not match the selected service (${expectedServices.join(', ')}).`);
 }
 return {arns,errors};
}

export function calculateExpiry(duration:AccessDuration,startIso:string,customExpiry?:string){
 if(duration==='Permanent')return undefined;
 if(duration==='Custom')return customExpiry?new Date(customExpiry).toISOString():undefined;
 const hours:Record<string,number>={'1 hour':1,'8 hours':8,'1 day':24,'7 days':168,'30 days':720};
 return new Date(new Date(startIso).getTime()+hours[duration]*3600000).toISOString();
}

export function validateApprovalDeadline(value:string,nowDate=new Date()){
 if(!value)return 'Approval required by is required.';
 if(new Date(value).getTime()<nowDate.getTime())return 'Approval required by cannot be earlier than the current date and time.';
 return undefined;
}

export function validatePolicyJson(text:string){
 const errors:string[]=[];let document:any;
 try{document=JSON.parse(text)}catch(error:any){return {valid:false,document:undefined,errors:[`JSON syntax error: ${error.message}`],warnings:[]}}
 if(document.Version!=='2012-10-17')errors.push('Policy Version must be 2012-10-17.');
 const statements=Array.isArray(document.Statement)?document.Statement:[document.Statement].filter(Boolean);
 if(!statements.length)errors.push('Policy must contain at least one Statement.');
 const warnings:string[]=[];
 statements.forEach((statement:any,index:number)=>{
  const label=`Statement ${index+1}`;
  if(!['Allow','Deny'].includes(statement.Effect))errors.push(`${label}: Effect must be Allow or Deny.`);
  if(!statement.Action&&!statement.NotAction)errors.push(`${label}: Action or NotAction is required.`);
  if(!statement.Resource&&!statement.NotResource)errors.push(`${label}: Resource or NotResource is required.`);
  const actions=asArray(statement.Action??statement.NotAction).map(String);
  const resources=asArray(statement.Resource??statement.NotResource).map(String);
  if(actions.some(action=>action==='*'||action.endsWith(':*')))warnings.push(`${label}: wildcard action detected.`);
  if(resources.includes('*'))warnings.push(`${label}: wildcard resource detected.`);
  if(actions.some(action=>['iam:PassRole','iam:CreateAccessKey','iam:AttachUserPolicy','iam:AttachRolePolicy'].includes(action)))warnings.push(`${label}: privilege-escalation-sensitive IAM action detected.`);
  for(const resource of resources)if(resource!=='*'&&!/^arn:aws[a-zA-Z-]*:/.test(resource))errors.push(`${label}: ${resource} is not a valid ARN or wildcard.`);
 });
 return {valid:errors.length===0,document,errors,warnings};
}

export function riskForPolicies(policies:IamPolicySummary[]):RiskLevel{
 if(policies.some(policy=>policy.risk.level==='Critical'))return 'Critical';
 if(policies.some(policy=>policy.risk.level==='High'))return 'High';
 if(policies.some(policy=>policy.risk.level==='Moderate'))return 'Moderate';
 return 'Low';
}

export function normalizeSearch(query:string){
 return query.toLowerCase().replace(/\bs three\b/g,'s3').replace(/\bcloud wach\b/g,'cloudwatch').replace(/\bexecute\b/g,'invoke').replace(/\bread only\b/g,'readonly').trim();
}

function rankPolicy(policy:IamPolicySummary,query:string,score:number){
 const name=policy.policyName.toLowerCase();
 if(name===query)return -3;
 if(name.startsWith(query))return -2;
 if((policy.description??'').toLowerCase().includes(query)||policy.services.join(' ').toLowerCase().includes(query))return -1;
 return score;
}

function asArray(value:unknown):unknown[]{return Array.isArray(value)?value:value?[value]:[]}
