export const studioImageOrigin='https://black-forest-labs-flux-2-klein-4b.hf.space';
export function resultImageUrl(value:unknown):string {
 if(typeof value!=='string'||!/^https:\/\/black-forest-labs-flux-2-klein-4b\.hf\.space\/gradio_api\/file=\/tmp\/gradio\/[a-f0-9]{64}\/[a-zA-Z0-9_.-]+$/.test(value))throw Error('INVALID_RESULT_URL');
 return value;
}
export async function boundedBytes(result:Response,max=10*1024*1024):Promise<Uint8Array>{
 if(!result.ok||!result.body||Number(result.headers.get('content-length'))>max)throw Error('IMAGE_FETCH_FAILED');
 const reader=result.body.getReader(),parts:Uint8Array[]=[];let length=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw Error('IMAGE_TOO_LARGE')}parts.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(length);let at=0;for(const part of parts){bytes.set(part,at);at+=part.byteLength}return bytes;
}
export function isWebp(bytes:Uint8Array):boolean{
 if(bytes.length<30)return false;const text=(at:number,n:number)=>String.fromCharCode(...bytes.slice(at,at+n));
 if(text(0,4)!=='RIFF'||text(8,4)!=='WEBP')return false;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(4,true)+8!==bytes.byteLength)return false;
 const kind=text(12,4);let width=0,height=0;
 if(kind==='VP8X'){width=1+bytes[24]+bytes[25]*256+bytes[26]*65536;height=1+bytes[27]+bytes[28]*256+bytes[29]*65536}
 else if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383}
 else if(kind==='VP8L'&&bytes[20]===47){const n=view.getUint32(21,true);width=(n&16383)+1;height=((n>>>14)&16383)+1}
 return width>=100&&height>=100&&width<=2048&&height<=2048;
}
export function imageBase64(bytes:Uint8Array,mime:string):string{
 let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.slice(i,i+16384));
 return 'data:'+mime+';base64,'+btoa(text);
}
