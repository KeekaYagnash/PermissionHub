/** Local structural/security validation; AWS validation and workflow approval still apply. */
export function validateRoleTrust(document:unknown,accountNumber:string):string[]{
 if(!document||typeof document!=='object'||Array.isArray(document))return ['A role trust policy object is required.'];
 const policy=document as Record<string,unknown>,statements=Array.isArray(policy.Statement)?policy.Statement:[policy.Statement];
 const errors:string[]=[];if(policy.Version!=='2012-10-17')errors.push('Trust policy Version must be 2012-10-17.');
 if(!statements.length)errors.push('A trust statement is required.');
 for(const raw of statements){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)){errors.push('Each trust statement must be an object.');continue}
  const statement=raw as Record<string,unknown>,actions=Array.isArray(statement.Action)?statement.Action:[statement.Action];
  if(!['Allow','Deny'].includes(String(statement.Effect))||!actions.length||actions.some(action=>action!=='sts:AssumeRole'))errors.push('Trust statements must use Allow/Deny and sts:AssumeRole.');
  if(statement.NotAction!==undefined||statement.Resource!==undefined||statement.NotResource!==undefined)errors.push('Trust policies cannot contain NotAction, Resource or NotResource.');
  if(statement.Condition!==undefined&&(!statement.Condition||typeof statement.Condition!=='object'||Array.isArray(statement.Condition)))errors.push('Trust conditions must be an object.');
  const principal=statement.Principal;
  if(statement.NotPrincipal!==undefined)errors.push('NotPrincipal is not supported for requested role trust.');
  const object=principal&&typeof principal==='object'&&!Array.isArray(principal)?principal as Record<string,unknown>:undefined;
  if(principal!=='*'&&(!object||Object.keys(object).some(key=>!['AWS','Service'].includes(key))||!Object.keys(object).length))errors.push('Use a supported AWS or Service trusted principal.');
  const aws=object?.AWS,services=object?.Service;
  const awsValues=aws===undefined?[]:Array.isArray(aws)?aws:[aws],serviceValues=services===undefined?[]:Array.isArray(services)?services:[services];
  if(aws!==undefined&&!awsValues.length||services!==undefined&&!serviceValues.length)errors.push('Trusted principal lists cannot be empty.');
  if(serviceValues.some(value=>typeof value!=='string'||!/^[a-z0-9.-]+\.amazonaws\.com(?:\.cn)?$/.test(value)))errors.push('Service trust requires an explicit AWS service principal.');
  if(awsValues.some(value=>typeof value!=='string'||value!=='*'&&(value.includes('*')||!/^arn:aws[a-z-]*:iam::\d{12}:(?:root|(?:role|user)\/.+)$/.test(value))))errors.push('AWS trust requires IAM user/role ARNs or an account-scoped wildcard.');
  if(statement.Effect==='Allow'&&(principal==='*'||awsValues.includes('*'))){
   const condition=statement.Condition as {StringEquals?:Record<string,unknown>}|undefined;
   const scope=condition?.StringEquals?.['aws:PrincipalAccount'];
   if(scope!==accountNumber&&!(Array.isArray(scope)&&scope.length===1&&scope[0]===accountNumber))errors.push('Wildcard trust must use StringEquals aws:PrincipalAccount for the selected AWS account.');
  }
 }
 return errors;
}
export function trustNeedsSecurityReview(document:unknown){
 if(!document||typeof document!=='object')return false;
 const policy=document as Record<string,unknown>;
 return (Array.isArray(policy.Statement)?policy.Statement:[policy.Statement]).some(raw=>{if(!raw||typeof raw!=='object')return false;const statement=raw as Record<string,unknown>,principal=statement.Principal;return statement.Effect==='Allow'&&(principal==='*'||Boolean(principal&&typeof principal==='object'&&'AWS' in principal))});
}
