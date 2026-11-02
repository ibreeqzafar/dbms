import {spawn} from 'node:child_process';
import {access,mkdir,open,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {matchesWorker} from './worker-process.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),runtime=path.join(root,'runtime'),script=path.join(root,'support-worker.mjs');
const action=process.argv[2]||'start';
if(action==='stop'){await import('./stop-support-worker.mjs');process.exit(0)}
let record;try{record=JSON.parse(await readFile(path.join(runtime,'support-worker-process.json'),'utf8'))}catch{}
const running=matchesWorker(record,script);
if(action==='status'){console.log(running?'ESSYRA support connector is running.':'ESSYRA support connector is not running.');process.exit(0)}
if(action!=='start')throw Error('Use start, stop or status.');
if(running){console.log('ESSYRA support connector is already running.');process.exit(0)}
try{await access(path.join(runtime,'bridge-key.xml'))}catch{throw Error('Run Copy ESSYRA Bridge Key.cmd and save the copied key in Supabase first.')}
await mkdir(runtime,{recursive:true});
const log=await open(path.join(runtime,'support-worker.log'),'a');
const child=spawn(process.execPath,[script],{cwd:root,stdio:['ignore',log.fd,log.fd],detached:true,windowsHide:true});
child.once('error',()=>{console.error('Could not start ESSYRA support connector.');process.exitCode=1});
child.unref();await log.close();
console.log('Starting ESSYRA support connector in the background. You can close this window.');
console.log('Keep the laptop awake and online. Use Stop ESSYRA n8n.cmd to stop both services.');
