import '../config/load-environment.js';
import {prisma} from '../config/database.js';
import {developmentAccess,grantableDevelopmentRoles,type GrantableDevelopmentRole} from '../services/development-access.service.js';

const args=process.argv.slice(2),value=(name:string)=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined};
const userEmail=value('--user-email'),awsAccountNumber=value('--account-id'),roles=(value('--roles')??'').split(',').map(item=>item.trim()).filter(Boolean) as GrantableDevelopmentRole[],revoke=args.includes('--revoke');
if(!args.includes('--confirm'))throw new Error('Refusing to change development access without --confirm.');
if(!userEmail||!/^[^@]+@[^@]+$/.test(userEmail))throw new Error('--user-email is required.');
if(!awsAccountNumber||!/^\d{12}$/.test(awsAccountNumber))throw new Error('--account-id must be a 12-digit AWS account number.');
if(roles.some(role=>!grantableDevelopmentRoles.includes(role)))throw new Error(`Only these roles may be granted: ${grantableDevelopmentRoles.join(', ')}.`);
if(!revoke&&!roles.length)throw new Error('--roles is required when granting access.');
try{const result=revoke?await developmentAccess.revoke({userEmail,awsAccountNumber,roles:roles.length?roles:undefined}):await developmentAccess.grant({userEmail,awsAccountNumber,roles});console.log(JSON.stringify({mode:revoke?'revoke':'grant',...result},null,2))}finally{await prisma.$disconnect()}
