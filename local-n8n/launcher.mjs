import {spawn,spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {prepareLocalCompatibility} from './compatibility.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.join(root,'runtime');
const url='http://localhost:5678';
await mkdir(runtime,{recursive:true});
const recordPath=path.join(runtime,'process.json');
const cli=path.join(root,'node_modules','n8n','bin','n8n');
function matches(record){
 if(!Number.isSafeInteger(record?.pid)||record.pid<1||record.cli!==cli)return false;
 const check=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}' | Select-Object Name,CommandLine | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true});
 let processInfo;try{processInfo=JSON.parse(check.stdout)}catch{}
 return processInfo?.Name==='node.exe'&&processInfo.CommandLine?.includes(cli);
}
const health=async()=>{try{const r=await fetch(url+'/healthz',{signal:AbortSignal.timeout(2000)});return r.ok}catch{return false}};
const action=process.argv[2]||'start';
if(action==='status'){console.log(await health()?'n8n is running at '+url:'n8n is not responding at '+url);process.exit(0)}
if(action==='stop'){
 let record;try{record=JSON.parse(await readFile(recordPath,'utf8'))}catch{console.log('No local ESSYRA n8n process record.');process.exit(0)}
 // Confirm the listener belongs to the exact saved node command before terminating.
 if(matches(record)){process.kill(record.pid);console.log('Stopped ESSYRA local n8n.')}else console.log('Saved process is absent or does not match; nothing stopped.');
}else if(action==='start'){
 if(await health()){console.log('n8n is already available at '+url);process.exit(0)}
 let previous;try{previous=JSON.parse(await readFile(recordPath,'utf8'))}catch{}
 if(matches(previous)){console.log('ESSYRA n8n is already starting. Open '+url+' shortly.');process.exit(0)}
 await prepareLocalCompatibility();
 const log=await open(path.join(runtime,'n8n.log'),'a');
 const env={...process.env,NODE_ENV:'production',N8N_USER_FOLDER:runtime,N8N_HOST:'localhost',N8N_LISTEN_ADDRESS:'127.0.0.1',N8N_PORT:'5678',N8N_PROTOCOL:'http',N8N_EDITOR_BASE_URL:url,GENERIC_TIMEZONE:'Asia/Karachi',N8N_DIAGNOSTICS_ENABLED:'false',N8N_PERSONALIZATION_ENABLED:'false',N8N_PUBLIC_API_DISABLED:'true',N8N_BLOCK_ENV_ACCESS_IN_NODE:'true',EXECUTIONS_DATA_SAVE_ON_SUCCESS:'none',EXECUTIONS_DATA_SAVE_ON_ERROR:'none',EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS:'false',NODES_EXCLUDE:JSON.stringify(['n8n-nodes-base.executeCommand','n8n-nodes-base.readWriteFile','n8n-nodes-base.ssh'])};
 const child=spawn(process.execPath,[cli,'start'],{cwd:root,env,stdio:['ignore',log.fd,log.fd],detached:true,windowsHide:true});
 child.once('error',err=>{console.error('Could not start n8n: '+err.message);process.exitCode=1});
 child.unref();
 await writeFile(recordPath,JSON.stringify({pid:child.pid,cli})+'\n');
 console.log('Starting ESSYRA local n8n. Open '+url+' after startup finishes.');
 console.log('Use Stop ESSYRA n8n.cmd to stop it. Keep runtime/ private: it contains the database and credential encryption settings.');
}else{console.error('Use start, stop or status');process.exitCode=1}
