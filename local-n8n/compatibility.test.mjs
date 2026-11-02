import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,unlink,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareLocalCompatibility} from './compatibility.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
test('installed n8n loader handles apostrophes in the Windows user and fixture paths',async()=>{
 await prepareLocalCompatibility();
 const runtime=path.join(root,'runtime');await mkdir(runtime,{recursive:true});
 const fixture=path.join(runtime,"loader's-fixture.cjs");
 await writeFile(fixture,"exports.Fixture=class Fixture { constructor(){this.ok=true} };\n");
 try{const {loadClassInIsolation}=await import('./node_modules/n8n-core/dist/nodes-loader/load-class-in-isolation.js');assert.equal(loadClassInIsolation(fixture,'Fixture').ok,true)}finally{await unlink(fixture)}
});
test('reapplying the compatibility fix does not change an already-patched loader',async()=>{
 await prepareLocalCompatibility();const target=path.join(root,'node_modules/n8n-core/dist/nodes-loader/load-class-in-isolation.js');const before=await readFile(target,'utf8');await prepareLocalCompatibility();assert.equal(await readFile(target,'utf8'),before);
});
