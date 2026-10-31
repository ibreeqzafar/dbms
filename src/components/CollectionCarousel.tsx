import {useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight,ChevronLeft,ChevronRight,Star} from 'lucide-react';
import {useStore} from '../lib/store';
import {supabase} from '../lib/supabase';
import {withDeadline} from '../lib/async-deadline';
import {featuredProducts} from '../lib/featured-products';
import type {ProductEdit} from '../lib/featured-products';
import {discountPercent} from '../lib/sales';
import {money} from '../lib/domain';
import {ProductImage} from './ProductCard';
import './collection-carousel.css';
const edits:{id:ProductEdit;label:string}[]=[{id:'featured',label:'Featured'},{id:'popular',label:'Popular'},{id:'sale',label:'On sale'},{id:'reviewed',label:'Most reviewed'},{id:'sold',label:'Best sellers'}];
export default function CollectionCarousel(){
 const {products,reviewStats}=useStore(),rail=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),active=useRef(0);
 const [edit,setEdit]=useState<ProductEdit>('featured'),[sold,setSold]=useState<string[]>([]),[index,setIndex]=useState(0);
 const cards=useMemo(()=>featuredProducts(products,reviewStats,sold,edit),[products,reviewStats,sold,edit]);
 const signature=cards.map(p=>p.id).join('|'),pad=Math.min(4,cards.length),loop=cards.length>4;
 const rendered=loop?[...cards.slice(-pad),...cards,...cards.slice(0,pad)]:cards;
 useEffect(()=>{const controller=new AbortController();withDeadline(async signal=>{if(!supabase)return [];const {data,error}=await supabase.rpc('get_homepage_bestsellers').abortSignal(signal);if(error)throw error;return (data||[]).map((p:{slug:string})=>p.slug)},controller.signal,10000).then(setSold).catch(()=>{});return()=>controller.abort()},[]);
 const stride=()=>{const el=rail.current;return el?((el.children[0] as HTMLElement)?.offsetWidth||0)+(parseFloat(getComputedStyle(el).columnGap)||0):0};
 const settle=()=>{const el=rail.current,size=stride();if(!el||!size)return;let position=Math.round(el.scrollLeft/size);if(loop&&(position<pad||position>=cards.length+pad)){position=pad+((position-pad)%cards.length+cards.length)%cards.length;el.scrollTo({left:position*size,behavior:'instant'})}active.current=((position-(loop?pad:0))%cards.length+cards.length)%cards.length;setIndex(active.current)};
 useEffect(()=>{const el=rail.current;if(!el||!cards.length)return;active.current=0;setIndex(0);const observer=new ResizeObserver(()=>{el.scrollTo({left:((loop?pad:0)+active.current)*stride(),behavior:'instant'})});observer.observe(el);return()=>{observer.disconnect();if(timer.current)clearTimeout(timer.current)}},[signature,loop]);
 const move=(direction:number)=>{const el=rail.current;if(!el)return;el.scrollBy({left:direction*stride(),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})};
 const choose=(i:number)=>rail.current?.scrollTo({left:((loop?pad:0)+i)*stride(),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
 return <section className="collection-carousel section" aria-label="Discover furniture products" aria-roledescription="carousel">
 <div className="wrap collection-carousel-heading"><div><span className="eyebrow">FIND SOMETHING YOU LOVE</span><h2>Find your next <em>favourite.</em></h2><p>Fresh finds, special prices and pieces worth coming home to.</p></div><Link className="text-link" to="/collection">Explore all furniture <ArrowUpRight size={17}/></Link></div>
 <div className="wrap product-edit-tabs" role="group" aria-label="Choose product selection">{edits.map(e=><button key={e.id} aria-pressed={edit===e.id} onClick={()=>setEdit(e.id)}>{e.label}</button>)}</div>
 {!cards.length?<div className="wrap product-edit-empty"><p>{!products.length?'Finding your next favourite...':edit==='sale'?'New offers are on their way.':'Customer rankings will appear as purchases and reviews come in.'}</p><button className="text-button" onClick={()=>setEdit('featured')}>Explore featured pieces <ArrowUpRight size={16}/></button></div>:<>
 <div className="collection-carousel-rail product-edit-rail" ref={rail} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const direction=e.key==='ArrowRight'?1:-1;if((e.target as HTMLElement).closest('a')){const next=(index+direction+cards.length)%cards.length;(rail.current?.children[(loop?pad:0)+next] as HTMLAnchorElement)?.focus({preventScroll:true})}move(direction)}}} onScroll={()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(settle,140)}}>
 {rendered.map((p,i)=>{const clone=loop&&(i<pad||i>=pad+cards.length),discount=discountPercent(p),stats=reviewStats[p.id];return <Link className="collection-image-card" key={i+'-'+p.id} to={'/product/'+p.id} tabIndex={clone?-1:0} aria-hidden={clone||undefined} inert={clone||undefined} aria-label={p.name+', '+money(p.demoPricePKR)} onFocus={()=>{if(!clone){const n=cards.findIndex(c=>c.id===p.id);active.current=n;setIndex(n)}}}><div className="collection-card-image"><ProductImage product={p}/>{discount>0&&<span className="collection-card-index is-offer">{discount}% OFF</span>}<span className="collection-card-arrow"><ArrowUpRight size={23}/></span></div><div className="collection-card-caption"><h3>{p.name}</h3><div className="featured-price">{discount>0&&<del>{money(p.saleOriginalPrice!)}</del>}<strong>{money(p.demoPricePKR)}</strong></div>{stats?.count>0&&<span className="featured-rating"><Star size={14} fill="currentColor"/>{stats.average.toFixed(1)} · {stats.count} reviews</span>}</div></Link>})}
 </div>
 <div className="wrap collection-carousel-controls"><div className="collection-dots" aria-label="Choose product">{cards.map((p,i)=><button key={p.id} aria-label={'Show '+p.name} aria-pressed={index===i} onClick={()=>choose(i)}><span/></button>)}</div><div><button aria-label="Previous product" onClick={()=>move(-1)}><ChevronLeft size={19}/></button><button aria-label="Next product" onClick={()=>move(1)}><ChevronRight size={19}/></button></div></div></>}
 </section>;
}
