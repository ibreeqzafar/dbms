import Safepay from 'npm:@sfpy/node-core@0.3.6';
import {endpoint,identity,input,response,service} from '../_shared/http.ts';

function gateway(){
 const secret=Deno.env.get('SAFEPAY_SECRET_KEY'),apiKey=Deno.env.get('SAFEPAY_API_KEY'),webhookSecret=Deno.env.get('SAFEPAY_WEBHOOK_SECRET');
 if(!secret||!apiKey||!webhookSecret||Deno.env.get('SAFEPAY_ENVIRONMENT')!=='production')throw Error('PAYMENTS_NOT_CONFIGURED');
 return {sdk:Safepay(secret,{authType:'secret',host:'https://api.getsafepay.com'}),apiKey,webhookSecret};
}
async function verifyTracker(tracker:string){
 const db=service(),{sdk,apiKey}=gateway();
 const {data:session,error:sessionError}=await db.from('store_payment_sessions').select('id,order_id').eq('tracker',tracker).single();if(sessionError||!session)throw Error('UNKNOWN_PAYMENT');
 const {data:order,error:orderError}=await db.from('store_orders').select('id,payment_method,total_paisa').eq('id',session.order_id).single();if(orderError||!order||order.payment_method!=='online')throw Error('INVALID_ORDER');
 const report=await sdk.reporter.payments.fetch(tracker);const t=report.data?.tracker;
 // Never trust browser return parameters or a webhook amount without fetching the bound tracker.
 if(t?.token!==tracker||t.client!==apiKey||t.mode!=='payment'||t.purchase_totals?.quote_amount?.currency!=='PKR'||Number(t.purchase_totals?.quote_amount?.amount)!==Number(order.total_paisa))throw Error('PAYMENT_MISMATCH');
 if(t.state!=='TRACKER_ENDED')return {paid:false};
 const updated=await db.from('store_orders').update({payment_state:'paid',updated_at:new Date().toISOString()}).eq('id',order.id).eq('payment_method','online');if(updated.error)throw updated.error;
 const recorded=await db.from('store_payment_sessions').update({state:'verified',updated_at:new Date().toISOString()}).eq('id',session.id);if(recorded.error)throw recorded.error;
 return {paid:true};
}

Deno.serve(endpoint(async req=>{
 if(req.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 const webhook=new URL(req.url).searchParams.get('webhook')==='1';
 if(webhook){
  const raw=await req.text();if(raw.length>64000)return response({error:'INPUT_TOO_LARGE'},413);
  const {sdk,webhookSecret,apiKey}=gateway();let event;
  try{event=sdk.webhooks.constructEvent(raw,req.headers.get('X-SFPY-SIGNATURE')||'',webhookSecret)}catch{return response({error:'INVALID_SIGNATURE'},401)}
  if(event.type!=='payment.succeeded')return response({received:true,ignored:true});
  if(event.merchant_api_key!==apiKey||typeof event.data?.tracker!=='string')return response({error:'INVALID_MERCHANT'},400);
  await verifyTracker(event.data.tracker);return response({received:true});
 }
 const {client,user}=await identity(req);if(user.is_anonymous)return response({error:'SIGN_IN_REQUIRED'},401);
 const body=await input(req,2000);if(!['checkout','verify'].includes(body.action)||typeof body.orderId!=='string'||! /^[0-9a-f-]{36}$/i.test(body.orderId))return response({error:'INVALID_REQUEST'},422);
 const {data:order,error}=await client.from('store_orders').select('id,total_paisa,payment_method,payment_state,order_state').eq('id',body.orderId).eq('owner_id',user.id).single();
 if(error||!order)return response({error:'ORDER_NOT_FOUND'},404);
 if(order.payment_method!=='online')return response({error:'NOT_AN_ONLINE_ORDER'},409);
 const db=service();const {data:existing}=await db.from('store_payment_sessions').select('id,tracker,state,created_at').eq('order_id',order.id).in('state',['creating','ready','verified']).maybeSingle();
 if(body.action==='verify'){if(!existing?.tracker)return response({paid:false});return response(await verifyTracker(existing.tracker))}
 if(order.payment_state==='paid'||order.order_state==='cancelled')return response({error:'ORDER_NOT_PAYABLE'},409);
 const {data:config}=await client.from('settings').select('value').eq('id','public').single();if(!config?.value.onlinePaymentsEnabled||config.value.checkoutPaused)return response({error:'PAYMENTS_UNAVAILABLE'},503);
 const {sdk,apiKey}=gateway();let tracker=existing?.tracker;
 if(existing&&!tracker)return response({error:'PAYMENT_INITIALISING',message:'Please contact support if this persists.'},409);
 if(!existing){
  const {data:reserved,error:reserveError}=await db.from('store_payment_sessions').insert({order_id:order.id}).select('id').single();if(reserveError)return response({error:'PAYMENT_ALREADY_STARTING'},409);
  // Keep an uncertain network outcome locked rather than risking a second chargeable tracker.
  const created=await sdk.payments.session.setup({merchant_api_key:apiKey,intent:'CYBERSOURCE',mode:'payment',entry_mode:'raw',currency:'PKR',amount:Number(order.total_paisa),metadata:{order_id:order.id,source:'essyra'},include_fees:false});
  tracker=created.data?.tracker?.token;if(typeof tracker!=='string')throw Error('INVALID_GATEWAY_RESPONSE');
  const saved=await db.from('store_payment_sessions').update({tracker,state:'ready',updated_at:new Date().toISOString()}).eq('id',reserved.id);if(saved.error)throw saved.error;
 }
 // A retry reuses the same tracker but obtains a fresh short-lived checkout token.
 const auth=await sdk.auth.passport.create();if(typeof auth.data!=='string')throw Error('INVALID_GATEWAY_RESPONSE');
 const origin=Deno.env.get('SITE_ORIGIN')||'https://essyra-home.quietibex64.chatgpt.site';
 const url=sdk.checkouts.payment.create({tracker,tbt:auth.data,environment:'production',source:'hosted',redirect_url:origin+'/account?payment=return&order='+order.id,cancel_url:origin+'/account?payment=cancel&order='+order.id});
 return response({url});
}));
