import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// n8n 2.45.4 interpolates Windows paths into a single-quoted JS string.
// JSON serialization keeps apostrophes in the user's folder name from breaking it.
export async function prepareLocalCompatibility(){
 const root=path.dirname(fileURLToPath(import.meta.url));
 const target=path.join(root,'node_modules','n8n-core','dist','nodes-loader','load-class-in-isolation.js');
 const original=await readFile(target,'utf8');
 const before="new vm_1.Script(`new (require('${filePath}').${className})()`)";
 const after='new vm_1.Script(`new (require(${JSON.stringify(filePath)})[${JSON.stringify(className)}])()`)';
 if(original.includes(after))return;
 if(!original.includes(before))throw Error('n8n node-loader changed. Review compatibility before starting this version.');
 await writeFile(target+'.essyra-original',original,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error});
 await writeFile(target,original.replace(before,after));
}
