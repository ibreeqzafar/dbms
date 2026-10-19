import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useStore} from '../lib/store';
const pages:Record<string,[string,string]>={
'/':['Find the soul of your place','Explore considered furniture, discover a cinematic interior and compose your own room with ESSYRA.'],
'/collection':['The furniture collection','Explore furniture by room, style, finish and dimensions. Request a personalised quotation from ESSYRA.'],
'/walkthrough':['The ESSYRA interior film','Explore a realistic interior film at your own pace, then discover furniture for every room.'],
'/walkthrough/layout':['Interactive layout study','Explore the original approximate furniture layout with keyboard and touch controls.'],
'/studio':['Interior design studio','Find furniture suggestions by style, colour and explicit measurements. Compose free illustrative room overlays with separate photo-saving consent.'],
'/account/recovery':['Reset your password','Choose a new ESSYRA password using your verified recovery link.'],
'/account':['Your account','Access your ESSYRA profile and privately saved room designs.'],
'/cart':['Your selection','Review your preferred furniture and finishes, then prepare a quotation enquiry.'],
'/wishlist':['Your favourite pieces','Revisit your saved furniture references and return to their specifications.'],
'/admin':['Administration','Restricted ESSYRA catalogue, stock, service and policy administration.'],
'/policies':['Policies and privacy','Read about quotations, delivery enquiries, customer care and room-photo privacy.'],
'/contact':['Contact ESSYRA','Contact Umamah Ibreeq, founder of ESSYRA, at +92 317 2197499.']};
export default function SEO(){const {pathname:rawPathname}=useLocation(),pathname=rawPathname.replace(/\/+$/,'')||'/',{products}=useStore();useEffect(()=>{const product=pathname.startsWith('/product/')?products.find(p=>'/product/'+p.id===pathname):undefined;
const [title,description]=product?[product.name,product.description]:pages[pathname]||['Page not found','This ESSYRA page could not be found. Explore the furniture collection or return home.'];
const base=import.meta.env.VITE_SITE_URL||'https://essyra-home.quietibex64.chatgpt.site',url=base+pathname;
document.title=title+' — ESSYRA';const meta=(name:string,content:string,property=false)=>{let el=document.querySelector<HTMLMetaElement>(`meta[${property?'property':'name'}="${name}"]`);if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',name);document.head.append(el)}el.content=content};
meta('description',description);meta('og:title',document.title,true);meta('og:description',description,true);meta('og:url',url,true);meta('og:image',product?.referenceImage||base+'/social-share.png',true);meta('robots',(!pages[pathname]&&!product)||['/admin','/account','/account/recovery','/cart','/wishlist','/studio'].includes(pathname)?'noindex,follow':'index,follow');
let canonical=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}canonical.href=url;
const graph:unknown[]=[{'@type':'WebSite','@id':base+'/#website',url:base,name:'ESSYRA',description:'Furniture collection, interior inspiration and a private room-design workspace.'},{'@type':'LocalBusiness','@id':base+'/#business',name:'ESSYRA',url:base,telephone:'+923172197499',founder:{'@type':'Person',name:'Umamah Ibreeq'},description:'Furniture catalogue and interior design inspiration. Contact our team for product quotations.'}];
if(pathname!=='/')graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:base},...(product?[{'@type':'ListItem',position:2,name:'Collection',item:base+'/collection'}]:[]),{'@type':'ListItem',position:product?3:2,name:product?.name||title,item:url}]});
if(product)graph.push({'@type':'Product',name:product.name,description:product.description,brand:{'@type':'Brand',name:product.brand},image:product.referenceImage||undefined,url,material:product.materials.join(', '),color:product.colors.join(' / ')});
let script=document.querySelector<HTMLScriptElement>('#essyra-schema');if(!script){script=document.createElement('script');script.id='essyra-schema';script.type='application/ld+json';document.head.append(script)}script.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});
window.scrollTo({top:0,behavior:'instant'});
},[pathname,products]);return null}
