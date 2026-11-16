import {MutationCache} from '@tanstack/react-query';
import {feedback} from '../store/feedback';

/** Only fixed, safe summaries enter global notifications; field errors stay in forms. */
export function createMutationFeedback(){return new MutationCache({
 onMutate:(_variables,mutation)=>{feedback.show(`mutation-${mutation.mutationId}`,'Working…','loading');},
 onSettled:(data,error,_variables,_result,mutation)=>{
  const id=`mutation-${mutation.mutationId}`;
  if(error){feedback.show(id,'The operation could not be completed. Review the details on this page and try again.','error');return}
  if(mutation.meta?.feedbackCompleted===false){feedback.dismiss(id);return}
  const result=data as {success?:boolean;status?:string;deliveryStatus?:string;validation?:{success?:boolean;status?:string}}|undefined;
  const warning=result?.success===false||result?.validation?.success===false||result?.deliveryStatus==='FAILED'||result?.status==='DEGRADED'||result?.validation?.status==='DEGRADED';
  feedback.show(`mutation-${mutation.mutationId}`,warning?'The operation finished with an issue that needs attention. Review the details on this page.':'Operation completed successfully.',warning?'warning':'success');
 }
});}
