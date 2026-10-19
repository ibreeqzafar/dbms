import type {Product} from '../types';
/** Storefront sample branding. Original provenance is retained in the source audit. */
export function sampleProduct(p:Product):Product{return {...p,brand:'ESSYRA',sourceUrl:'',description:`${p.name}: ${p.subcategory} in ${p.colors.join(' / ')}. Explore the dimensions, materials and finish to find the right piece for your space.`}}
