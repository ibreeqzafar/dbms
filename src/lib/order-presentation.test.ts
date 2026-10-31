import {test} from 'node:test';import assert from 'node:assert/strict';
import {canReviewOrder,orderStatusLabel} from './order-presentation.ts';
test('order receipt cannot be mistaken for delivery or unlock customer reviews',()=>{
 assert.equal(orderStatusLabel('received'),'Order placed');assert.equal(orderStatusLabel('delivered'),'Delivered');
 for(const state of ['received','processing','dispatched','cancelled'] as const)assert.equal(canReviewOrder({order_state:state}),false);
 assert.equal(canReviewOrder({order_state:'delivered'}),true);
});
