import {supabase,requireSession} from './supabase';
import type {AgentReply} from '../../supabase/functions/_shared/support-reply';
import {withDeadline} from './async-deadline';
export const supportAgentEnabled=import.meta.env.VITE_SUPPORT_AGENT_ENABLED==='true';
export async function loadBestsellerSlugs(signal:AbortSignal):Promise<string[]>{
 if(!supabase)throw Error('CATALOGUE_UNAVAILABLE');
 const client=supabase;
 return withDeadline(async request=>{const {data,error}=await client.rpc('get_store_bestsellers').abortSignal(request);if(error)throw error;return (data||[]).map((p:{slug:string})=>p.slug)},signal,8000);
}
export async function askAgent(question:string,conversationId:string,contextSlug:string|undefined,signal:AbortSignal):Promise<AgentReply>{
 if(!supportAgentEnabled||!supabase)throw Error('AGENT_NOT_ENABLED');
 const client=supabase;
 return withDeadline(async total=>{
 await withDeadline(()=>requireSession(),total,8000);
 const {data,error}=await withDeadline(request=>client.functions.invoke('support-agent',{body:{action:'send',question,conversationId,contextSlug,requestKey:crypto.randomUUID()},signal:request,timeout:10000}),total,10000);
 if(error||!data?.jobId)throw Error('AGENT_UNAVAILABLE');
 while(true){
  if(total.aborted)throw Error('ABORTED');
  const pause=new Promise<void>((resolve,reject)=>{const onAbort=()=>{clearTimeout(timer);reject(Error('ABORTED'))};const timer=setTimeout(()=>{total.removeEventListener('abort',onAbort);resolve()},1500);total.addEventListener('abort',onAbort,{once:true})});await pause;
  const result=await withDeadline(request=>client.functions.invoke('support-agent',{body:{action:'poll',jobId:data.jobId},signal:request,timeout:8000}),total,8000);
  if(total.aborted)throw Error('ABORTED');
  if(result.error)throw Error('AGENT_UNAVAILABLE');
  if(result.data?.state==='completed'&&result.data.reply)return result.data.reply as AgentReply;
  if(result.data?.state==='failed')throw Error('AGENT_UNAVAILABLE');
 }
 },signal,40000);
}
