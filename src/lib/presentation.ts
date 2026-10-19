import type {Product} from '../types';
/** Storefront sample branding. Original provenance is retained in the source audit. */
export function sampleProduct(p:Product):Product{return {...p,brand:'ESSYRA',sourceUrl:'',description:`${p.name}: ${p.subcategory} in ${p.colors.join(' / ')}. Explore this piece for your space. Contact our team to confirm specifications, finish, availability and a personalised quotation.`}}
