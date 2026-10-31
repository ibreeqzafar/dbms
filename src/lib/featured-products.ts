import type {Product} from '../types';
import type {ReviewSummary} from './reviews';
import {discountPercent} from './sales.ts';
export type ProductEdit='featured'|'popular'|'sale'|'reviewed'|'sold';
const curated=['square-bubble-boucle-bed','cloud-plus-sofa','credenza-console-with-curved-cabinets-brass-accents','curvy-standing-mirror-with-full-length-design','zarelle-bed','kate-white-sofa','leaf-media-console','arch-bubble-sofa'];
export function featuredProducts(products:Product[],stats:Record<string,ReviewSummary>,sold:string[],edit:ProductEdit){
 const available=products.filter(p=>p.active!==false&&p.demoStock>0&&p.referenceImage),byId=new Map(available.map(p=>[p.id,p]));
 const trendy=curated.map(id=>byId.get(id)).filter((p):p is Product=>!!p);
 const sales=available.filter(p=>discountPercent(p)>0).sort((a,b)=>discountPercent(b)-discountPercent(a)||a.id.localeCompare(b.id));
 const reviewed=available.filter(p=>stats[p.id]?.count>0).sort((a,b)=>stats[b.id].count-stats[a.id].count||stats[b.id].average-stats[a.id].average||a.id.localeCompare(b.id));
 const best=sold.map(id=>byId.get(id)).filter((p):p is Product=>!!p),popular=[...reviewed.slice().sort((a,b)=>stats[b.id].score-stats[a.id].score),...best];
 const pool=edit==='sale'?sales:edit==='reviewed'?reviewed:edit==='sold'?best:edit==='popular'?popular:[...sales.slice(0,4),...popular.slice(0,4),...trendy,...sales,...available];
 return [...new Map(pool.map(p=>[p.id,p])).values()].slice(0,12);
}

