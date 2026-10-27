import assert from 'node:assert/strict';
const base='https://zhehksxuzyxnurmhwylw.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_q02Wju3GP1fbDexo8zjrRA__IJl7Z20'};
const select='name,slug,demo_price_paisa,reference,variants(color,price_paisa,stock_on_hand,stock_reserved,active)';
async function get(table,params){const url=new URL(base+table);url.search=new URLSearchParams(params);const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,`${table} public lookup`);return response.json()}
const search=await get('products',{select,active:'eq.true',search_document:'wfts(simple).bed',limit:'6'});
assert(search.length>0&&search.length<=6);assert(search.every(p=>p.slug&&Number.isFinite(p.demo_price_paisa)&&Array.isArray(p.variants)));
const browse=await get('products',{select,active:'eq.true',and:'(demo_price_paisa.gte.1000000,demo_price_paisa.lte.20000000)','reference->>category':'eq.bedroom',order:'demo_price_paisa.asc,slug.asc',limit:'6'});
assert(browse.length>0&&browse.every(p=>p.reference.category==='bedroom'&&p.demo_price_paisa>=1000000&&p.demo_price_paisa<=20000000));assert(browse.every((p,i)=>i===0||p.demo_price_paisa>=browse[i-1].demo_price_paisa));
const one=await get('products',{select,active:'eq.true',slug:'eq.'+search[0].slug,limit:'1'});assert.equal(one[0].slug,search[0].slug);
const slugs=search.slice(0,3).map(p=>p.slug);const compare=await get('products',{select,active:'eq.true',slug:'in.('+slugs.join(',')+')',limit:'3'});assert.equal(compare.length,slugs.length);assert(compare.every(p=>slugs.includes(p.slug)));
const policies=await get('settings',{select:'policies:value->policies',id:'eq.public',limit:'1'});assert(Array.isArray(policies[0]?.policies));
console.log('Passed five live read-only catalogue/policy requests: keyword search, room/budget sorted browsing, exact product, three-product comparison and public policies. No customer data or mutations.');
