import {supabase,requireSession} from './supabase';
import type {AgentReply} from '../../supabase/functions/_shared/support-reply';
export const supportAgentEnabled=import.meta.env.VITE_SUPPORT_AGENT_ENABLED==='true';
export async function askAgent(question:string,conversationId:string,contextSlug:string|undefined,signal:AbortSignal):Promise<AgentReply>{
 if(!supportAgentEnabled||!supabase)throw Error('AGENT_NOT_ENABLED');
 await requireSession();
 const {data,error}=await supabase.functions.invoke('support-agent',{body:{action:'send',question,conversationId,contextSlug,requestKey:crypto.randomUUID()}});
 if(error||!data?.jobId)throw Error('AGENT_UNAVAILABLE');
 const until=Date.now()+95000;
 while(Date.now()<until){
  if(signal.aborted)throw Error('ABORTED');
  const pause=new Promise<void>((resolve,reject)=>{const onAbort=()=>{clearTimeout(timer);reject(Error('ABORTED'))};const timer=setTimeout(()=>{signal.removeEventListener('abort',onAbort);resolve()},2000);signal.addEventListener('abort',onAbort,{once:true})});await pause;
  const result=await supabase.functions.invoke('support-agent',{body:{action:'poll',jobId:data.jobId}});
  if(signal.aborted)throw Error('ABORTED');
  if(result.error)throw Error('AGENT_UNAVAILABLE');
  if(result.data?.state==='completed'&&result.data.reply)return result.data.reply as AgentReply;
  if(result.data?.state==='failed')throw Error('AGENT_UNAVAILABLE');
 }
 throw Error('AGENT_TIMEOUT');
}
