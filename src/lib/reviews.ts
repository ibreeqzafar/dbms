import type {Product} from '../types';
export type CatalogueReview={id:string;product_slug:string;rating:number;headline:string;comment:string;author_label:string;created_at:string;is_sample:boolean};
export type ReviewSummary={count:number;average:number;score:number;distribution:number[]};
export function summarizeReviews(reviews:CatalogueReview[]){const stats:Record<string,ReviewSummary>={};for(const r of reviews){if(!Number.isInteger(r.rating)||r.rating<1||r.rating>5)continue;const s=stats[r.product_slug]??={count:0,average:0,score:0,distribution:[0,0,0,0,0]};s.count++;s.average+=r.rating;s.distribution[r.rating-1]++}for(const s of Object.values(stats)){s.average/=s.count;s.score=(s.average*s.count+3.5*5)/(s.count+5)+Math.log1p(s.count)*.12}return stats}
export function compareProducts(a:Product,b:Product,sort:string,query:string,stats:Record<string,ReviewSummary>){
 if(sort==='price-asc')return a.demoPricePKR-b.demoPricePKR||a.id.localeCompare(b.id);
 if(sort==='price-desc')return b.demoPricePKR-a.demoPricePKR||a.id.localeCompare(b.id);
 if(sort==='name')return a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
 if(sort==='popular')return (stats[b.id]?.score||0)-(stats[a.id]?.score||0)||(stats[b.id]?.count||0)-(stats[a.id]?.count||0)||a.id.localeCompare(b.id);
 if(sort==='rating')return (stats[b.id]?.average||0)-(stats[a.id]?.average||0)||(stats[b.id]?.count||0)-(stats[a.id]?.count||0)||a.id.localeCompare(b.id);
 const text=query.trim().toLowerCase();if(!text)return 0;
 const relevance=(p:Product)=>{const name=p.name.toLowerCase();return (name===text?100:0)+(name.startsWith(text)?40:0)+(name.includes(text)?20:0)+text.split(/\s+/).reduce((n,word)=>n+(name.includes(word)?5:0),0)};
 return relevance(b)-relevance(a);
}
