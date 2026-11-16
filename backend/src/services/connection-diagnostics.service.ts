import type {AwsAccountContext,SessionUser} from '../types.js';
import {awsAccountRepository} from './aws-account.repository.js';
import {identityDomain} from './identity-domain.service.js';
import {authorization} from './authorization.service.js';
import {ApiError} from '../utils/http.js';
import {env} from '../config/env.js';

/** Read the current persisted connection, not a process-local configuration snapshot.
 * This does not probe AWS or imply that a previous validation is a current STS call.
 */
export async function connectionDiagnostics(user:SessionUser,tenantId:string){
 if(user.activeTenantId!==tenantId||!authorization.canViewTenant(user,tenantId))throw new ApiError(403,'Organization context is not authorized.','TENANT_VIOLATION');
 const recordId=user.activeAwsAccountRecordId??user.activeAccountId;
 const account=recordId?await awsAccountRepository.getByRecordId(tenantId,recordId):undefined;
 if(account&&(account.tenantId!==tenantId||account.id!==recordId))throw new ApiError(403,'AWS account context does not match the selected organization.','AWS_ACCOUNT_FORBIDDEN');
 if(account){identityDomain.addManualAccount(account);if(!authorization.canViewAccount(user,account.id))throw new ApiError(403,'AWS account diagnostics are not authorized.','AWS_ACCOUNT_FORBIDDEN')}
 return {
  authenticationMode:env.AUTH_ENABLED?'configured':'development',awsConnectionMode:env.AWS_CONNECTION_MODE,demoDataEnabled:env.ENABLE_AWS_DEMO_DATA,
  activeTenantId:tenantId,activeAwsAccountRecordId:account?.id,activeAccountId:account?.accountId,
  accountName:account?.accountName,region:account?.region,connectionType:account?.connectionType,
  connectionStatus:account?.connectionStatus,lastValidation:account?.lastValidatedAt,
  lastSuccessfulRead:account?.lastSuccessfulReadAt,lastSuccessfulProvision:account?.lastSuccessfulProvisionAt,
  credentialsConfigured:account?.connectionType==='ACCESS_KEYS'?Boolean(account.credentialConfigured):undefined,
  provisioningEnabled:account?.provisioningEnabled,
  lastErrorCode:safeConnectionErrorCode(account),
  diagnosticStatus:!recordId?'ACCOUNT_REQUIRED':!account?'ACCOUNT_UNAVAILABLE':!account.hasConnection?'REPAIR_REQUIRED':'AVAILABLE',
  observedAt:new Date().toISOString(),source:'SAVED_CONNECTION_STATUS'
 };
}
function safeConnectionErrorCode(account?:AwsAccountContext){const code=account?.lastErrorCode;return code&&/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(code)?code:undefined}
