import {useEffect,useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {Product} from '../types';
import {askAgent,supportAgentEnabled} from '../lib/support-agent';
import ChatAnswer from './ChatAnswer';

export default function DesignAdviser({products,room,budget,quantity,onTry}:{products:Product[];room:string;budget:number;quantity:number;onTry:(product:Product)=>void}){
 const [text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const request=useRef<AbortController|null>(null),conversation=useRef(crypto.randomUUID());
 const key=products.slice(0,3).map(p=>p.id).join(',')+':'+room+':'+budget+':'+quantity;
 useEffect(()=>{request.current?.abort();setText('');setError('');setBusy(false);conversation.current=crypto.randomUUID();return()=>request.current?.abort()},[key]);
 if(!supportAgentEnabled||!products.length)return null;
 async function advise(){
  const controller=new AbortController();request.current=controller;setBusy(true);setError('');
  try{
   const question=('[ESSYRA_STUDIO]\nExplain which of these server-matched pieces suits my '+room+' room and how to coordinate and position it. Budget PKR '+budget+', quantity '+quantity+'. Eligible slugs: '+products.slice(0,3).map(p=>p.id).join(',')+'. Recommend only these slugs; confirm measurements before claiming fit.').slice(0,1000);
   const reply=await askAgent(question,conversation.current,undefined,controller.signal);
   if(!controller.signal.aborted)setText(reply.text);
  }catch{if(!controller.signal.aborted)setError('Your design adviser is unavailable right now. You can still try the matched pieces on your room canvas or retry shortly.')}
  finally{if(!controller.signal.aborted)setBusy(false)}
 }
 return <section className="studio-step design-adviser" aria-labelledby="design-adviser-title">
  <h3 id="design-adviser-title">Your design adviser</h3>
  <p>Get styling and placement advice for your matched pieces. Your room photos stay on this device unless you choose to save them.</p>
  <button className="btn secondary small" disabled={busy} onClick={advise}><Sparkles size={16}/>{busy?'Considering your room…':text?'Refresh design advice':'Ask Design Studio'}</button>
  {busy&&<button className="text-button" onClick={()=>{request.current?.abort();setBusy(false)}}>Stop waiting</button>}
  <div aria-live="polite" aria-busy={busy}>{text&&<ChatAnswer text={text}/>}</div>
  {error&&<p role="alert">{error}</p>}
  {text&&<div className="button-row">{products.slice(0,3).map(p=><button key={p.id} className="btn secondary small" onClick={()=>onTry(p)}>Try {p.name}</button>)}</div>}
 </section>;
}
