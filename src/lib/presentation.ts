import type {Product} from '../types';
/** Storefront sample branding. Original provenance is retained in the source audit. */
export function sampleProduct(p:Product):Product{return {...p,brand:'ESSYRA',sourceUrl:'',description:`${p.name}: ${p.subcategory} in ${p.colors.join(' / ')}. A sample ESSYRA catalogue item for exploring room ideas. Product specifications, images, price and availability are demonstration content until the brand supplies its own inventory.`}}
