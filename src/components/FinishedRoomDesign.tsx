import {useEffect,useRef,useState} from 'react';
import {Download,Sparkles} from 'lucide-react';
import type {Product} from '../types';
import type {RoomPhoto} from '../lib/photos';
import {requireSession,supabase} from '../lib/supabase';
type Finished={url:string;productName:string;expiresAt:number};
type Job={id:string;state:string;reason?:string;expiresAt:string};
const messages:Record<string,string>={
 IMAGE_WORKER_OFFLINE:'The design service is offline. You can still adjust the room canvas below.',
 IMAGE_PAUSED:'Image generation is paused. You can still adjust the room canvas below.',
 GENERATION_ALREADY_USED:'This selection already has a finished design. Create a new furniture edit to design with another item.',
 IMAGE_ALREADY_PENDING:'Another design is still being prepared. Please wait for it to finish.',
 IMAGE_RETRY_LIMIT:'This selection could not be rendered after several attempts. Please create a new edit later.',
 IMAGE_RATE_LIMIT:'Please wait a little before creating another room design.',
 MATCHED_PRODUCT_REQUIRED:'Choose an item from your latest furniture recommendations first.',
 GENERATION_REQUIRED:'Create a fresh furniture edit before generating a finished room design.'
};
async function pngPhoto(photo:RoomPhoto):Promise<string>{
 if(photo.expiresAt<=Date.now())throw Error('Please upload your room photograph again.');
 const image=await createImageBitmap(photo.blob),canvas=document.createElement('canvas');
 canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d')!.drawImage(image,0,0);image.close();
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('The room photo could not be prepared.')),'image/png'));
 if(blob.size>5*1024*1024)throw Error('Please use a smaller room photograph for image generation.');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('The room photo could not be read.'));reader.readAsDataURL(blob)});
}
export default function FinishedRoomDesign({photo,product,generationKey,paused}:{photo:RoomPhoto|null;product:Product|null;generationKey:string|null;paused:boolean}){
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[finished,setFinished]=useState<Finished|null>(null);
 const pending=useRef<AbortController|null>(null),urlRef=useRef<string|null>(null),owner=useRef<string|null>(null),resume=useRef<{selection:string;job:Job}|null>(null);
 const clearFinished=()=>{if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current=null;setFinished(null);resume.current=null};
 useEffect(()=>{setConsent(false)},[photo?.id]);
 useEffect(()=>{
  const {data}=supabase!.auth.onAuthStateChange((_event,session)=>{if(owner.current&&session?.user.id!==owner.current){pending.current?.abort();clearFinished();owner.current=null}});
  return()=>{data.subscription.unsubscribe();pending.current?.abort();if(urlRef.current)URL.revokeObjectURL(urlRef.current)};
 },[]);
 useEffect(()=>{if(!finished)return;const timer=window.setTimeout(clearFinished,Math.max(0,finished.expiresAt-Date.now()));return()=>window.clearTimeout(timer)},[finished]);
 const generate=async()=>{
  if(busy||!photo||!product||!generationKey||!consent||paused)return;
  const controller=new AbortController();pending.current=controller;setBusy(true);setMessage('Preparing your room photo…');
  const selectedName=product.name,selection=[generationKey,product.id,photo.id].join(':');
  try{
   const session=await requireSession();owner.current=session.user.id;
   const base=import.meta.env.VITE_SUPABASE_URL+'/functions/v1/studio-images';
   const headers={Authorization:'Bearer '+session.access_token,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'};
   const json=async(url:string,options:RequestInit={})=>{const r=await fetch(url,{...options,headers,signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(messages[data.error]||'Your room design could not be completed. Please try again later.');return data as Job};
   let job:Job;
   if(resume.current?.selection===selection)job=resume.current.job;
   else{const roomImage=await pngPhoto(photo);controller.signal.throwIfAborted();job=await json(base,{method:'POST',body:JSON.stringify({generationKey,productSlug:product.id,processingConsent:true,roomImage})});resume.current={selection,job}}
   const deadline=Date.now()+7*60*1000;
   for(;;){
    controller.signal.throwIfAborted();
    if(job.state==='completed')break;
    if(['rejected','failed','expired'].includes(job.state)){resume.current=null;throw Error(job.reason||'Please try another clear room photo.')}
    if(Date.now()>deadline)throw Error('This design is taking longer than expected. You can check it again in a moment.');
    setMessage(job.state==='queued'?'Your design is queued. Free GPU access can take a little longer.':'Checking your room and creating the finished design…');
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,3000);function done(){controller.signal.removeEventListener('abort',abort);resolve()}function abort(){clearTimeout(timer);reject(new DOMException('Stopped','AbortError'))}controller.signal.addEventListener('abort',abort,{once:true})});
    job=await json(base+'?id='+encodeURIComponent(job.id));resume.current={selection,job};
   }
   const r=await fetch(base+'?id='+encodeURIComponent(job.id)+'&image=1',{headers,signal:controller.signal});if(!r.ok)throw Error('The finished design could not be loaded. Please check it again.');
   const blob=await r.blob();if(blob.size>10*1024*1024||blob.type!=='image/webp')throw Error('The finished image could not be displayed.');
   controller.signal.throwIfAborted();const url=URL.createObjectURL(blob);if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current=url;
   setFinished({url,productName:selectedName,expiresAt:Date.parse(job.expiresAt)});setMessage('Your finished design is ready. Adjusting the canvas below will keep this image unchanged.');
  }catch(e){setMessage(controller.signal.aborted?'Stopped waiting. You can check this design again.':(e as Error).message)}
  finally{if(pending.current===controller){pending.current=null;setBusy(false)}}
 };
 return <section className="finished-room-design" aria-labelledby="finished-room-title" aria-busy={busy}>
  <div className="workspace-title"><div><span className="eyebrow">DESIGNED FOR YOUR ROOM</span><h2 id="finished-room-title">Your finished design.</h2></div><Sparkles aria-hidden="true" size={24}/></div>
  {finished?<figure><img src={finished.url} alt={'Finished room design featuring '+finished.productName} width={768} height={768}/><figcaption>{finished.productName} · Finished room design <a className="text-button" href={finished.url} download="essyra-room-design.webp"><Download size={16} aria-hidden="true"/>Save image</a></figcaption></figure>:<p>Choose a recommended piece and add a clear room photo. We’ll compose a finished image with natural placement, perspective and lighting.</p>}
  <p className="muted">{product?'Selected: '+product.name:'Choose a recommended item below.'} One finished image is included with each furniture edit. Please confirm measurements before ordering.</p>
  <label className="check-label"><input type="checkbox" checked={consent} disabled={busy||!photo} onChange={e=>setConsent(e.target.checked)}/>I agree to send this room photo to Groq for room validation and Hugging Face’s FLUX demo for image editing. Photos and results are kept privately in ESSYRA for up to 24 hours; the external demo also processes temporary copies. Use a room photo without people or private details.</label>
  <div className="button-row"><button className="btn" disabled={busy||!photo||!product||!generationKey||!consent||paused} onClick={generate}>{busy?'Preparing your design…':resume.current?'Check this design':'Create finished design'}<Sparkles size={16} aria-hidden="true"/></button>{busy&&<button className="text-button" onClick={()=>pending.current?.abort()}>Stop waiting</button>}</div>
  {!photo&&<p className="muted">Add a room photograph above to begin.</p>}
  {message&&<p role="status" aria-live="polite" className="fit-note">{message}</p>}
 </section>;
}
