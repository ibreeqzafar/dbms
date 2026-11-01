import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {MessageCircle,Sparkles,X,ArrowUpRight,Send,ShoppingBag,Columns3,Plus,MoreVertical,Settings2} from 'lucide-react';
import {useStore} from '../lib/store';
import {money,dimensions} from '../lib/domain';
import {answerSupport} from '../lib/concierge';
import type {SupportReply} from '../lib/concierge';
import {checkoutEnabled,customerOrders} from '../lib/checkout';
import {askAgent,supportAgentEnabled,loadBestsellerSlugs} from '../lib/support-agent';
import {ProductImage} from './ProductCard';
import CheckoutPanel from './CheckoutPanel';
import SupportTickets from './SupportTickets';
import ChatAnswer from './ChatAnswer';
import type {Product} from '../types';
import {discountPercent} from '../lib/sales';
import {matchesCategory} from '../lib/categories';
import {withDeadline} from '../lib/async-deadline';
import './support-chat.css';
type Reply=SupportReply&{compare?:boolean;suggestions?:string[];action?:string};
type Message=Reply&{by:'guide'|'you';id:number};
function chatDisplay(){try{const value=JSON.parse(localStorage.getItem('essyra:chat-display')||'{}');return {suggestions:value.suggestions!==false,largeText:value.largeText===true}}catch{return {suggestions:true,largeText:false}}}
function ChatProduct({product:p,quantity:initial=1,selected,onCompare,onAdd}:{product:Product;quantity?:number;selected:boolean;onCompare:()=>void;onAdd:(p:Product,q:number)=>void}){
 const [quantity,setQuantity]=useState(Math.min(Math.max(1,initial),Math.min(20,p.demoStock)||1));
 return <article className="chat-product"><Link to={'/product/'+p.id} aria-label={'View '+p.name}><ProductImage product={p}/></Link><div><Link to={'/product/'+p.id}>{p.name}</Link><p>{p.colors.join(' / ')} · {money(p.demoPricePKR)}</p>{discountPercent(p)>0&&<span className="chat-sale">{discountPercent(p)}% off · <del>{money(p.saleOriginalPrice!)}</del></span>}<label>Quantity<input type="number" min={1} max={Math.min(20,p.demoStock)} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label><div className="chat-product-actions"><button className="btn small" disabled={p.demoStock<1||!Number.isInteger(quantity)||quantity<1||quantity>Math.min(20,p.demoStock)} onClick={()=>onAdd(p,quantity)}>{p.demoStock>0?'Add to bag':'Unavailable'}</button><button className="text-button" type="button" aria-pressed={selected} onClick={onCompare}>{selected?'Selected':'Compare'}</button></div></div></article>;
}
function Comparison({products}:{products:Product[]}){
 return <div className="chat-comparison" role="region" aria-label="Product comparison" tabIndex={0}><table><caption>Compare the details</caption><thead><tr><th scope="col">Feature</th>{products.map(p=><th key={p.id} scope="col"><Link to={'/product/'+p.id}>{p.name}</Link></th>)}</tr></thead><tbody><tr><th scope="row">Price</th>{products.map(p=><td key={p.id}>{money(p.demoPricePKR)}</td>)}</tr><tr><th scope="row">W × D × H</th>{products.map(p=><td key={p.id}>{dimensions(p)}<small>{p.dimensionEstimates?.length?'Estimated; confirm measurements':'Listed; confirm before ordering'}</small></td>)}</tr><tr><th scope="row">Materials</th>{products.map(p=><td key={p.id}>{p.materials.join(', ')||'Not specified'}</td>)}</tr><tr><th scope="row">Finish</th>{products.map(p=><td key={p.id}>{p.colors.join(', ')}</td>)}</tr><tr><th scope="row">Availability</th>{products.map(p=><td key={p.id}>{p.demoStock>0?'Available':'Sold out'}</td>)}</tr></tbody></table></div>;
}
export default function Concierge(){const {profile}=useStore();return <ConciergeWorkspace key={profile?.id||'guest'}/>}
function ConciergeWorkspace(){
 const {products,profile,settings,addCart,setNotice}=useStore();
 const [open,setOpen]=useState(false),[question,setQuestion]=useState(''),[checkout,setCheckout]=useState(false),[supportView,setSupportView]=useState(false),[busy,setBusy]=useState(false),[contextId,setContextId]=useState<string>(),[selected,setSelected]=useState<string[]>([]),[messages,setMessages]=useState<Message[]>([]);
 const [options,setOptions]=useState(false),[panel,setPanel]=useState<'settings'|'reset'|null>(null),[showSuggestions,setShowSuggestions]=useState(()=>chatDisplay().suggestions),[largeText,setLargeText]=useState(()=>chatDisplay().largeText);
 const catalogue=useRef(products);catalogue.current=products;
 useEffect(()=>{try{localStorage.setItem('essyra:chat-display',JSON.stringify({suggestions:showSuggestions,largeText}))}catch{/* Display choices still work without browser storage. */}},[showSuggestions,largeText]);
 const counter=useRef(1),input=useRef<HTMLInputElement>(null),log=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null),request=useRef<AbortController|null>(null),conversation=useRef(crypto.randomUUID());
 const location=useLocation();
 useEffect(()=>{request.current?.abort();conversation.current=crypto.randomUUID();setBusy(false);setCheckout(false);setSelected([]);setMessages([{id:counter.current++,by:'guide',text:'Welcome to ESSYRA. Find a piece you love, compare your favourites, or ask about your order.'}])},[profile?.id]);
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{if(location.pathname.startsWith('/product/'))setContextId(location.pathname.split('/')[2])},[location.pathname]);
 useEffect(()=>{if(open&&!checkout&&!panel)input.current?.focus()},[open,checkout,panel]);
 useEffect(()=>{if(!checkout)log.current?.scrollTo({top:log.current.scrollHeight})},[messages,checkout,busy]);
 const append=(reply:Reply)=>setMessages(m=>[...m,{...reply,id:counter.current++,by:'guide' as const}].slice(-40));
 const choose=(id:string)=>{if(!selected.includes(id)&&selected.length>=3){setNotice('Compare up to three pieces at a time.');return}setSelected(ids=>ids.includes(id)?ids.filter(s=>s!==id):[...ids,id])};
 const send=async(value:string)=>{
  if(settings.supportPaused||busy)return;
  const q=value.trim().slice(0,1000);if(!q)return;
  setMessages(m=>[...m,{id:counter.current++,by:'you' as const,text:q}].slice(-40));setQuestion('');
  const fallback=answerSupport(q,products,settings,contextId);
  if(/^(find furniture|furniture|browse furniture)[!?.,\s]*$/i.test(q)){append({text:'Of course. Tell me which room you are furnishing and your budget, or choose a collection below.',link:'/collection',label:'Browse all furniture',suggestions:['Show sofas','Show beds under PKR 150000','Show office furniture']});return}
  if(/^(hi|hello|hey|salam|assalam[ -]?o[ -]?alaikum|thanks|thank you|shukriya|bye|goodbye|how are you|how are u|find furniture|furniture|browse furniture)[!?.,\s]*$/i.test(q)){append({...fallback,suggestions:['Show sofas','Show beds under PKR 150000','Delivery information']});return}
  if(/\b(complaint|complain|damaged|missing item|return request|cancel my order)\b/i.test(q)){append({text:'Create a private support request here. You can link your own order and follow the team’s replies. Return and cancellation requests need staff review; they do not change your order automatically.'});setSupportView(true);return}
  if(fallback.checkout){append(fallback);setCheckout(true);return}
  if(fallback.orders){
   if(!checkoutEnabled){append({text:'Order submission is currently unavailable. Your bag is saved.'});return}
   if(!profile||profile.demo){append({text:'Sign in to view your own orders. Another customer’s email or order number cannot unlock their information.',link:'/account',label:'Sign in'});return}
   const controller=new AbortController();request.current=controller;setBusy(true);
   try{const orders=await withDeadline(()=>customerOrders(),controller.signal,10000);if(!controller.signal.aborted)append({text:orders.length?orders.slice(0,3).map(o=>`ESS-${o.id.slice(0,8).toUpperCase()}: ${o.order_state}, ${money(o.total_paisa/100)}, payment ${o.payment_state}${o.carrier?' · '+o.carrier:''}${o.tracking_number?' · Tracking '+o.tracking_number:''}`).join('\n'):'You have no orders in this account yet.',link:'/account',label:'View your orders'})}
   catch{if(!controller.signal.aborted)append({text:'Your orders could not load. Retry from your account or contact our team.',link:'/account',label:'Your account'})}
   finally{if(!controller.signal.aborted)setBusy(false)}return;
  }
  if(/\b(current deals|show.*deals|offers|sale|discounts)\b/i.test(q)){const deals=products.filter(p=>p.active!==false&&p.demoStock>0&&discountPercent(p)>0).sort((a,b)=>discountPercent(b)-discountPercent(a));append({text:deals.length?'These pieces have lower prices in our current catalogue. Open a product to check its finish and availability.':'There are no active reduced-price offers in the catalogue right now. Tell me your room and budget and I can help you find a piece.',products:deals.slice(0,4),link:'/collection?sale=1',label:'View current offers',suggestions:['Show beds under PKR 150000','Find furniture','Delivery information']});return}
  if(/\bbest[ -]?sellers?\b/i.test(q)){const controller=new AbortController();request.current=controller;setBusy(true);try{const slugs=await loadBestsellerSlugs(controller.signal);if(!controller.signal.aborted){const ranked=slugs.map(id=>catalogue.current.find(p=>p.id===id&&p.active!==false)).filter((p):p is Product=>!!p);append({text:ranked.length?'These pieces are ranked from paid, delivered ESSYRA orders. Open a product for its current price and availability.':'A verified best-seller ranking is not available yet. I can help you choose by room, budget, materials and style. What are you shopping for?',products:ranked.slice(0,4),suggestions:['Show sofas','Show beds under PKR 150000','Current deals']})}}catch{if(!controller.signal.aborted)append({text:'The sales ranking could not be checked right now. I can help you explore the current catalogue instead.',suggestions:['Find furniture','Current deals']})}finally{if(!controller.signal.aborted)setBusy(false)}return}
  if(!supportAgentEnabled){append(fallback);return}
  const controller=new AbortController();request.current=controller;setBusy(true);
  try{
   const reply=await askAgent(q,conversation.current,contextId,controller.signal);
   if(controller.signal.aborted)return;
   const found=reply.productSlugs.map(id=>catalogue.current.find(p=>p.id===id&&p.active!==false)).filter((p):p is Product=>!!p);
   const comparison=reply.action==='compare'&&found.length>=2;
   append({text:comparison?'Compare the current catalogue details below. Please confirm measurements before ordering.':reply.text,products:found,compare:comparison,suggestions:reply.suggestions,action:reply.action});
  }catch{if(!controller.signal.aborted)append({...fallback,text:'The AI connection is taking too long or is unavailable. Here is our catalogue guide so you can continue:\n\n'+fallback.text})}
  finally{if(!controller.signal.aborted)setBusy(false)}
 };
 const startNew=()=>{request.current?.abort();conversation.current=crypto.randomUUID();setBusy(false);setQuestion('');setCheckout(false);setSupportView(false);setSelected([]);setMessages([{id:counter.current++,by:'guide',text:'Welcome to ESSYRA. Find a piece you love, compare your favourites, or ask about your order.'}]);setPanel(null);setOptions(false);setContextId(location.pathname.startsWith('/product/')?location.pathname.split('/')[2]:undefined)};
 const welcomeCards=[{type:'beds',label:'Explore beds',question:'Show beds under PKR 150000'},{type:'sofas',label:'Find your sofa',question:'Show sofas'},{type:'chairs',label:'Chairs & seating',question:'Show chairs'}].map(c=>({...c,product:products.find(p=>p.active!==false&&matchesCategory(p,c.type)&&p.referenceImage?.includes('/files/'))||products.find(p=>p.active!==false&&matchesCategory(p,c.type))})).filter(c=>c.product);
 const close=()=>{setOpen(false);toggle.current?.focus()};
 const selectedProducts=selected.map(id=>products.find(p=>p.id===id&&p.active!==false)).filter((p):p is Product=>!!p);
 const latestSuggestions=messages.filter(m=>m.by==='guide').at(-1)?.suggestions;
 return <><div className="agent-dock"><Link to="/studio" className="agent-icon design-agent" aria-label="Open Design Studio"><Sparkles size={21}/><span aria-hidden="true">Design Studio</span></Link><button ref={toggle} className="agent-icon support-agent" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="concierge" aria-label={open?'Close ESSYRA Care':'Open ESSYRA Care'}><MessageCircle size={21}/><span aria-hidden="true">ESSYRA Care</span></button></div>
 {open&&<section id="concierge" className={'concierge '+(checkout?'chat-checkout-open ':'')+(largeText?'chat-large-text':'')} role="dialog" aria-modal="false" aria-labelledby="concierge-title" onKeyDown={e=>{if(e.key==='Escape'){if(options)setOptions(false);else if(panel)setPanel(null);else close()}}}>
 <header><div className="concierge-mark"><Sparkles size={20}/></div><div><h2 id="concierge-title">ESSYRA Care</h2><small>SHOPPING & CUSTOMER CARE</small></div><button className="icon-btn" onClick={()=>{setSupportView(false);setCheckout(v=>!v)}} aria-label={checkout?'Back to conversation':'Review your bag'}><ShoppingBag size={18}/></button><button className="icon-btn" aria-label="New chat" onClick={()=>{setPanel('reset');setOptions(false)}}><Plus size={18}/></button><button className="icon-btn" aria-label="Chat options" aria-expanded={options} aria-controls="chat-options" onClick={()=>setOptions(v=>!v)}><MoreVertical size={18}/></button><button className="icon-btn" onClick={close} aria-label="Close ESSYRA Care"><X size={19}/></button></header>
 {options&&<div className="chat-options" id="chat-options" role="region" aria-label="Chat options"><button onClick={()=>{setPanel('reset');setOptions(false)}}><Plus size={16}/>New chat</button><button onClick={()=>{setPanel('settings');setOptions(false)}}><Settings2 size={16}/>Settings</button><Link to="/policies#privacy" onClick={()=>setOptions(false)}>Privacy & customer care<ArrowUpRight size={15}/></Link></div>}
 {panel==='settings'?<div className="chat-settings"><button className="text-button" onClick={()=>setPanel(null)}>Back to conversation</button><h3>Chat settings</h3><label><span><strong>Suggested questions</strong><small>Show helpful shortcuts while you shop.</small></span><input type="checkbox" checked={showSuggestions} onChange={e=>setShowSuggestions(e.target.checked)}/></label><label><span><strong>Larger text</strong><small>Make conversation text easier to read.</small></span><input type="checkbox" checked={largeText} onChange={e=>setLargeText(e.target.checked)}/></label><div className="chat-privacy"><h4>Your privacy</h4><p>Order details stay behind your account sign-in. AI questions are processed using Groq. Avoid sharing passwords or payment details.</p><Link to="/policies#privacy">Read our privacy notice<ArrowUpRight size={14}/></Link></div></div>:panel==='reset'?<div className="chat-settings"><h3>Start a new chat?</h3><p>This clears the conversation from this panel and starts a fresh session.</p><button className="btn full" onClick={startNew}>Start new chat<Plus size={16}/></button><button className="text-button" onClick={()=>setPanel(null)}>Keep this conversation</button></div>:supportView?<div className="chat-checkout"><button className="text-button" onClick={()=>setSupportView(false)}>Back to conversation</button><SupportTickets compact/></div>:checkout?<div className="chat-checkout"><button className="text-button" onClick={()=>setCheckout(false)}>Back to conversation</button><CheckoutPanel compact/></div>:<>
 <div ref={log} className="concierge-log" role="log" aria-live="polite" aria-relevant="additions">{messages.length===1&&<div className="chat-welcome"><span className="eyebrow">YOUR PERSONAL STORE GUIDE</span><h3>Welcome to ESSYRA.</h3><p>A good place to find your next favourite.</p><div className="chat-welcome-cards">{!welcomeCards.length&&<span className="chat-welcome-loading" role="status">Loading the collection…</span>}{welcomeCards.map(c=><button key={c.type} disabled={busy||settings.supportPaused} onClick={()=>send(c.question)}><ProductImage product={c.product!}/><span>{c.label}<ArrowUpRight size={13}/></span></button>)}</div>{showSuggestions&&<div className="chat-welcome-prompts">{['Current deals','Best sellers','Track my order','Delivery information'].map(q=><button key={q} onClick={()=>send(q)} disabled={busy||settings.supportPaused||!products.length}>{q}<ArrowUpRight size={13}/></button>)}</div>}</div>}{messages.filter(m=>messages.length>1||m.by!=='guide').map(m=><div key={m.id} className={'chat-bubble '+m.by}><span className="sr-only">{m.by==='you'?'You: ':'ESSYRA: '}</span><ChatAnswer text={m.text}/>
 {m.compare&&m.products&&<Comparison products={m.products.slice(0,3)}/>}
 {!m.compare&&m.products?.map(p=><ChatProduct key={p.id} product={p} quantity={m.quantity} selected={selected.includes(p.id)} onCompare={()=>choose(p.id)} onAdd={(piece,q)=>{addCart(piece.id,piece.colors.join(' / '),q);setContextId(piece.id);setCheckout(true)}}/>)}
 {m.link&&<Link to={m.link}>{m.label}<ArrowUpRight size={13}/></Link>}
 {m.by==='guide'&&m.id!==messages[0]?.id&&<button className="chat-copy text-button" onClick={()=>{navigator.clipboard.writeText(m.text).then(()=>setNotice('Reply copied.')).catch(()=>setNotice('Copy is unavailable in this browser.'))}}>Copy reply</button>}
 {m.action==='orders'&&<button className="text-button" onClick={()=>send('My orders')}>Check my orders</button>}
 {m.action==='checkout'&&<button className="text-button" onClick={()=>setCheckout(true)}>Review bag and COD checkout</button>}
 {m.action==='complaint'&&<button className="text-button" onClick={()=>setSupportView(true)}>Create a private support request</button>}
 {['account','studio','contact'].includes(m.action||'')&&<Link to={'/'+m.action}>Open {m.action}<ArrowUpRight size={13}/></Link>}
 </div>)}{busy&&<p className="chat-thinking" role="status">Checking the catalogue… <button className="text-button" onClick={()=>{request.current?.abort();setBusy(false);const last=[...messages].reverse().find(m=>m.by==='you');if(last)append(answerSupport(last.text,products,settings,contextId))}}>Use store guide</button></p>}</div>
 {selectedProducts.length>0&&<div className="chat-compare-tray"><span>{selectedProducts.length}/3 selected</span><button className="text-button" disabled={selectedProducts.length<2||busy} onClick={()=>append({text:'Compare your selected pieces using the current catalogue details.',products:selectedProducts,compare:true})}><Columns3 size={15}/>Compare selected</button><button className="text-button" onClick={()=>setSelected([])}>Clear</button></div>}
 {showSuggestions&&messages.length>1&&<div className="quick-questions">{(latestSuggestions?.length?latestSuggestions:['Current deals','Find furniture','My orders']).map(q=><button key={q} onClick={()=>send(q)} disabled={settings.supportPaused||busy}>{q}</button>)}</div>}
 <form onSubmit={e=>{e.preventDefault();send(question)}}><label className="sr-only" htmlFor="concierge-question">Your support question</label><input id="concierge-question" placeholder="Ask ESSYRA…" ref={input} value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} required disabled={settings.supportPaused||busy}/><button className="icon-btn" type="submit" disabled={settings.supportPaused||busy} aria-label="Send question"><Send size={18}/></button></form>
 </>}
 {settings.supportPaused&&<p className="concierge-note">Support is paused. Call 03172197499 or email <a href="mailto:essyra.furniture@gmail.com">essyra.furniture@gmail.com</a>.</p>}
 </section>}</>;
}
