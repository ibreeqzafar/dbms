import type {Product} from '../types.ts';
// Deliberately synthetic, reserved-domain contacts; never inserted into auth or commerce tables.
export function makeAdminTestData(products:Product[]){
 const catalogue=products.filter(p=>p.active!==false);const first=['Amina','Zara','Hassan','Sara','Ali','Noor','Hamza','Hira','Usman','Maryam'];
 const customers=Array.from({length:750},(_,i)=>({id:`TEST-C${String(i+1).padStart(4,'0')}`,name:`${first[i%first.length]} Test ${i+1}`,email:`customer${i+1}@example.invalid`,registered:new Date(Date.UTC(2026,0,1)+Math.floor(i/750*290)*86400000).toISOString()}));
 const orders=Array.from({length:catalogue.length?600:0},(_,i)=>{const product=catalogue[(i*i+7*i)%catalogue.length];return {id:`TEST-O${String(i+1).padStart(4,'0')}`,customerId:customers[i%customers.length].id,productId:product.id,productName:product.name,total:product.demoPricePKR*(i%3+1),quantity:i%3+1,state:i<520?'delivered':i<550?'processing':i<580?'dispatched':'cancelled',created:new Date(Date.UTC(2026,0,2)+Math.floor(i/600*289)*86400000).toISOString()}});
 const reviews=orders.filter(o=>o.state==='delivered').slice(0,500).map((o,i)=>({id:`TEST-R${i+1}`,customerId:o.customerId,productId:o.productId,rating:[5,4,5,3,4,5,2,4,5,1][i%10],headline:'Test purchase feedback',comment:['Comfortable for everyday use.','The finish was different from my expectation.','Useful storage and a practical size.','Delivery took longer than expected.'][i%4]}));
 const popularity=Object.entries(orders.filter(o=>o.state==='delivered').reduce<Record<string,number>>((a,o)=>{a[o.productId]=(a[o.productId]||0)+o.quantity;return a},{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 return {customers,orders,reviews,popularity};
}
