import {response,service} from '../_shared/http.ts';
import {supportInput} from '../_shared/support-input.ts';
import {normalizeAgentReply} from '../_shared/support-reply.ts';
async function equalKey(received:string,expected:string){const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [a,b]=await Promise.all([hash(received),hash(expected)]);let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];return mismatch===0}
Deno.serve(async req=>{
 if(req.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 const expected=Deno.env.get('N8N_SUPPORT_WORKER_KEY');
 if(!expected||expected.length<32)return response({error:'WORKER_NOT_CONFIGURED'},503);
 const received=req.headers.get('x-essyra-worker-key')||'';
 if(received.length>512||!await equalKey(received,expected))return response({error:'UNAUTHORIZED'},401);
 try{
  const body=await supportInput(req,24000),client=service();
  if(body.action==='lease'){const {data,error}=await client.rpc('lease_support_chat');if(error)throw error;return response({job:data})}
  if(body.action!=='complete'||! /^[0-9a-f-]{36}$/i.test(body.jobId)||! /^[0-9a-f-]{36}$/i.test(body.leaseToken))return response({error:'INVALID_REQUEST'},422);
  const failed=typeof body.error==='string';const reply=failed?null:normalizeAgentReply(body.reply);
  if(reply?.productSlugs.length){const {data,error}=await client.from('products').select('slug').in('slug',reply.productSlugs).eq('active',true);if(error)throw error;const allowed=new Set((data||[]).map(p=>p.slug));reply.productSlugs=reply.productSlugs.filter(s=>allowed.has(s))}
  const {data,error}=await client.rpc('finish_support_chat',{p_job:body.jobId,p_lease:body.leaseToken,p_reply:reply,p_error:failed?body.error:null});if(error)throw error;
  return response({accepted:data});
 }catch{return response({error:'WORKER_REQUEST_FAILED'},422)}
});
