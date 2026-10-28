import {endpoint,identity,response} from '../_shared/http.ts';
import {supportInput} from '../_shared/support-input.ts';
Deno.serve(endpoint(async req=>{
 if(req.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 const {client}=await identity(req);const body=await supportInput(req,8000);
 if(body.action==='poll'){
  const {data,error}=await client.rpc('get_support_chat',{p_job:body.jobId});if(error)return response({error:'CHAT_UNAVAILABLE'},404);return response(data);
 }
 if(body.action!=='send')return response({error:'INVALID_ACTION'},422);
 const {data,error}=await client.rpc('enqueue_support_chat',{p_key:body.requestKey,p_conversation:body.conversationId,p_question:body.question,p_context:body.contextSlug||''});
 if(error){const code=['WORKER_OFFLINE','CHAT_LIMIT','SUPPORT_PAUSED','REQUEST_CONFLICT','INVALID_MESSAGE','INVALID_PRODUCT'].find(s=>error.message.includes(s));return response({error:code||'CHAT_UNAVAILABLE'},code==='CHAT_LIMIT'?429:code==='REQUEST_CONFLICT'?409:503)}
 return response({jobId:data});
}));
