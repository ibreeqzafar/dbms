export function chatHref(value:string):string|null{
 try{const url=new URL(value,'https://essyra-home.vercel.app');if(url.origin!=='https://essyra-home.vercel.app')return null;if(!/^\/(?:product\/[a-z0-9-]+|collection|cart|account|studio|contact|policies)\/?$/.test(url.pathname))return null;return url.pathname+(url.pathname==='/collection'?url.search:'')+(/^#[a-z0-9-]+$/.test(url.hash)?url.hash:'')}
 catch{return null}
}
export function tableCells(line:string){return line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').slice(0,6).map(s=>s.trim())}
export function tableDivider(line:string){return /^\|?[\s:|-]+\|?$/.test(line.trim())&&line.includes('---')}
