import { awsConnectionBroker } from '../services/aws/connection-broker.service.js';
import { developmentUsers,identityDomain } from '../services/identity-domain.service.js';

const index=process.argv.indexOf('--account-id'),accountId=index>=0?process.argv[index+1]:undefined;
if(!accountId)throw new Error('Usage: npm run aws:validate-account -- --account-id <12-digit-account-id-or-internal-id>');
const directoryUser=developmentUsers.find(user=>user.memberships.some(membership=>membership.role==='ORGANISATION_ADMIN'));
if(!directoryUser)throw new Error('No development Organisation administrator is configured.');
const actor=identityDomain.sessionUser(directoryUser,'development');actor.activeTenantId=actor.memberships[0]?.tenantId;
const account=identityDomain.account(actor,accountId);if(!account)throw new Error('The account is not configured or is outside the development administrator scope.');
actor.activeAccountId=account.id;
const result=await awsConnectionBroker.validateAccountConnection(actor,account.id,'READ');
console.log(JSON.stringify({Account:result.accountId,Arn:result.principalArn,Region:result.region,Connected:result.connected},null,2));
