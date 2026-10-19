import {supabase} from './supabase';
export const checkoutEnabled=import.meta.env.VITE_ORDER_SUBMISSION_ENABLED==='true';
import type {CartLine} from '../types';
export type CustomerDetails={name:string;phone:string;city:string;address:string;notes:string};
export type StoreOrder={id:string;owner_id:string;customer_name:string;phone:string;city:string;delivery_address:string;payment_method:'cod'|'online';payment_state:'unpaid'|'paid';order_state:'received'|'processing'|'dispatched'|'delivered'|'cancelled';total_paisa:number;delivery_paisa:number|null;carrier:string;tracking_number:string;created_at:string;snapshot:{productId:string;name:string;variant:string;quantity:number;unitPricePaisa:number}[]};
export async function submitOrder(lines:CartLine[],customer:CustomerDetails,method:'cod'|'online',total:number){
 if(!checkoutEnabled||!supabase)throw Error('Checkout is temporarily unavailable. Please try again later.');
 const payload=JSON.stringify({lines,customer,method,total});
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const storageKey='essyra:order-request:'+hash;let key=sessionStorage.getItem(storageKey);if(!key){key=crypto.randomUUID();sessionStorage.setItem(storageKey,key)}
 const {data,error}=await supabase.rpc('place_store_order',{p_key:key,p_lines:lines,p_customer:customer,p_method:method,p_total:Math.round(total*100)});
 if(error)throw Error(error.code==='PGRST202'?'Checkout is being updated. Your bag is saved; please try again shortly.':error.message);
 return data as StoreOrder;
}
export async function customerOrders(){if(!supabase)return [];const {data:{user}}=await supabase.auth.getUser();if(!user)throw Error('Sign in to view your orders.');const {data,error}=await supabase.from('store_orders').select('*').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(50);if(error)throw Error(error.message);return data as StoreOrder[]}
export async function startPayment(orderId:string){if(!supabase)throw Error('Payment service unavailable.');const {data,error}=await supabase.functions.invoke('store-payments',{body:{action:'checkout',orderId}});if(error)throw Error('Online payment could not start. Your unpaid order remains in your account; please retry.');const url=new URL(data.url);if(url.protocol!=='https:'||!['getsafepay.com','sandbox.api.getsafepay.com','api.getsafepay.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw Error('Payment destination could not be verified.');return url.href}
export async function verifyPayment(orderId:string){if(!supabase)return;const {error}=await supabase.functions.invoke('store-payments',{body:{action:'verify',orderId}});if(error)throw Error('Payment verification is pending. Refresh your orders shortly.');}
