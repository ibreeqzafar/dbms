import {spawnSync} from 'node:child_process';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {matchesWorker} from './worker-process.mjs';
import {startStudioWorker} from './studio-worker.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const endpoint='https://zhehksxuzyxnurmhwylw.supabase.co/functions/v1/support-worker';
const webhook='http://127.0.0.1:5678/webhook/essyra-support';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stopping=false;
process.on('SIGINT',()=>{stopping=true});process.on('SIGTERM',()=>{stopping=true});
function privateKey(){
 const file=path.join(root,'runtime','bridge-key.xml');
 const ps=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$key = Import-Clixml -LiteralPath $env:ESSYRA_BRIDGE_KEY_FILE; [Console]::Out.Write(([PSCredential]::new('bridge', $key)).GetNetworkCredential().Password)"],{env:{...process.env,ESSYRA_BRIDGE_KEY_FILE:file},encoding:'utf8',windowsHide:true});
 if(ps.status!==0||ps.stdout.length<32)throw Error('Connection key unavailable. Complete Set ESSYRA Bridge Key.cmd first.');
 return ps.stdout;
}
const key=privateKey();
const record=path.join(root,'runtime','support-worker-process.json');
try{const previous=JSON.parse(await readFile(record,'utf8'));if(matchesWorker(previous,fileURLToPath(import.meta.url)))throw Error('An ESSYRA support worker is already running. Use the stop shortcut before starting again.')}catch(e){if(e.code!=='ENOENT')throw e}
await writeFile(record,JSON.stringify({pid:process.pid,script:fileURLToPath(import.meta.url)})+'\n');
const stopStudio=startStudioWorker({root,key});
async function broker(payload){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-essyra-worker-key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('BROKER_'+r.status);return r.json()}
console.log('ESSYRA support connector started. It makes outbound HTTPS requests only; no public tunnel or editor exposure.');
let lastState='',lastReviewCheck=0;
try{while(!stopping){
 try{
  const ready=await fetch('http://127.0.0.1:5678/healthz',{signal:AbortSignal.timeout(3000)});
  if(!ready.ok)throw Error('LOCAL_AGENT_UNAVAILABLE');
  if(Date.now()-lastReviewCheck>300000){lastReviewCheck=Date.now();await broker({action:'review-emails'}).catch(()=>{});}
  const {job}=await broker({action:'lease'});
  if(lastState!=='online'){console.log('Support connection online.');lastState='online'}
  if(!job){await sleep(8000);continue}
  let reply,error;
  try{
   // Both routes have identical public, read-only privileges. Routing never grants access to private data.
   const studio=job.chatInput.startsWith('[ESSYRA_STUDIO]\n');
   const target=studio?'http://127.0.0.1:5678/webhook/essyra-design-studio':webhook;
   const r=await fetch(target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chatInput:studio?job.chatInput.slice('[ESSYRA_STUDIO]\n'.length):job.chatInput,sessionId:job.sessionId,contextSlug:job.contextSlug}),signal:AbortSignal.timeout(35000)});
   if(!r.ok){error=r.status===429?'MODEL_LIMIT':'MODEL_UNAVAILABLE'}else{reply=await r.json();if(Array.isArray(reply))reply=reply[0]}
  }catch{error='MODEL_UNAVAILABLE'}
  await broker({action:'complete',jobId:job.id,leaseToken:job.leaseToken,reply,error});
  console.log(error?'A chat request could not complete; the site can offer standard support.':'A chat reply completed.');
 }catch{
  if(lastState!=='offline'){console.log('Support connection unavailable. Check internet, Supabase deployment and connection-key settings. No customer messages are logged here.');lastState='offline'}
  await sleep(15000);
 }
}}finally{stopStudio();await unlink(record).catch(()=>{})}
