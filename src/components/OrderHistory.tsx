import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import ReviewForm from './ReviewForm';
import CustomerOrdersTable from './CustomerOrdersTable';
import {checkoutEnabled,customerOrders} from '../lib/checkout';
import type {StoreOrder} from '../lib/checkout';
import {useStore} from '../lib/store';
export default function OrderHistory(){
 const {refreshReviews}=useStore(),[orders,setOrders]=useState<StoreOrder[]>([]),[busy,setBusy]=useState(checkoutEnabled),[error,setError]=useState(''),[reviewOrder,setReviewOrder]=useState<StoreOrder|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement|null>(null);
 const load=async()=>{setBusy(true);setError('');try{setOrders(await customerOrders())}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 useEffect(()=>{if(checkoutEnabled)load()},[]);
 useEffect(()=>{if(!reviewOrder)return;dialog.current?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;opener.current?.focus({preventScroll:true})}},[reviewOrder?.id]);
 const close=()=>{dialog.current?.close();setReviewOrder(null)};
 if(!checkoutEnabled)return <section className="account-section customer-orders-section"><h2>Your orders</h2><p>Order submission has not been activated yet. Your bag and saved designs remain available.</p></section>;
 return <section className="account-section customer-orders-section"><div className="section-heading"><h2>Your orders</h2><button className="text-button" disabled={busy} onClick={load}>{busy?'Refreshing...':'Refresh orders'}</button></div>
 {error&&<p className="error" role="alert">{error}</p>}{!orders.length&&!busy&&!error&&<p>No orders yet. Your submitted orders will appear here.</p>}
 {busy&&!orders.length&&<p role="status">Loading your orders...</p>}
 {!!orders.length&&<CustomerOrdersTable orders={orders} onReview={(order,trigger)=>{opener.current=trigger;setReviewOrder(order)}}/>}
 <dialog className="order-review-dialog" ref={dialog} aria-labelledby="order-review-dialog-title" onCancel={()=>setReviewOrder(null)} onClose={()=>setReviewOrder(null)} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}}}>
 {reviewOrder&&<><div className="order-review-dialog-heading"><div><span className="eyebrow">ESS-{reviewOrder.id.slice(0,8).toUpperCase()}</span><h2 id="order-review-dialog-title">Review your delivery.</h2></div><button className="icon-btn" aria-label="Close review form" onClick={close}><X size={22}/></button></div><ReviewForm allowedSlugs={reviewOrder.snapshot.map(l=>l.productId)} onSubmitted={()=>{refreshReviews().catch(()=>{})}}/></>}
 </dialog></section>;
}
