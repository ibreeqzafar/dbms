import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const w=JSON.parse(await readFile('n8n/essyra-room-image.private.json','utf8'));
assert.equal(w.active,false);assert.equal(w.settings.saveDataSuccessExecution,'none');assert.equal(w.settings.saveDataErrorExecution,'none');assert.equal(w.settings.saveManualExecutions,false);
const names=new Set(w.nodes.map(n=>n.name));
for(const n of w.nodes){assert(!n.credentials);assert(!['n8n-nodes-base.executeCommand','n8n-nodes-base.ssh','n8n-nodes-base.readWriteFile'].includes(n.type));if(n.type==='n8n-nodes-base.code')new Function('$input','$',n.parameters.jsCode);if(n.type==='n8n-nodes-base.httpRequest'){const u=n.parameters.url;assert(u.startsWith('https://api.groq.com/')||u.startsWith('https://black-forest-labs-flux-2-klein-4b.hf.space/')||u.startsWith("={{ 'https://black-forest-labs-flux-2-klein-4b.hf.space/"));assert(!n.parameters.headerParameters)}}
for(const branches of Object.values(w.connections))for(const list of branches.main)for(const edge of list||[])assert(names.has(edge.node));
assert.equal(w.connections['Suitable room photograph?'].main[1][0].node,'Ask for a better room photo');
assert(!w.connections['Ask for a better room photo']);
assert(w.nodes.find(n=>n.name==='Validate image inputs').parameters.jsCode.includes('IMAGE_PROCESSING_CONSENT_REQUIRED'));
assert(!/\bhf_[A-Za-z0-9]{15,}|\bgsk_[A-Za-z0-9]{15,}|sb_secret_/.test(JSON.stringify(w)));
console.log('Passed renderer template: no credentials, fixed provider endpoints, consent gate, rejected-photo terminal path, valid connections and no execution-image retention.');
