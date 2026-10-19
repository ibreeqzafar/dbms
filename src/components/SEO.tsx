import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useStore} from '../lib/store';
const pages:Record<string,[string,string]>={
'/':['Find the soul of your place','Walk through five rooms, explore 517 sample furniture pieces, and compose your own room with ESSYRA.'],
'/collection':['The furniture collection','Explore sample furniture pieces with sample product photos, demonstration specifications and clearly labelled ESSYRA demo prices.'],
'/walkthrough':['The interactive 3D house','Explore five furnished rooms with keyboard, touch or guided controls and discover furniture through product hotspots.'],
'/studio':['Interior design studio','Match furniture to your budget, style and explicit measurements. Compose free illustrative room overlays with separate photo-saving consent.'],
'/account/recovery':['Reset your password','Choose a new ESSYRA password using your verified recovery link.'],
'/account':['Your account','Access your own ESSYRA practice orders and privately saved room designs.'],
'/cart':['Your shopping bag','Review reference finishes, quantities and ESSYRA demo prices before confirming a practice order.'],
'/wishlist':['Your favourite pieces','Revisit your saved furniture references and return to their specifications.'],
'/admin':['Administration','Restricted ESSYRA catalogue, stock, service and policy administration.'],
'/policies':['Policies and privacy','Read about reference attribution, demo commerce, room-photo consent and ESSYRA privacy.'],
'/contact':['Contact ESSYRA','Contact Umamah Ibreeq, founder of ESSYRA, at +92 317 2197499.']};
export default function SEO(){const {pathname}=useLocation(),{products}=useStore();useEffect(()=>{const product=pathname.startsWith('/product/')?products.find(p=>'/product/'+p.id===pathname):undefined;
const [title,description]=product?[product.name+' — '+product.brand+' reference',product.description]:pages[pathname]||['Page not found','This ESSYRA page could not be found. Explore the furniture collection or return home.'];
const base=import.meta.env.VITE_SITE_URL||'https://essyra-home.quietibex64.chatgpt.site',url=base+pathname;
document.title=title+' — ESSYRA';const meta=(name:string,content:string,property=false)=>{let el=document.querySelector<HTMLMetaElement>(`meta[${property?'property':'name'}="${name}"]`);if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',name);document.head.append(el)}el.content=content};
meta('description',description);meta('og:title',document.title,true);meta('og:description',description,true);meta('og:url',url,true);meta('og:image',product?.referenceImage||base+'/social-share.png',true);meta('robots',(!pages[pathname]&&!product)||['/admin','/account','/account/recovery','/cart','/wishlist','/studio'].includes(pathname)?'noindex,follow':'index,follow');
let canonical=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}canonical.href=url;
const graph:unknown[]=[{'@type':'WebSite','@id':base+'/#website',url:base,name:'ESSYRA',description:'Independent furniture reference and room-design practice experience.'},{'@type':'LocalBusiness','@id':base+'/#business',name:'ESSYRA',url:base,telephone:'+923172197499',founder:{'@type':'Person',name:'Umamah Ibreeq'},description:'Independent online interior-design practice experience. Demo commerce only.'}];
if(pathname!=='/')graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:base},...(product?[{'@type':'ListItem',position:2,name:'Collection',item:base+'/collection'}]:[]),{'@type':'ListItem',position:product?3:2,name:product?.name||title,item:url}]});
if(product)graph.push({'@type':'Product',name:product.name,description:product.description,brand:{'@type':'Brand',name:product.brand},image:product.referenceImage||undefined,url,material:product.materials.join(', '),color:product.colors.join(' / ')});
let script=document.querySelector<HTMLScriptElement>('#essyra-schema');if(!script){script=document.createElement('script');script.id='essyra-schema';script.type='application/ld+json';document.head.append(script)}script.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});
window.scrollTo({top:0,behavior:'instant'});
},[pathname,products]);return null}
