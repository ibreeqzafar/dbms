import type {StoreOrder} from './checkout.ts';
export function orderStatusLabel(state:StoreOrder['order_state']){
 return {received:'Order placed',processing:'Preparing your order',dispatched:'On the way',delivered:'Delivered',cancelled:'Cancelled'}[state];
}
export function canReviewOrder(order:Pick<StoreOrder,'order_state'>){return order.order_state==='delivered'}
