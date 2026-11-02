import {readFile,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {matchesWorker} from './worker-process.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const recordPath=path.join(root,'runtime','support-worker-process.json');
let record;try{record=JSON.parse(await readFile(recordPath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
if(matchesWorker(record,path.join(root,'support-worker.mjs'))){process.kill(record.pid);console.log('Stopped ESSYRA support connector.');}
else console.log('No matching ESSYRA support connector is running.');
await unlink(recordPath).catch(e=>{if(e.code!=='ENOENT')throw e});
