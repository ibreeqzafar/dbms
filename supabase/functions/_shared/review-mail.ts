// Called only after support-worker has checked its private connection key.
// The laptop sees status only; registered email addresses stay on this server.
import {service} from './http.ts';
export async function sendNextReviewInvitation(){
 const key=Deno.env.get('BREVO_API_KEY'),sender=Deno.env.get('REVIEW_EMAIL_SENDER');
 if(Deno.env.get('REVIEW_EMAIL_ENABLED')!=='true'||!key||!sender)return {configured:false,sent:false};
 const client=service();const {data:job,error}=await client.rpc('lease_review_email');if(error)throw Error('REVIEW_QUEUE_UNAVAILABLE');
 if(!job)return {configured:true,sent:false};
 const finish=async(provider:string|null,code:string|null)=>{const {error}=await client.rpc('finish_review_email',{p_order:job.orderId,p_lease:job.leaseToken,p_provider:provider,p_error:code});if(error)throw Error('REVIEW_STATUS_UNAVAILABLE')};
 const slugs=(Array.isArray(job.slugs)?job.slugs:[]).filter((s:unknown)=>typeof s==='string'&&/^[a-z0-9-]{1,250}$/.test(s)).slice(0,50);
 if(!slugs.length){await finish(null,'NO_ELIGIBLE_PRODUCTS');return {configured:true,sent:false}}
 const links=slugs.map((s:string)=>'https://essyra-home.vercel.app/product/'+s+'#reviews');
 try{
  const result=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'Content-Type':'application/json'},body:JSON.stringify({sender:{name:'ESSYRA',email:sender},to:[{email:job.email}],replyTo:{name:'ESSYRA Customer Care',email:'essyra.furniture@gmail.com'},subject:'How was your ESSYRA order?',textContent:'Your ESSYRA order '+String(job.orderId).slice(0,8).toUpperCase()+' has been marked delivered. We would love your honest feedback—positive or negative. Sign in to the account you ordered with and choose a star rating and write your review:\n\n'+links.join('\n')+'\n\nIf your delivery has not arrived or you need help, contact essyra.furniture@gmail.com or 03172197499. This is a single service message about your order; no promotion is included.',headers:{idempotencyKey:String(job.orderId)}}),signal:AbortSignal.timeout(15000)});
  if(!result.ok){await finish(null,'EMAIL_PROVIDER_'+result.status);return {configured:true,sent:false,failed:true}}
  const accepted=await result.json();await finish(String(accepted.messageId||'accepted'),null);return {configured:true,sent:true};
 }catch{await finish(null,'EMAIL_DELIVERY_UNCERTAIN');return {configured:true,sent:false,failed:true}}
}
