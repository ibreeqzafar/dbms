import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const products=JSON.parse(await readFile('src/data/catalogue.json','utf8'));
assert(products.length>=500,'At least 500 references required');
assert.equal(new Set(products.map(p=>p.id)).size,products.length);
assert.equal(new Set(products.map(p=>p.sourceUrl)).size,products.length);
for(const p of products){assert(new URL(p.sourceUrl).hostname==='www.ikea.com');assert(new URL(p.referenceImage).hostname==='www.ikea.com');assert(p.materials.length);assert(p.colors.length);assert(!/^sofa\s*\d+$/i.test(p.name));assert(Number.isInteger(p.demoStock)&&p.demoStock>=0);assert(p.demoPricePKR>0);for(const d of Object.values(p.dimensions))assert(typeof d==='number'&&d>0)}
for(const room of ['living','bedroom','office','dining','kitchen'])assert(products.filter(p=>p.category===room).length>=30);
console.log(`Verified ${products.length} unique sourced products, images, materials, valid dimensions, five room categories and separated demo fields.`);
