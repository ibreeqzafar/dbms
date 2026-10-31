import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight,ChevronLeft,ChevronRight} from 'lucide-react';
import {roomNames} from '../lib/domain';
import type {Room} from '../types';
import './collection-carousel.css';

const rooms:Room[]=['living','bedroom','office','dining','kitchen'];
export default function RoomCarousel({photos}:{photos:Record<Room,string>}){
 const rail=useRef<HTMLDivElement>(null),[steps,setSteps]=useState(1),[index,setIndex]=useState(0);
 const measure=()=>{const el=rail.current;if(!el)return;const first=el.children[0] as HTMLElement;const stride=first.offsetWidth+(parseFloat(getComputedStyle(el).columnGap)||0);setSteps(Math.max(1,Math.ceil((el.scrollWidth-el.clientWidth)/stride)+1));setIndex(Math.max(0,Math.round(el.scrollLeft/stride)))};
 useEffect(()=>{const el=rail.current;if(!el)return;const observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect()},[]);
 const go=(next:number)=>{const el=rail.current;if(!el)return;const target=(next+steps)%steps;const first=el.children[0] as HTMLElement;const stride=first.offsetWidth+(parseFloat(getComputedStyle(el).columnGap)||0);el.scrollTo({left:target*stride,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})};
 return <div className="room-carousel" role="region" aria-roledescription="carousel" aria-label="Explore every room"><div className="room-carousel-rail" ref={rail} onScroll={measure}>
 {rooms.map((room,i)=><Link className="room-tile" to={'/collection?room='+room} key={room}><img src={`https://images.unsplash.com/${photos[room]}?auto=format&fit=crop&w=1000&q=85`} alt={`${roomNames[room]} inspiration with refined furniture and natural materials`} width="1000" height="1100" loading="lazy"/><div><span>0{i+1} / THE ESSYRA HOUSE</span><h3>{roomNames[room]}.</h3><span className="round-arrow"><ArrowUpRight size={22}/></span></div></Link>)}
 </div><div className="collection-carousel-controls"><div className="collection-dots" aria-label="Choose rooms">{Array.from({length:steps},(_,i)=><button key={i} aria-label={'Show rooms '+(i+1)} aria-pressed={index===i} onClick={()=>go(i)}><span/></button>)}</div><div><button aria-label="Previous rooms" onClick={()=>go(index-1)}><ChevronLeft size={19}/></button><button aria-label="Next rooms" onClick={()=>go(index+1)}><ChevronRight size={19}/></button></div></div></div>;
}
