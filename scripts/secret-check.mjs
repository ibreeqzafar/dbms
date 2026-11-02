import {execFileSync,spawnSync} from 'node:child_process';
const history=process.argv.includes('--history');
const checks=[['Groq key',/\bgsk_[A-Za-z0-9]{30,}/],['Brevo key',/\bxkeysib-[A-Za-z0-9_-]{30,}/],['Supabase secret',/\bsb_secret_[A-Za-z0-9_-]{20,}/],['GitHub token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],['Private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['Provider key',/\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}/]];
const findings=[];
function scan(content,label){
 for(const [name,re] of checks)if(re.test(content))findings.push({file:label,type:name});
 for(const match of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){
  try{const p=JSON.parse(Buffer.from(match[0].split('.')[1],'base64url').toString());if(p.role==='service_role')findings.push({file:label,type:'Privileged Supabase JWT'})}catch{}
 }
}
if(history){
 const objects=execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8'}).trim().split('\n').map(s=>s.split(/ (.*)/s)).filter(s=>s[1]);
 const result=spawnSync('git',['cat-file','--batch'],{input:objects.map(x=>x[0]).join('\n')+'\n',maxBuffer:100*1024*1024});if(result.status!==0)throw Error('History scan failed');
 const output=result.stdout;let offset=0;
 for(const [sha,file] of objects){const end=output.indexOf(10,offset);const header=output.subarray(offset,end).toString().split(' ');const size=Number(header[2]);offset=end+1;if(header[1]==='blob')scan(output.subarray(offset,offset+size).toString('utf8'),sha.slice(0,10)+':'+file);offset+=size+1;}
 console.log('Scanned '+objects.length+' Git objects for known secret formats and privileged JWTs.');
}else{
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 for(const file of files){const r=spawnSync('git',['show',':'+file],{maxBuffer:30*1024*1024});if(r.status!==0)throw Error('Cannot inspect staged '+file);scan(r.stdout.toString('utf8'),file);if(/(?:^|\/)(?:runtime|\.vercel|node_modules)\/|\.sqlite(?:-|$)/.test(file))findings.push({file,type:'Private/runtime path'});}
 console.log('Scanned '+files.length+' staged files. Public Supabase publishable/anon keys are intentionally not treated as secrets.');
}
if(findings.length){console.error(JSON.stringify(findings,null,2));process.exitCode=1}else console.log('No matching secret values or prohibited runtime paths found. This is a scoped check, not a guarantee that arbitrary secrets cannot exist.');
