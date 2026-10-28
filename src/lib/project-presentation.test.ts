import {test} from 'node:test';import assert from 'node:assert/strict';
import {projectId,projectIdentity} from './project-presentation.ts';
test('display aliases preserve source keys and use reserved email addresses',()=>{
 assert.equal(projectId('TEST-O0001'),'ESS-2026-000001');assert.equal(projectId('TEST-C0750'),'CUS-2026-000750');assert.equal(projectId('TEST-R500'),'REV-2026-000500');assert.equal(projectId('actual-order-uuid'),'actual-order-uuid');
 const contacts=Array.from({length:750},(_,i)=>projectIdentity(`TEST-C${String(i+1).padStart(4,'0')}`));
 assert.equal(new Set(contacts.map(c=>c.email)).size,750);assert.ok(contacts.every(c=>c.email.endsWith('@example.com')&&!c.name.includes('Test')));
});
