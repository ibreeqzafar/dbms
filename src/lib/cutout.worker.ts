import * as ort from 'onnxruntime-web/wasm';
import {alphaBounds,validCrop} from './cutout-math';
import type {Crop} from './cutout-math';
const MODEL='https://huggingface.co/BritishWerewolf/U-2-Netp/resolve/7112208dbac3a3642496c8d54e2f0f9bb3dc1dc8/onnx/model.onnx';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
let session:Promise<ort.InferenceSession>|undefined;
async function loadModel(id:number){
 const response=await fetch(MODEL);if(!response.ok)throw Error('The extraction model could not download. Please retry.');const total=Number(response.headers.get('Content-Length'))||4570000;const reader=response.body?.getReader();if(!reader)throw Error('Model download is unavailable.');const chunks:Uint8Array[]=[];let loaded=0;for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;self.postMessage({id,status:'progress',message:`Preparing furniture extractor · ${Math.min(99,Math.round(loaded/total*100))}%`})}const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
}
self.onmessage=async(event:MessageEvent<{id:number;blob:Blob;crop:Crop}>)=>{
 const {id,blob}=event.data;let bitmap:ImageBitmap|undefined;
 try{
  bitmap=await createImageBitmap(blob);if(bitmap.width*bitmap.height>20000000)throw Error('This product image is too large to process.');const c=validCrop(event.data.crop),sx=bitmap.width*c.left/100,sy=bitmap.height*c.top/100,sw=bitmap.width*c.width/100,sh=bitmap.height*c.height/100;
  const ratio=Math.min(1,1400/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*ratio)),h=Math.max(1,Math.round(sh*ratio));
  const source=new OffscreenCanvas(w,h),ctx=source.getContext('2d')!;ctx.drawImage(bitmap,sx,sy,sw,sh,0,0,w,h);bitmap.close();bitmap=undefined;
  // The model uses aspect-preserving resize with zero padding to 320 × 320.
  const resize=320/Math.max(w,h),rw=Math.max(1,Math.round(w*resize)),rh=Math.max(1,Math.round(h*resize));const inputCanvas=new OffscreenCanvas(320,320),inputContext=inputCanvas.getContext('2d')!;inputContext.drawImage(source,0,0,w,h,0,0,rw,rh);const pixels=inputContext.getImageData(0,0,320,320).data;
  const tensor=new Float32Array(3*320*320),means=[.485,.456,.406],std=[.229,.224,.225];for(let y=0;y<rh;y++)for(let x=0;x<rw;x++)for(let channel=0;channel<3;channel++){const i=y*320+x;tensor[channel*320*320+i]=(pixels[i*4+channel]/255-means[channel])/std[channel]}
  self.postMessage({id,status:'progress',message:'Extracting the furniture from its background…'});
  session??=loadModel(id).catch(e=>{session=undefined;throw e});const model=await session;const result=await model.run({[model.inputNames[0]]:new ort.Tensor('float32',tensor,[1,3,320,320])});const output=result[model.outputNames[0]],mask=output.data as Uint8Array|Float32Array;
  const maskCanvas=new OffscreenCanvas(320,320),maskContext=maskCanvas.getContext('2d')!,rgba=maskContext.createImageData(320,320);const bytes=output.type==='uint8';let lo=Infinity,hi=-Infinity;if(!bytes)for(const value of mask){lo=Math.min(lo,value);hi=Math.max(hi,value)}for(let i=0;i<320*320;i++){const alpha=bytes?Number(mask[i]):Math.round((Number(mask[i])-lo)/Math.max(hi-lo,.00001)*255);rgba.data[i*4]=rgba.data[i*4+1]=rgba.data[i*4+2]=255;rgba.data[i*4+3]=alpha}maskContext.putImageData(rgba,0,0);
  const alphaCanvas=new OffscreenCanvas(w,h),alphaContext=alphaCanvas.getContext('2d')!;alphaContext.drawImage(maskCanvas,0,0,rw,rh,0,0,w,h);const alpha=alphaContext.getImageData(0,0,w,h).data,original=ctx.getImageData(0,0,w,h);for(let i=0;i<w*h;i++)original.data[i*4+3]=Math.min(original.data[i*4+3],alpha[i*4+3]);ctx.putImageData(original,0,0);
  const bounds=alphaBounds(original.data,w,h);if(!bounds||bounds.coverage>.985)throw Error('The furniture could not be separated clearly. Tighten the focus crop around one item and try again.');const cutout=new OffscreenCanvas(bounds.right-bounds.left,bounds.bottom-bounds.top);cutout.getContext('2d')!.drawImage(source,bounds.left,bounds.top,cutout.width,cutout.height,0,0,cutout.width,cutout.height);self.postMessage({id,status:'done',blob:await cutout.convertToBlob({type:'image/png'})});
 }catch(e){bitmap?.close();self.postMessage({id,status:'error',message:(e as Error).message||'Furniture extraction failed. Please retry.'})}
};
