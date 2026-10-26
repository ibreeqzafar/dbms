import {useEffect,useRef,useState} from 'react';
import {Link,NavLink,useLocation} from 'react-router-dom';
import {ArrowUpRight,ChevronDown,Heart,Menu,Search,ShoppingBag,UserRound,X} from 'lucide-react';
import {useStore} from '../lib/store';
import ThemeToggle from './ThemeToggle';
import './store-header.css';

type Group={label:string;href:string;links:{label:string;href:string}[]};
const groups:Group[]=[
 {label:'Furniture',href:'/collection',links:[{label:'All furniture',href:'/collection'},{label:'Sofas',href:'/collection?type=sofas'},{label:'Chairs & armchairs',href:'/collection?type=chairs'},{label:'Beds',href:'/collection?type=beds'},{label:'Tables & desks',href:'/collection?type=tables'},{label:'Storage',href:'/collection?type=storage'}]},
 {label:'Living room',href:'/collection?room=living',links:[{label:'All living room',href:'/collection?room=living'},{label:'Sofas & seating',href:'/collection?room=living&type=sofas'},{label:'Chairs & armchairs',href:'/collection?room=living&type=chairs'},{label:'Coffee & side tables',href:'/collection?room=living&type=tables'},{label:'Storage & shelving',href:'/collection?room=living&type=storage'}]},
 {label:'Bedroom',href:'/collection?room=bedroom',links:[{label:'All bedroom',href:'/collection?room=bedroom'},{label:'Shop all beds',href:'/collection?type=beds'},{label:'Bedside tables',href:'/collection?room=bedroom&type=tables'},{label:'Wardrobes & drawers',href:'/collection?room=bedroom&type=storage'}]},
 {label:'Dining',href:'/collection?room=dining',links:[{label:'All dining furniture',href:'/collection?room=dining'},{label:'Dining tables',href:'/collection?room=dining&type=tables'},{label:'Dining chairs',href:'/collection?room=dining&type=chairs'}]},
 {label:'Kitchen',href:'/collection?room=kitchen',links:[{label:'All kitchen furniture',href:'/collection?room=kitchen'},{label:'Kitchen tables',href:'/collection?room=kitchen&type=tables'},{label:'Chairs & stools',href:'/collection?room=kitchen&type=chairs'},{label:'Kitchen storage',href:'/collection?room=kitchen&type=storage'}]},
 {label:'Office',href:'/collection?room=office',links:[{label:'All office furniture',href:'/collection?room=office'},{label:'Desks & work tables',href:'/collection?room=office&type=tables'},{label:'Office chairs',href:'/collection?room=office&type=chairs'},{label:'Office storage',href:'/collection?room=office&type=storage'}]},
];

export default function StoreHeader(){
 const {cart,wishlist}=useStore(),location=useLocation();
 const [open,setOpen]=useState<string|null>(null),[drawer,setDrawer]=useState(false),[section,setSection]=useState<'home'|'furniture'>('home');
 const root=useRef<HTMLElement>(null),dialog=useRef<HTMLDialogElement>(null),menuButton=useRef<HTMLButtonElement>(null);
 const count=cart.reduce((total,line)=>total+line.quantity,0);
 const closeDrawer=()=>{dialog.current?.close();setDrawer(false)};
 useEffect(()=>{setOpen(null);dialog.current?.close();setDrawer(false)},[location.pathname,location.search]);
 useEffect(()=>{
  if(!drawer)return;
  dialog.current?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=previous;menuButton.current?.focus()};
 },[drawer]);
 useEffect(()=>{
  const dismiss=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(null)};
  document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);
 },[]);
 return <>
  <div className="store-announcement"><span>CONSIDERED FURNITURE. PERSONAL SPACES.</span><Link to="/collection">Discover your next piece <ArrowUpRight size={12}/></Link></div>
  <header className="store-header" ref={root} onKeyDown={e=>{if(e.key==='Escape'){const button=root.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]');setOpen(null);button?.focus()}}}>
   <div className="store-header-main">
    <button ref={menuButton} className="store-menu-button" onClick={()=>setDrawer(true)} aria-label="Open category menu" aria-haspopup="dialog" aria-expanded={drawer} aria-controls="store-drawer"><Menu size={21}/><span>Menu</span></button>
    <Link to="/" className="wordmark store-brand" aria-label="ESSYRA home">ESSYRA<span>FIND THE SOUL OF YOUR PLACE</span></Link>
    <div className="store-tools"><Link className="store-search" to="/collection" aria-label="Search furniture"><Search size={20}/></Link><ThemeToggle/><Link to="/account" aria-label="Your account"><UserRound size={20}/></Link><Link className="store-wishlist" to="/wishlist" aria-label={`Wishlist, ${wishlist.length} items`}><Heart size={20}/></Link><Link to="/cart" aria-label={`Your bag, ${count} items`}><ShoppingBag size={20}/><span className="store-bag-count">{count}</span></Link></div>
   </div>
   <nav className="store-nav" aria-label="Main navigation" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(null)}}>
    <NavLink to="/" end>Home</NavLink>
    {groups.map(group=><div className="store-nav-group" key={group.label}>
     <button aria-expanded={open===group.label} aria-controls={'nav-'+group.label.replaceAll(' ','-')} onClick={()=>setOpen(open===group.label?null:group.label)}>{group.label}<ChevronDown size={13}/></button>
     {open===group.label&&<div className="store-dropdown" id={'nav-'+group.label.replaceAll(' ','-')}><span className="store-dropdown-heading">{group.label}</span>{group.links.map(link=><Link key={link.href} to={link.href} onClick={()=>setOpen(null)}>{link.label}<ArrowUpRight size={13}/></Link>)}</div>}
    </div>)}
    <NavLink to="/studio" className="store-studio-link">Design studio <ArrowUpRight size={13}/></NavLink>
   </nav>
  </header>
  <dialog id="store-drawer" className="store-drawer" ref={dialog} aria-labelledby="store-drawer-title" onCancel={()=>setDrawer(false)} onClose={()=>setDrawer(false)} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDrawer()}}}>
   <div className="store-drawer-top"><Link to="/" className="wordmark" id="store-drawer-title" onClick={closeDrawer}>ESSYRA</Link><button className="icon-btn" onClick={closeDrawer} aria-label="Close category menu"><X size={23}/></button></div>
   <div className="store-drawer-tabs" role="group" aria-label="Browse categories"><button id="browse-home-tab" aria-pressed={section==='home'} aria-controls="browse-panel" onClick={()=>setSection('home')}>Home</button><button id="browse-furniture-tab" aria-pressed={section==='furniture'} aria-controls="browse-panel" onClick={()=>setSection('furniture')}>Furniture</button></div>
   <div id="browse-panel" role="region" aria-labelledby={section==='home'?'browse-home-tab':'browse-furniture-tab'}>
    <Link className="store-view-all" to={section==='home'?'/':'/collection'} onClick={closeDrawer}>{section==='home'?'Visit the homepage':'Explore all furniture'}<ArrowUpRight size={16}/></Link>
    {(section==='home'?groups.slice(1):groups).map(group=><details className="store-accordion" key={section+group.label}><summary>{group.label}<ChevronDown size={16}/></summary><div>{group.links.map(link=><Link key={link.href} to={link.href} onClick={closeDrawer}>{link.label}<ArrowUpRight size={13}/></Link>)}</div></details>)}
   </div>
   <nav className="store-drawer-help" aria-label="Customer care"><Link to="/studio" onClick={closeDrawer}>Design your room <ArrowUpRight size={15}/></Link><Link to="/account" onClick={closeDrawer}>Your account <ArrowUpRight size={15}/></Link><Link to="/contact" onClick={closeDrawer}>Contact us <ArrowUpRight size={15}/></Link><Link to="/policies" onClick={closeDrawer}>Help, delivery & privacy <ArrowUpRight size={15}/></Link></nav>
  </dialog>
 </>;
}
