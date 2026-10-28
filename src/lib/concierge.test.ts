import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerSupport} from './concierge.ts';
import type {Product,Settings} from '../types.ts';
const p:Product={id:'chair-grey',name:'Lounge Chair',brand:'ESSYRA',category:'living',subcategory:'Armchair',description:'A chair',colors:['grey'],materials:['wood'],dimensions:{width:70,depth:80,height:90},demoPricePKR:25000,demoStock:4,sourceUrl:'',referenceImage:null,style:'modern',tags:[]};
const settings:Settings={recommendationsPaused:false,previewsPaused:false,supportPaused:false,checkoutPaused:true,policies:[{id:'delivery',title:'Delivery',body:'Delivery timing is confirmed before dispatch.'}]};
test('concierge responds to greetings and stays scoped for unrelated subjects',()=>{assert.match(answerSupport('hello!',[],settings).text,/Hello/);assert.match(answerSupport('how are you',[],settings).text,/help/);assert.match(answerSupport('thanks',[],settings).text,/welcome/);assert.match(answerSupport('solve quantum mechanics',[],settings).text,/outside ESSYRA/)});
test('product price questions resolve before generic price help and use current product context',()=>{assert.deepEqual(answerSupport('what is the price of Lounge Chair',[p],settings).products,[p]);assert.match(answerSupport('what does this cost',[p],settings,p.id).text,/25,000/)});
test('ambiguous names require an exact product choice; chat never submits orders',()=>{const second={...p,id:'chair-white',colors:['white']};const r=answerSupport('order 2 Lounge Chair',[p,second],settings);assert.equal(r.products?.length,2);assert.equal(r.quantity,2);assert.equal(r.checkout,undefined);assert.equal(answerSupport('checkout',[p],settings).checkout,true)});
test('delivery answers use approved policy and inactive payments are not claimed live',()=>{assert.match(answerSupport('when does it arrive',[],settings).text,/confirmed before dispatch/);assert.match(answerSupport('online payment',[],settings).text,/not being accepted/);assert.equal(answerSupport('my order status',[],settings).orders,true)});

test('budget search excludes pieces above the stated ceiling',()=>{const expensive={...p,id:'chair-high',demoPricePKR:90000};const r=answerSupport('show chair under 30000',[p,expensive],settings);assert.deepEqual(r.products,[p])});

test('bed budget requests exclude bedside furniture and recognise PKR',()=>{const bed={...p,id:'wood-bed',name:'Wood Bed',category:'bedroom' as const,subcategory:'Beds',demoPricePKR:100000};const bedside={...bed,id:'bedside-table',name:'Bedside Table',subcategory:'Bedside tables',demoPricePKR:5000};const expensive={...bed,id:'high-bed',demoPricePKR:200000};const result=answerSupport('Show beds under PKR 150000',[bed,bedside,expensive],settings);assert.deepEqual(result.products,[bed])});
