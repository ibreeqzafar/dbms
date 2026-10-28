export type AgentReply={text:string;productSlugs:string[];suggestions:string[];action:'none'|'compare'|'orders'|'checkout'|'complaint'|'account'|'studio'|'contact'};
const actions=new Set(['none','compare','orders','checkout','complaint','account','studio','contact']);
export function normalizeAgentReply(value:unknown):AgentReply{
 let input:any=value;
 if(input&&typeof input==='object'&&typeof input.text!=='string'&&typeof input.output==='string')input=input.output;
 if(typeof input==='string'){
  const raw=input.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{input=JSON.parse(raw)}catch{input={text:raw,productSlugs:[...raw.matchAll(/https:\/\/essyra-home\.vercel\.app\/product\/([a-z0-9-]+)/g)].map(m=>m[1])}}
 }
 if(!input||typeof input!=='object'||typeof input.text!=='string'||!input.text.trim())throw Error('INVALID_REPLY');
 return {text:input.text.trim().slice(0,5000),productSlugs:[...new Set<string>((Array.isArray(input.productSlugs)?input.productSlugs:[]).filter((s:unknown)=>typeof s==='string'&&/^[a-z0-9-]{1,250}$/.test(s)))].slice(0,4),suggestions:(Array.isArray(input.suggestions)?input.suggestions:[]).filter((s:unknown)=>typeof s==='string'&&s.trim().length>0&&s.length<=70).slice(0,3),action:actions.has(input.action)?input.action:'none'};
}
