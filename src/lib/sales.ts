import type {Product} from '../types';
export function discountPercent(p:Product){const original=p.saleOriginalPrice;return p.active!==false&&original&&Number.isFinite(original)&&original>p.demoPricePKR&&p.demoPricePKR>0?Math.floor((original-p.demoPricePKR)*100/original+1e-8):0}
