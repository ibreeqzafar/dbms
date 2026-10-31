import {test} from 'node:test';import assert from 'node:assert/strict';
import {collectionBreadcrumbs} from './breadcrumbs.ts';
test('category breadcrumbs reflect room, item type and sale filters without unsafe paths',()=>{
 assert.deepEqual(collectionBreadcrumbs('?room=living&type=sofas').map(c=>c.label),['Home','Living room','Sofas']);
 assert.equal(collectionBreadcrumbs('?room=bedroom&type=beds').at(-1)?.href,'/collection?room=bedroom&type=beds');
 assert.deepEqual(collectionBreadcrumbs('?type=mirrors').map(c=>c.label),['Home','Mirrors']);
 assert.deepEqual(collectionBreadcrumbs('?sale=1').map(c=>c.label),['Home','Sale']);
 assert.deepEqual(collectionBreadcrumbs('?room=__proto__&type=invalid').map(c=>c.label),['Home','All furniture']);
});
