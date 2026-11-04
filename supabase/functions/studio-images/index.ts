import {PNG} from 'npm:pngjs@7.0.0';
import {cors,endpoint,identity,response,service} from '../_shared/http.ts';
import {supportInput} from '../_shared/support-input.ts';
import {fetchCatalogueImage} from '../_shared/catalogue-image.ts';
import {boundedBytes,imageBase64,isWebp,resultImageUrl} from '../_shared/studio-image.ts';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function workerKey(req:Request){
 const expected=Deno.env.get('N8N_SUPPORT_WORKER_KEY'),received=req.headers.get('x-essyra-worker-key')||'';
 if(!expected||expected.length<32||received.length>512)return false;
 const digest=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
 const [a,b]=await Promise.all([digest(expected),digest(received)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
const visible=(j:any)=>({id:j.id,state:j.state,reason:j.reason,productSlug:j.product_slug,expiresAt:j.expires_at});
Deno.serve(endpoint(async req=>{
 const db=service();
 if(req.headers.has('x-essyra-worker-key')){
  if(req.method!=='POST'||!await workerKey(req))return response({error:'UNAUTHORIZED'},401);
  const p=await supportInput(req,24000);
  if(p.action==='lease'){
   // Clean expired private objects when the laptop is running; expiry is enforced even while offline.
   const {data:expired}=await db.from('studio_image_jobs').select('id,source_object,source_history,result_object').lt('expires_at',new Date().toISOString()).is('cleaned_at',null).limit(10);
   for(const j of expired||[]){const keys=[j.source_object,...(j.source_history||[]),j.result_object].filter(Boolean);const {error}=await db.storage.from('studio-images').remove(keys);if(!error)await db.from('studio_image_jobs').update({state:'expired',cleaned_at:new Date().toISOString()}).eq('id',j.id)}
   const {data:j,error}=await db.rpc('lease_studio_image');if(error)throw error;if(!j?.id)return response({job:null});
   try{
    const {data:profile}=await db.from('profiles').select('active').eq('id',j.owner_id).single();
    const {data:product}=await db.from('products').select('reference').eq('slug',j.product_slug).eq('active',true).single();
    if(!profile?.active||!product?.reference?.referenceImage)throw Error('IMAGE_INPUT_UNAVAILABLE');
    const {data:source,error:sourceError}=await db.storage.from('studio-images').download(j.source_object);if(sourceError||!source)throw Error('IMAGE_INPUT_UNAVAILABLE');
    const image=await fetchCatalogueImage(product.reference.referenceImage);if(image.bytes.byteLength>5*1024*1024)throw Error('PRODUCT_IMAGE_TOO_LARGE');
    const room=new Uint8Array(await source.arrayBuffer());if(room.length>5*1024*1024)throw Error('IMAGE_INPUT_UNAVAILABLE');
    return response({job:{id:j.id,leaseToken:j.lease_token,processingConsent:true,productSlug:j.product_slug,productName:String(product.reference.name||'Catalogue furniture').slice(0,100),roomImage:imageBase64(room,'image/png'),productImage:imageBase64(image.bytes,image.type)}});
   }catch{await db.from('studio_image_jobs').update({state:'failed',reason:'The room or selected product photo is no longer available.',lease_token:null,lease_until:null}).eq('id',j.id).eq('lease_token',j.lease_token);return response({job:null})}
  }
  if(p.action!=='complete'||!uuid(p.jobId)||!uuid(p.leaseToken))return response({error:'INVALID_REQUEST'},422);
  const {data:j}=await db.from('studio_image_jobs').select('*').eq('id',p.jobId).eq('state','running').eq('lease_token',p.leaseToken).gt('lease_until',new Date().toISOString()).gt('expires_at',new Date().toISOString()).single();
  if(!j)return response({accepted:false},409);
  const {data:profile}=await db.from('profiles').select('active').eq('id',j.owner_id).single();if(!profile?.active)return response({accepted:false},403);
  let state=p.status==='rejected'?'rejected':'failed',reason=state==='rejected'?'Please upload a clear room photograph showing a suitable placement area.':'The free image service could not finish this design. Please try later.',key:string|null=null;
  if(p.status==='rejected'&&typeof p.reason==='string')reason=p.reason.replace(/[\u0000-\u001f]/g,' ').slice(0,220);
  if(p.status==='completed'){
   const url=resultImageUrl(p.imageUrl);const data=await boundedBytes(await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)}));
   if(!isWebp(data))throw Error('INVALID_RESULT_IMAGE');
   key=`${j.owner_id}/${j.id}/${crypto.randomUUID()}.webp`;
   const {error}=await db.storage.from('studio-images').upload(key,data,{contentType:'image/webp',upsert:false});if(error)throw error;
   state='completed';reason='';
  }
  const {data:updated,error}=await db.from('studio_image_jobs').update({state,reason:reason||null,result_object:key,lease_token:null,lease_until:null}).eq('id',j.id).eq('state','running').eq('lease_token',j.lease_token).gt('lease_until',new Date().toISOString()).select('id');
  if(error||!updated?.length){if(key)await db.storage.from('studio-images').remove([key]);return response({accepted:false},409)}
  return response({accepted:true});
 }
 const {user}=await identity(req);
 if(req.method==='GET'){
  const url=new URL(req.url),id=url.searchParams.get('id');if(!uuid(id))return response({error:'JOB_REQUIRED'},422);
  const {data:j}=await db.from('studio_image_jobs').select('*').eq('id',id).eq('owner_id',user.id).gt('expires_at',new Date().toISOString()).single();if(!j)return response({error:'NOT_FOUND'},404);
  if(url.searchParams.get('image')!=='1')return response(visible(j));
  if(j.state!=='completed'||!j.result_object)return response({error:'IMAGE_NOT_READY'},409);
  const {data,error}=await db.storage.from('studio-images').download(j.result_object);if(error||!data)return response({error:'NOT_FOUND'},404);
  return new Response(data,{headers:{...cors,'Content-Type':'image/webp','X-Content-Type-Options':'nosniff'}});
 }
 if(req.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 const p=await supportInput(req,7_500_000);
 if(p.processingConsent!==true||!uuid(p.generationKey)||typeof p.productSlug!=='string'||!/^[a-z0-9][a-z0-9-]{2,150}$/.test(p.productSlug))return response({error:'CONSENT_AND_MATCH_REQUIRED'},422);
 if(typeof p.roomImage!=='string'||p.roomImage.length>7_000_000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.roomImage))return response({error:'CANONICAL_PNG_REQUIRED'},422);
 const {data:allowed,error:limitError}=await db.rpc('guard_studio_request',{p_owner:user.id});if(limitError||allowed!==true)return response({error:'IMAGE_RATE_LIMIT'},429);
 // Check the owner/matched product before decoding or storing their photograph.
 const {data:g}=await db.from('recommendation_generations').select('id,results').eq('owner_id',user.id).eq('request_key',p.generationKey).gt('created_at',new Date(Date.now()-86400000).toISOString()).single();
 if(!g||!Array.isArray(g.results)||!g.results.some((r:any)=>r.product?.id===p.productSlug))return response({error:'MATCHED_PRODUCT_REQUIRED'},403);
 const {data:health}=await db.from('studio_worker_health').select('seen_at').eq('id',true).single();if(!health||Date.now()-Date.parse(health.seen_at)>60000)return response({error:'IMAGE_WORKER_OFFLINE'},503);
 const raw=Uint8Array.from(atob(p.roomImage.split(',')[1]),c=>c.charCodeAt(0));
 if(raw.byteLength>5*1024*1024||raw.length<24||raw[0]!==137||raw[1]!==80||raw[2]!==78||raw[3]!==71)return response({error:'INVALID_PHOTO'},422);
 const view=new DataView(raw.buffer),width=view.getUint32(16),height=view.getUint32(20);if(width<100||height<100||width>1800||height>1800)return response({error:'INVALID_PHOTO_SIZE'},422);
 const decoded=PNG.sync.read(raw);const clean=PNG.sync.write(decoded,{colorType:6});if(clean.length>5*1024*1024)return response({error:'PHOTO_TOO_LARGE'},413);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',clean)),n=>n.toString(16).padStart(2,'0')).join('');
 const key=`${user.id}/${p.generationKey}/${hash}.png`;
 const upload=await db.storage.from('studio-images').upload(key,clean,{contentType:'image/png',upsert:false});
 if(upload.error&&(!('statusCode' in upload.error)||String(upload.error.statusCode)!=='409'))throw upload.error;
 const {data:j,error}=await db.rpc('queue_studio_image',{p_owner:user.id,p_generation_key:p.generationKey,p_slug:p.productSlug,p_object:key,p_hash:hash});
 if(error){if(!upload.error)await db.storage.from('studio-images').remove([key]);const code=['IMAGE_WORKER_OFFLINE','IMAGE_PAUSED','GENERATION_ALREADY_USED','IMAGE_ALREADY_PENDING','IMAGE_RETRY_LIMIT','IMAGE_RATE_LIMIT','MATCHED_PRODUCT_REQUIRED','GENERATION_REQUIRED'].find(c=>error.message.includes(c));return response({error:code||'IMAGE_QUEUE_REJECTED'},code==='IMAGE_WORKER_OFFLINE'||code==='IMAGE_PAUSED'?503:409)}
 return response(visible(j),202);
}));
