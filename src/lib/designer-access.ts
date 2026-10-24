import {supabase,requireSession} from './supabase';
export type DesignerAccess={registered:boolean;used:number;remaining:number|null};
export async function loadDesignerAccess():Promise<DesignerAccess|null>{
 if(!supabase)return null;
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)return null;
 const {data,error}=await supabase.rpc('recommendation_access');
 if(error)throw Error('Designer access could not load. Please try again shortly.');
 return data as DesignerAccess;
}
export async function beginGuestAccess(){
 if(!supabase)throw Error('Guest access is currently unavailable. Please try again shortly.');
 try{await requireSession()}catch{throw Error('Guest access could not start. Please try again shortly.');}
 const access=await loadDesignerAccess();if(!access)throw Error('Guest access could not start.');return access;
}
export async function recommendationError(error:unknown){
 if(error&&typeof error==='object'&&'context' in error&&error.context instanceof Response){
  try{const payload=await error.context.json();return String(payload.error||'REQUEST_FAILED')}catch{/* Use the generic failure below. */}
 }
 return 'REQUEST_FAILED';
}
