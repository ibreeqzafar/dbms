import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsOrders,estimatedGrossProfit,reportMonth,salesAnalytics} from './admin-analytics.ts';
import type {StoreOrder} from './checkout.ts';
import type {HistoricalRecords} from './admin-analytics.ts';
const now=new Date('2026-11-07T10:00:00Z');
test('combined sales use order snapshots, exclude cancelled and pending, and separate COD collection',()=>{
 const live=[{id:'a',created_at:'2026-11-02T10:00:00Z',order_state:'delivered',payment_state:'unpaid',total_paisa:11000,delivery_paisa:1000,snapshot:[{productId:'chair',name:'Chair',quantity:2,unitPricePaisa:5000}]},{id:'b',created_at:'2026-11-03T10:00:00Z',order_state:'cancelled',payment_state:'paid',total_paisa:9000,snapshot:[]},{id:'c',created_at:'2026-11-03T10:00:00Z',order_state:'processing',payment_state:'paid',total_paisa:7000,snapshot:[]}] as StoreOrder[];
 const history=[{id:'h',created:'2026-10-04T10:00:00Z',state:'delivered',total:250,quantity:1,productId:'chair',productName:'Chair'}] as HistoricalRecords['orders'];
 const rows=analyticsOrders(live,history),all=salesAnalytics(rows,'all',now),month=salesAnalytics(rows,'month',now);
 assert.equal(all.sales,35000);assert.equal(all.collected,7000);assert.equal(all.pending,1);assert.equal(all.cancelled,1);assert.equal(all.top[0].units,3);assert.equal(month.sales,10000);assert.equal(month.allSales,35000);assert.equal(month.priorSales,25000);assert.equal(month.growth,-60);
});
test('calendar boundaries are Pakistan time and future rows are excluded',()=>{
 assert.equal(reportMonth(new Date('2026-10-31T20:00:00Z')),'2026-11');
 const rows=analyticsOrders([],[{id:'h',created:'2026-10-31T20:00:00Z',state:'delivered',total:10,quantity:1,productId:'x',productName:'X'},{id:'future',created:'2027-01-01T00:00:00Z',state:'delivered',total:200,quantity:1,productId:'x',productName:'X'}] as HistoricalRecords['orders']);
 assert.equal(salesAnalytics(rows,'month',now).sales,1000);assert.equal(salesAnalytics(rows,'all',now).allSales,1000);
});
test('empty periods have zero sales, no invented growth, and profit requires an explicit valid margin',()=>{
 const empty=salesAnalytics([],'all',now);assert.equal(empty.average,0);assert.equal(empty.growth,null);assert.equal(empty.trend.length,12);
 assert.equal(estimatedGrossProfit(10000,''),null);assert.equal(estimatedGrossProfit(10000,'0'),0);assert.equal(estimatedGrossProfit(10000,'25'),2500);assert.equal(estimatedGrossProfit(10000,'101'),null);assert.equal(estimatedGrossProfit(10000,'invalid'),null);
});
