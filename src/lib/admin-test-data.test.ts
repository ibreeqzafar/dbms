import {test} from 'node:test';import assert from 'node:assert/strict';
import {makeAdminTestData} from './admin-test-data.ts';
import type {Product} from '../types.ts';
test('test store is isolated, reserved-domain and consistent with delivered test orders',()=>{
 const data=makeAdminTestData([{id:'bed-a',name:'Bed A',demoPricePKR:100,active:true},{id:'hidden',name:'Hidden',demoPricePKR:1,active:false}] as Product[]);
 assert.equal(data.customers.length,750);assert.equal(data.orders.length,600);assert.equal(data.reviews.length,500);
 assert.equal(new Set(data.customers.map(c=>c.id)).size,750);assert.ok(data.customers.every(c=>c.email.endsWith('@example.invalid')));
 assert.ok(data.orders.every(o=>o.id.startsWith('TEST-')&&o.productId==='bed-a'&&data.customers.some(c=>c.id===o.customerId)));
 assert.ok(data.reviews.every(r=>r.rating>=1&&r.rating<=5&&data.orders.some(o=>o.customerId===r.customerId&&o.productId===r.productId&&o.state==='delivered')));
 assert.deepEqual(data.popularity,[['bed-a',data.orders.filter(o=>o.state==='delivered').reduce((sum,o)=>sum+o.quantity,0)]]);
 assert.equal(makeAdminTestData([]).orders.length,0);
});
