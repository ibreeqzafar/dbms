import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundedBytes,isWebp,resultImageUrl,studioRecord} from '../../supabase/functions/_shared/studio-image.ts';
test('image RPC records accept object and one-row PostgREST responses',()=>{
 const row={id:'job',state:'queued'};assert.equal(studioRecord(row),row);assert.equal(studioRecord([row]),row);assert.equal(studioRecord([]),null);assert.equal(studioRecord(null),null);
});
test('only the selected image provider and exact temporary file path are accepted',()=>{
 const valid='https://black-forest-labs-flux-2-klein-4b.hf.space/gradio_api/file=/tmp/gradio/'+'a'.repeat(64)+'/image.webp';assert.equal(resultImageUrl(valid),valid);
 for(const value of ['http://localhost/','https://evil.test/image.webp',valid+'?redirect=evil',valid.replace('/image.webp','/../secret'),valid.replace('hf.space/','hf.space.evil/'),null])assert.throws(()=>resultImageUrl(value));
});
test('image downloads reject an oversized stream even without content-length',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(6));c.enqueue(new Uint8Array(6));c.close()}});
 await assert.rejects(boundedBytes(new Response(stream),10),/IMAGE_TOO_LARGE/);
 assert.deepEqual(await boundedBytes(new Response(new Uint8Array([1,2,3])),10),new Uint8Array([1,2,3]));
});
test('WebP output requires its signature, full container length and sane dimensions',()=>{
 const b=new Uint8Array(30);b.set(new TextEncoder().encode('RIFF'),0);new DataView(b.buffer).setUint32(4,22,true);b.set(new TextEncoder().encode('WEBPVP8X'),8);b[24]=255;b[25]=2;b[27]=255;b[28]=2;
 assert.equal(isWebp(b),true);const truncated=b.slice(0,25);assert.equal(isWebp(truncated),false);b[26]=255;assert.equal(isWebp(b),false);assert.equal(isWebp(new Uint8Array(30)),false);
});
