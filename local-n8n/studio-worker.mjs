import {readFile} from 'node:fs/promises';
import path from 'node:path';
const endpoint='https://zhehksxuzyxnurmhwylw.supabase.co/functions/v1/studio-images';
const webhook='http://127.0.0.1:5678/webhook/essyra-room-image';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Runs beside the chat connector, so an image queue never holds up chat replies.
// A private local flag is enabled only after the database/edge deployment is verified.
export function startStudioWorker({root,key}){
 let stopped=false;
 async function broker(payload){
  const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-essyra-worker-key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error('STUDIO_BROKER_'+r.status);return r.json();
 }
 void (async()=>{
  let enabled=false;try{enabled=JSON.parse(await readFile(path.join(root,'runtime/studio-enabled.json'),'utf8')).enabled===true}catch{}
  if(!enabled)return;
  console.log('Private Design Studio image connector started. Keep this laptop awake and online.');
  while(!stopped){
   try{
    const local=await fetch('http://127.0.0.1:5678/healthz',{signal:AbortSignal.timeout(3000)});if(!local.ok)throw Error('LOCAL_UNAVAILABLE');
    const {job}=await broker({action:'lease'});
    if(!job){await sleep(8000);continue}
    let result={status:'unavailable'};
    try{
     const r=await fetch(webhook,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...job,jobId:job.id}),signal:AbortSignal.timeout(360000)});
     if(r.ok){let body=await r.json();if(Array.isArray(body))body=body[0];
      if(body?.jobId===job.id&&['completed','rejected'].includes(body.status))result={status:body.status,imageUrl:body.imageUrl,reason:body.reason};
     }
    }catch{}
    await broker({action:'complete',jobId:job.id,leaseToken:job.leaseToken,...result});
    console.log(result.status==='completed'?'A private room image completed.':result.status==='rejected'?'A room photo needs a better view.':'A room image could not complete; no automatic provider retry was attempted.');
   }catch{await sleep(15000)}
  }
 })().catch(()=>{console.log('The image connector stopped. Chat support can continue separately.');});
 return ()=>{stopped=true};
}
