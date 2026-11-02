import {spawnSync} from 'node:child_process';

// Verify the saved PID still belongs to this exact connector before using it.
export function matchesWorker(record, script) {
 if(!Number.isSafeInteger(record?.pid)||record.pid<1||record.script!==script)return false;
 const check=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}' | Select-Object Name,CommandLine | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true});
 let info;try{info=JSON.parse(check.stdout)}catch{}
 return info?.Name==='node.exe'&&info.CommandLine?.includes(script);
}
