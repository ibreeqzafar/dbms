import test from 'node:test';
import assert from 'node:assert/strict';
import {csvText,summarizeOrders} from './admin-report.ts';
import {discountPercent} from './sales.ts';
import type {StoreOrder} from './checkout.ts';
import type {Product} from '../types.ts';
test('reports separate unpaid COD, collected payments and cancelled orders',()=>{
 const rows=[{order_state:'received',payment_state:'unpaid',total_paisa:40000},{order_state:'delivered',payment_state:'paid',total_paisa:80000},{order_state:'cancelled',payment_state:'paid',total_paisa:90000}] as StoreOrder[];
 assert.deepEqual(summarizeOrders(rows),{count:3,collected:80000,pending:1,cancelled:1,uncollected:40000});
});
test('CSV exports neutralise spreadsheet formulas and escape commas, quotes and line breaks',()=>{
 const csv=csvText([['=HYPERLINK("bad")','+SUM(1,2)','@formula','-1','\t=1','a,"b"\nc']]);
 assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));assert.ok(csv.includes('"\'+SUM(1,2)"'));assert.ok(csv.includes('"\'\t=1"'));assert.ok(csv.includes('"a,""b""\nc"'));
});
test('discounts ignore archived or invalid prices and do not undercount ten percent',()=>{
 const p={demoPricePKR:90,saleOriginalPrice:100} as Product;
 assert.equal(discountPercent(p),10);assert.equal(discountPercent({...p,active:false}),0);assert.equal(discountPercent({...p,saleOriginalPrice:80}),0);assert.equal(discountPercent({...p,demoPricePKR:0}),0);
});
