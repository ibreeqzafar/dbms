export async function supportInput(req:Request,maxBytes:number){
 const length=req.headers.get('content-length');if(length&&Number(length)>maxBytes)throw Error('INPUT_TOO_LARGE');
 if(!req.body)throw Error('INVALID_INPUT');const reader=req.body.getReader();const parts:Uint8Array[]=[];let total=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw Error('INPUT_TOO_LARGE')}parts.push(value)}}finally{reader.releaseLock()}
 const data=new Uint8Array(total);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.byteLength}
 return JSON.parse(new TextDecoder().decode(data));
}
