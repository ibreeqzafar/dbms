import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareProducts,summarizeReviews} from './reviews.ts';
import type {Product} from '../types.ts';
import type {CatalogueReview} from './reviews.ts';
const product=(id:string,price:number,name=id)=>({id,name,demoPricePKR:price} as Product);
const review=(id:string,rating:number)=>({product_slug:id,rating} as CatalogueReview);
test('price order and relevance do not depend on catalogue position',()=>{const a=product('a',12000,'Oak desk'),b=product('b',9000,'Desk organiser');assert(compareProducts(a,b,'price-asc','',{})>0);assert(compareProducts(a,b,'price-desc','',{})<0);assert(compareProducts(a,b,'relevance','Oak desk',{})<0)});
test('popularity balances rating quality and volume, and leaves unrated items below reviewed products',()=>{const stats=summarizeReviews([review('single',5),...Array.from({length:15},(_,i)=>review('established',i<8?5:4))]);assert(stats.established.score>stats.single.score);assert.equal(stats.established.distribution[3],7);assert.equal(stats.established.distribution[4],8);assert.equal(stats.single.count,1);assert(compareProducts(product('established',10),product('none',1),'popular','',stats)<0)});
