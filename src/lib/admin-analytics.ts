import type {StoreOrder} from './checkout.ts';
import type {makeAdminTestData} from './admin-test-data.ts';
export type HistoricalRecords=ReturnType<typeof makeAdminTestData>;
export type AnalyticsOrder={id:string;source:'store'|'history';created:string;state:string;merchandise:number;collected:number;items:{id:string;name:string;quantity:number;revenue:number}[]};
const number=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:0;
export function analyticsOrders(store:StoreOrder[],history:HistoricalRecords['orders']):AnalyticsOrder[]{
 return [...store.map(o=>({id:o.id,source:'store' as const,created:o.created_at,state:o.order_state,merchandise:Math.max(0,number(o.total_paisa)-number(o.delivery_paisa)),collected:o.payment_state==='paid'&&o.order_state!=='cancelled'?number(o.total_paisa):0,items:(o.snapshot||[]).map(p=>({id:p.productId,name:p.name,quantity:number(p.quantity),revenue:number(p.quantity)*number(p.unitPricePaisa)}))})),...history.map(o=>({id:o.id,source:'history' as const,created:o.created,state:o.state,merchandise:Math.round(number(o.total)*100),collected:0,items:[{id:o.productId,name:o.productName,quantity:number(o.quantity),revenue:Math.round(number(o.total)*100)}]}))].filter(o=>Number.isFinite(Date.parse(o.created)));
}
// Calendar reporting follows Pakistan time, independently of the administrator's device timezone.
export function reportMonth(date:Date){return new Date(date.getTime()+5*3600000).toISOString().slice(0,7)}
export function monthStart(month:string){return Date.parse(month+'-01T00:00:00+05:00')}
export function previousMonth(month:string){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7)}
export type ReportRange='month'|'30'|'90'|'year'|'all';
export function reportStart(range:ReportRange,now:Date){const month=reportMonth(now);return range==='all'?0:range==='month'?monthStart(month):range==='year'?Date.parse(month.slice(0,4)+'-01-01T00:00:00+05:00'):now.getTime()-Number(range)*86400000}
export function salesAnalytics(orders:AnalyticsOrder[],range:ReportRange,now=new Date()){
 const currentMonth=reportMonth(now),prior=previousMonth(currentMonth),cutoff=reportStart(range,now),end=now.getTime();
 const available=orders.filter(o=>Date.parse(o.created)<=end),selected=available.filter(o=>Date.parse(o.created)>=cutoff),delivered=selected.filter(o=>o.state==='delivered');
 const sum=(rows:AnalyticsOrder[])=>rows.reduce((s,o)=>s+o.merchandise,0);
 const monthSales=sum(available.filter(o=>o.state==='delivered'&&reportMonth(new Date(o.created))===currentMonth));
 const priorSales=sum(available.filter(o=>o.state==='delivered'&&reportMonth(new Date(o.created))===prior));
 const top=new Map<string,{id:string;name:string;units:number;revenue:number}>();
 for(const order of delivered)for(const p of order.items){const row=top.get(p.id)||{id:p.id,name:p.name,units:0,revenue:0};row.units+=p.quantity;row.revenue+=p.revenue;top.set(p.id,row)}
 const months=[];let key=currentMonth;for(let i=0;i<12;i++){months.unshift(key);key=previousMonth(key)}
 const trend=months.map(month=>{const rows=delivered.filter(o=>reportMonth(new Date(o.created))===month);return {month,sales:sum(rows),orders:rows.length}});
 return {totalOrders:available.length,selected,delivered:delivered.length,sales:sum(delivered),allSales:sum(available.filter(o=>o.state==='delivered')),monthSales,priorSales,growth:priorSales?(monthSales-priorSales)/priorSales*100:null,collected:selected.reduce((s,o)=>s+o.collected,0),pending:selected.filter(o=>['received','processing','dispatched'].includes(o.state)).length,cancelled:selected.filter(o=>o.state==='cancelled').length,average:delivered.length?Math.round(sum(delivered)/delivered.length):0,trend,top:[...top.values()].sort((a,b)=>b.units-a.units||b.revenue-a.revenue||a.id.localeCompare(b.id)).slice(0,5)};
}
export function estimatedGrossProfit(sales:number,margin:string){if(!margin.trim())return null;const n=Number(margin);return Number.isFinite(n)&&n>=0&&n<=100?Math.round(sales*n/100):null}
