import type {StoreOrder} from './checkout';
export function summarizeOrders(orders:StoreOrder[]){
 const paid=orders.filter(o=>o.payment_state==='paid'&&o.order_state!=='cancelled');
 return {count:orders.length,collected:paid.reduce((s,o)=>s+o.total_paisa,0),pending:orders.filter(o=>['received','processing','dispatched'].includes(o.order_state)).length,cancelled:orders.filter(o=>o.order_state==='cancelled').length,uncollected:orders.filter(o=>o.payment_state==='unpaid'&&o.order_state!=='cancelled').reduce((s,o)=>s+o.total_paisa,0)};
}
export function csvText(rows:unknown[][]){return '\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
export function downloadCsv(name:string,rows:unknown[][]){const url=URL.createObjectURL(new Blob([csvText(rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
