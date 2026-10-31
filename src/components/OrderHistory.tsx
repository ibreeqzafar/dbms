import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Star,X} from 'lucide-react';
import ReviewForm from './ReviewForm';
import {checkoutEnabled,customerOrders} from '../lib/checkout';
import type {StoreOrder} from '../lib/checkout';
import {money} from '../lib/domain';
import {useStore} from '../lib/store';
import {canReviewOrder,orderStatusLabel} from '../lib/order-presentation';
export default function OrderHistory(){
 const {refreshReviews}=useStore(),[orders,setOrders]=useState<StoreOrder[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewOrder,setReviewOrder]=useState<StoreOrder|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement|null>(null);
 const load=async()=>{setBusy(true);setError('');try{setOrders(await customerOrders())}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 useEffect(()=>{if(checkoutEnabled)load()},[]);
 useEffect(()=>{if(!reviewOrder)return;dialog.current?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;opener.current?.focus({preventScroll:true})}},[reviewOrder?.id]);
 const close=()=>{dialog.current?.close();setReviewOrder(null)};
 if(!checkoutEnabled)return <section className="account-section"><h2>Your orders.</h2><p>Order submission has not been activated yet. Your bag and saved designs remain available.</p></section>;
 return <section className="account-section"><div className="section-heading"><h2>Your orders.</h2><button className="text-button" disabled={busy} onClick={load}>{busy?'Refreshing...':'Refresh orders'}</button></div>
 {error&&<p className="error" role="alert">{error}</p>}{!orders.length&&!busy&&!error&&<p>No orders yet. Your submitted orders will appear here.</p>}
 {orders.map(o=><article className="customer-order-card" key={o.id}><details className="order"><summary><span>ESS-{o.id.slice(0,8).toUpperCase()}</span><span>{new Date(o.created_at).toLocaleDateString()}</span><strong>{money(o.total_paisa/100)}</strong><span>{orderStatusLabel(o.order_state)}</span></summary><p>Payment: {o.payment_state==='paid'?'Paid':o.payment_method==='cod'?'Due on delivery':'Unpaid'} · {o.payment_method==='cod'?'Cash on delivery':'Online payment'}</p><p>Delivery charge: {o.delivery_paisa===null?'To be confirmed before dispatch':money(o.delivery_paisa/100)}</p>{o.snapshot.map((l,i)=><div className="order-line" key={i}><Link to={'/product/'+l.productId}>{l.name} · {l.variant} × {l.quantity}</Link><strong>{money(l.unitPricePaisa*l.quantity/100)}</strong></div>)}{o.carrier&&<p>Carrier: {o.carrier} · Tracking: {o.tracking_number||'Pending'}</p>}</details>
 <div className="order-feedback-action">{canReviewOrder(o)?<><span>How was your delivery?</span><button className="btn" onClick={e=>{opener.current=e.currentTarget;setReviewOrder(o)}}><Star size={17}/>Write a review</button></>:o.order_state==='cancelled'?<span>This order was cancelled.</span>:<><p>Reviews unlock when delivery is confirmed by the store. Placing an order does not mark it delivered.</p><Link className="text-link" to="/contact">Already received it? Contact customer care</Link></>}</div></article>)}
 <dialog className="order-review-dialog" ref={dialog} aria-labelledby="order-review-dialog-title" onCancel={()=>setReviewOrder(null)} onClose={()=>setReviewOrder(null)} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}}}>
 {reviewOrder&&<><div className="order-review-dialog-heading"><div><span className="eyebrow">ESS-{reviewOrder.id.slice(0,8).toUpperCase()}</span><h2 id="order-review-dialog-title">Review your delivery.</h2></div><button className="icon-btn" aria-label="Close review form" onClick={close}><X size={22}/></button></div><ReviewForm allowedSlugs={reviewOrder.snapshot.map(l=>l.productId)} onSubmitted={()=>{refreshReviews().catch(()=>{})}}/></>}
 </dialog></section>;
}
