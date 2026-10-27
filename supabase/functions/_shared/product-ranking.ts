export const categoryPatterns:Record<string,RegExp>={sofas:/sofa|chaise|daybed/i,chairs:/chair|stool|bench/i,tables:/table|desk/i,beds:/\bbed\b|\bbeds\b|mattress|headboard|divan|bunk/i,storage:/cabinet|wardrobe|shelv|bookcase|drawer|storage|sideboard/i,mirrors:/mirror/i,vanities:/vanit|dresser|dressing table/i,entryway:/console|shoe.?rack|entryway|hallway/i,benches:/bench/i,kids:/\bkids?\b|toddle|nursery|newborn/i,media:/\btv\b|media (?:unit|stand|console)/i};
export function matchesProductType(product:{name?:string;subcategory?:string},type:string){return !type||(Object.hasOwn(categoryPatterns,type)&&!!categoryPatterns[type]?.test(`${product.name||''} ${product.subcategory||''}`))}
type Match={product:{id:string;demoPricePKR:number;subcategory?:string};createdAt:string};
export function rankMatches<T extends Match>(matches:T[],mode:string,budget:number,limit=6):T[]{
 const recent=(a:T,b:T)=>b.createdAt.localeCompare(a.createdAt)||a.product.id.localeCompare(b.product.id);
 if(mode==='budget')return [...matches].sort((a,b)=>a.product.demoPricePKR-b.product.demoPricePKR||recent(a,b)).slice(0,limit);
 if(mode==='newest')return [...matches].sort(recent).slice(0,limit);
 const groups=new Map<string,T[]>();for(const match of [...matches].sort(recent)){const group=match.product.subcategory||'Furniture';groups.set(group,[...(groups.get(group)||[]),match])}
 const buckets=[...groups.values()].sort((a,b)=>Math.abs(a[0].product.demoPricePKR-budget*.65)-Math.abs(b[0].product.demoPricePKR-budget*.65)||recent(a[0],b[0]));
 const result:T[]=[];while(result.length<limit&&buckets.some(b=>b.length)){for(const bucket of buckets){const item=bucket.shift();if(item)result.push(item);if(result.length===limit)break}}return result;
}
