import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const workflow=JSON.parse(await readFile('n8n/essyra-shopping-support.private.json','utf8'));
assert.equal(workflow.active,false);
assert.equal(workflow.nodes.find(n=>n.type.endsWith('chatTrigger')).parameters.public,false);
const tools=workflow.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequestTool');
assert.equal(tools.length,5);
for(const tool of tools){assert.equal(tool.parameters.method,'GET');assert.equal(new URL(tool.parameters.url).hostname,'zhehksxuzyxnurmhwylw.supabase.co');assert(!tool.credentials);assert(!/service_role|sb_secret/.test(JSON.stringify(tool.parameters)));assert(Number(tool.parameters.queryParameters.parameters.find(p=>p.name==='limit').value)<=6)}
const param=(tool,key)=>tools.find(n=>n.name===tool).parameters.queryParameters.parameters.find(p=>p.name===key).value;
function evaluate(expression,inputs){return Function('$fromAI','return ('+expression.slice(3,-2)+')')((name)=>inputs[name])}
assert.equal(evaluate(param('Browse_By_Budget','and'),{min_pkr:-100,max_pkr:'NaN'}),'(demo_price_paisa.gte.0,demo_price_paisa.lte.10000000000)');
assert.equal(evaluate(param('Browse_By_Budget','order'),{sort:'demo_price_paisa;drop table products'}),'demo_price_paisa.asc,slug.asc');
assert.equal(evaluate(param('Browse_By_Budget','reference->>category'),{room:'bedroom),active.eq.false'}),'in.(living,bedroom,office,dining,kitchen)');
assert.equal(evaluate(param('Compare_Products','slug'),{slugs:'bed,sofa,desk,mirror'}),'in.(bed,sofa,desk)');
assert.equal(evaluate(param('Product_Details','slug'),{slug:'../../orders?owner_id=*'}),'eq.ordersownerid');
assert(!JSON.stringify(workflow).includes('http://localhost'));
console.log('Passed: private trigger, fixed read-only catalogue endpoints, no privileged credential, bounded tool results, numeric budget bounds, safe sort/room enums, exact-slug sanitizing and three-item comparison limit.');
