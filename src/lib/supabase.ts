import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=url&&key&&import.meta.env.VITE_SUPABASE_ENABLED==='true'?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export const connected=!!supabase;
export async function requireSession(){if(!supabase)throw Error('Supabase is not configured.');const {data}=await supabase.auth.getSession();if(data.session)return data.session;const result=await supabase.auth.signInAnonymously();if(result.error)throw result.error;return result.data.session!;}
