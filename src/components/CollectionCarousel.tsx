import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight,ChevronLeft,ChevronRight} from 'lucide-react';
import {useStore} from '../lib/store';
import {matchesCategory} from '../lib/categories';
import {ProductImage} from './ProductCard';
import './collection-carousel.css';

const collections=[{type:'beds',label:'Beautiful beds',note:'A softer end to the day'},{type:'sofas',label:'Sofas & seating',note:'Make room for together'},{type:'tables',label:'Tables with character',note:'Everyday gathering places'},{type:'storage',label:'Considered storage',note:'A place for everything'},{type:'mirrors',label:'Mirrors & accents',note:'The finishing perspective'},{type:'chairs',label:'Chairs to settle into',note:'Comfort, in every corner'}];
export default function CollectionCarousel(){
 const {products}=useStore(),rail=useRef<HTMLDivElement>(null);
 const [steps,setSteps]=useState(1),[index,setIndex]=useState(0),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion:reduce)').matches);
 const cards=collections.map(c=>{const choices=products.filter(p=>p.active!==false&&matchesCategory(p,c.type));return {...c,product:choices.find(p=>p.referenceImage?.includes('/files/'))||choices.find(p=>p.referenceImage)}}).filter(c=>c.product);
 const go=(next:number)=>{const el=rail.current;if(!el||!cards.length)return;const target=(next+steps)%steps;const item=el.children[target] as HTMLElement;el.scrollTo({left:item.offsetLeft-el.offsetLeft-parseFloat(getComputedStyle(el).paddingLeft),behavior:reduced?'instant':'smooth'})};
 useEffect(()=>{const el=rail.current;if(!el||!cards.length)return;const observer=new ResizeObserver(()=>{const css=getComputedStyle(el),gap=parseFloat(css.columnGap)||18,width=(el.children[0] as HTMLElement).offsetWidth+gap,available=el.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)+gap;setSteps(Math.max(1,cards.length-Math.max(1,Math.floor((available+1)/width))+1))});observer.observe(el);return()=>observer.disconnect()},[cards.length]);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion:reduce)'),update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 if(!cards.length)return null;
 return <section className="collection-carousel section" aria-label="Explore furniture collections" aria-roledescription="carousel">
 <div className="wrap collection-carousel-heading"><div><span className="eyebrow">THE CONSIDERED COLLECTION</span><h2>Find your next <em>favourite.</em></h2><p>Explore pieces for the way you live.</p></div><Link className="text-link" to="/collection">Explore all furniture <ArrowUpRight size={17}/></Link></div>
 <div className="collection-carousel-rail" ref={rail} onScroll={()=>{const el=rail.current;if(!el)return;const width=(el.children[0] as HTMLElement)?.offsetWidth+(parseFloat(getComputedStyle(el).columnGap)||18);setIndex(Math.min(steps-1,Math.max(0,Math.round(el.scrollLeft/width))))}}>
 {cards.map((c,i)=><Link className="collection-image-card" key={c.type} to={'/collection?type='+c.type} aria-label={'Explore '+c.label}><div className="collection-card-image"><ProductImage product={c.product!}/><span className="collection-card-index">0{i+1} / THE ESSYRA EDIT</span><span className="collection-card-arrow"><ArrowUpRight size={23}/></span></div><div className="collection-card-caption"><h3>{c.label}</h3><span>{c.note}</span></div></Link>)}
 </div>
 <div className="wrap collection-carousel-controls"><div className="collection-dots" aria-label="Choose collection">{cards.slice(0,steps).map((c,i)=><button key={c.type} aria-label={'Show collections '+(i+1)} aria-pressed={index===i} onClick={()=>{go(i)}}><span/></button>)}</div><div><button aria-label="Previous collection" onClick={()=>{go(index-1)}}><ChevronLeft size={19}/></button><button aria-label="Next collection" onClick={()=>{go(index+1)}}><ChevronRight size={19}/></button></div></div>
 </section>;
}