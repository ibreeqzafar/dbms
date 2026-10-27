import type {Product} from '../types';
export const furnitureCategories=[
{slug:'sofas',label:'Sofas',test:/sofa|chaise|daybed/i},
{slug:'chairs',label:'Chairs & armchairs',test:/chair|stool|bench/i},
{slug:'tables',label:'Tables & desks',test:/table|desk/i},
{slug:'beds',label:'Beds',test:/\bbed\b|\bbeds\b|mattress|headboard|divan|bunk/i},
{slug:'storage',label:'Storage',test:/cabinet|wardrobe|shelv|bookcase|drawer|storage|sideboard/i},
{slug:'mirrors',label:'Mirrors',test:/mirror/i},
{slug:'vanities',label:'Dressing tables & vanities',test:/vanit|dresser|dressing table/i},
{slug:'entryway',label:'Entryway & consoles',test:/console|shoe.?rack|entryway|hallway/i},
{slug:'benches',label:'Benches',test:/bench/i},
{slug:'kids',label:"Kids' furniture",test:/\bkids?\b|toddle|nursery|newborn/i},
{slug:'media',label:'TV & media units',test:/\btv\b|media (?:unit|stand|console)/i},
] as const;
export function matchesCategory(p:Product,slug:string){return furnitureCategories.find(c=>c.slug===slug)?.test.test(p.name+' '+p.subcategory)??true}
