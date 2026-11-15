const messages={
 EMAIL_DISABLED:'Email delivery is not configured. Enable the email mode and provide the existing SES identity ARN in the deployed Terraform configuration.',
 EMAIL_SENDER_NOT_ALLOWED:'Configure an existing verified PermissionHub SES sender: info@disraptor.co.za or a mailbox under disraptor-internal.net.',
 EMAIL_ACCESS_DENIED:'The platform API role needs ses:SendEmail for the us-east-1 sender identity, allowed by both its IAM policy and permissions boundary.',
 EMAIL_BOUNDARY_DENIED:'The platform runtime permissions boundary blocks SES. Update the independent bootstrap boundary as well as the API role policy.',
 EMAIL_IDENTITY_NOT_VERIFIED:'SES rejected an unverified sender or sandbox recipient in us-east-1. Check the existing sender identity and SES production-access status; do not verify unrelated contact identities.',
 EMAIL_MESSAGE_REJECTED:'SES rejected delivery. Check the existing us-east-1 identity, SES sandbox/recipient restrictions and sending status.',
 EMAIL_SENDING_PAUSED:'SES sending is paused or disabled in us-east-1. An AWS administrator must review the SES account status.',
 EMAIL_THROTTLED:'SES temporarily throttled delivery. Check the sending quota and retry later.',
 EMAIL_CREDENTIALS_UNAVAILABLE:'The platform SES client could not authenticate. Check the Lambda execution role; do not use customer account credentials for email.',
 EMAIL_TIMEOUT:'SES could not be reached before the delivery deadline. Check Lambda HTTPS egress to SES in us-east-1.',
 EMAIL_STORAGE_UNAVAILABLE:'Email delivery storage is unavailable. Check that the notification migration completed before retrying.',
 EMAIL_DELIVERY_FAILED:'Email delivery failed. Review the sanitized EMAIL_DELIVERY_FAILED CloudWatch entry and AWS request ID.'
} as const;
export type EmailFailureCode=keyof typeof messages;
export function emailConfigurationError(code:EmailFailureCode){return Object.assign(new Error(messages[code]),{code})}
/** Never return raw SDK error messages: they can contain recipient addresses and sensitive input. */
export function describeEmailFailure(error:unknown){
 const value=error&&typeof error==='object'?error as {name?:unknown;code?:unknown;message?:unknown;$metadata?:{requestId?:unknown}}:{};
 const name=`${value.name??''} ${value.code??''}`,message=typeof value.message==='string'?value.message:'';
 let code:EmailFailureCode='EMAIL_DELIVERY_FAILED';
 if(typeof value.code==='string'&&Object.hasOwn(messages,value.code))code=value.code as EmailFailureCode;
 else if(/AccessDenied|Unauthorized/i.test(name))code=/permissions boundary/i.test(message)?'EMAIL_BOUNDARY_DENIED':'EMAIL_ACCESS_DENIED';
 else if(/MessageRejected/i.test(name))code=/not verified/i.test(message)?'EMAIL_IDENTITY_NOT_VERIFIED':'EMAIL_MESSAGE_REJECTED';
 else if(/MailFromDomainNotVerified/i.test(name))code='EMAIL_IDENTITY_NOT_VERIFIED';
 else if(/SendingPaused|AccountSendingPaused/i.test(name))code='EMAIL_SENDING_PAUSED';
 else if(/Throttl|TooManyRequests|LimitExceeded/i.test(name))code='EMAIL_THROTTLED';
 else if(/CredentialsProvider|InvalidClientToken|UnrecognizedClient|ExpiredToken|InvalidSignature|SignatureDoesNotMatch/i.test(name))code='EMAIL_CREDENTIALS_UNAVAILABLE';
 else if(/Timeout|Abort|Networking|ENETUNREACH|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(name))code='EMAIL_TIMEOUT';
 else if(value.code==='P2021'||value.code==='P2022')code='EMAIL_STORAGE_UNAVAILABLE';
 const requestId=value.$metadata?.requestId;
 return {code,message:messages[code],retryable:code==='EMAIL_TIMEOUT'||code==='EMAIL_THROTTLED',...(typeof requestId==='string'&&/^[A-Za-z0-9-]{1,128}$/.test(requestId)?{awsRequestId:requestId}:{})};
}
