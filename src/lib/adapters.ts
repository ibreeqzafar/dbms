import type {Product} from '../types';
import type {Preferences} from './domain';
import {recommend} from './domain';
export interface TextAdapter{rank(products:Product[],preferences:Preferences):Promise<ReturnType<typeof recommend>>}
export interface VisionAdapter{describe(image:Blob):Promise<{observations:string[];uncertainty:string}>}
export interface ImageAdapter{mode:'local-overlay'|'provider';generate(input:{roomId:string;variantId:string;requestKey:string}):Promise<{jobId:string}>}
export const localText:TextAdapter={rank:async(products,prefs)=>recommend(products,prefs)};
export const unavailableVision:VisionAdapter={describe:async()=>({observations:[],uncertainty:'Vision is not configured. Recommendations use your entered preferences; photos do not establish measured fit.'})};
export const unavailableImage:ImageAdapter={mode:'local-overlay',generate:async()=>{throw Error('Real AI rendering is not enabled. Try the free local overlay instead; it uses no credits.')}};
