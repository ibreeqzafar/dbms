import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mkdir,writeFile} from 'node:fs/promises';
// Original representation, not a retailer model. No textures or external files.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:application/octet-stream;base64,'+Buffer.from(v).toString('base64');this.onloadend?.()})}};
const group=new THREE.Group();group.name='ESSYRA original approximate sofa';
const geometries=new Map(),materials=new Map();function box(x,y,z,w,h,d,color,rounded=true){const key=[w,h,d,rounded].join(':');if(!geometries.has(key))geometries.set(key,rounded?new RoundedBoxGeometry(w,h,d,1,.06):new THREE.BoxGeometry(w,h,d));if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));const mesh=new THREE.Mesh(geometries.get(key),materials.get(color));mesh.position.set(x,y,z);group.add(mesh)}
box(0,.35,0,3.6,.5,1.45,'#bcb29f');box(0,.96,-.61,3.6,.95,.3,'#c4bba8');
for(const x of [-1.66,1.66])box(x,.8,0,.3,.95,1.48,'#c4bba8');
for(const x of [-1.02,0,1.02]){box(x,.7,.02,.98,.24,1.14,'#d6cdb9');box(x,1.03,-.42,.93,.64,.22,'#cec4af')}
for(const x of [-1.4,1.4])for(const z of [-.48,.48])box(x,.08,z,.1,.16,.1,'#68573f',false);
const output=await new GLTFExporter().parseAsync(group,{binary:true});await mkdir('public/models',{recursive:true});await writeFile('public/models/essyra-sofa.glb',Buffer.from(output));console.log(`Original approximate sofa GLB: ${output.byteLength} bytes.`);
