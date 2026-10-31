import {test} from 'node:test';import assert from 'node:assert/strict';
import {featuredProducts} from './featured-products.ts';
import type {Product} from '../types.ts';
const p=(id:string,extra:Partial<Product>={})=>({id,name:id,active:true,demoStock:5,referenceImage:'image.jpg',demoPricePKR:100,style:'modern',...extra} as Product);
test('product edits use recorded rankings, keep sales accurate and omit unavailable products',()=>{
 const products=[p('normal'),p('ten',{saleOriginalPrice:100,demoPricePKR:90}),p('forty',{saleOriginalPrice:100,demoPricePKR:60}),p('sold'),p('inactive',{active:false,saleOriginalPrice:100,demoPricePKR:60}),p('empty',{demoStock:0})];
 const stats={normal:{count:7,average:4,score:4.5,distribution:[0,0,0,7,0]},sold:{count:2,average:5,score:4.2,distribution:[0,0,0,0,2]}};
 assert.deepEqual(featuredProducts(products,stats,[],'sale').map(p=>p.id),['forty','ten']);
 assert.deepEqual(featuredProducts(products,stats,[],'reviewed').map(p=>p.id),['normal','sold']);
 assert.deepEqual(featuredProducts(products,stats,['inactive','sold'],'sold').map(p=>p.id),['sold']);
 assert.equal(featuredProducts(products,{},[],'popular').length,0);assert.equal(featuredProducts(products,stats,['sold'],'popular')[0].id,'normal');
 const featured=featuredProducts(products,stats,['sold'],'featured');assert.equal(new Set(featured.map(p=>p.id)).size,featured.length);assert.ok(featured.every(p=>p.active&&p.demoStock>0));
});
