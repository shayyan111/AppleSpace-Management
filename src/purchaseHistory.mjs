import {due} from './math.mjs';
import {storeIndex} from './storeIndex.mjs';
export function purchaseHistory(data,purchase){
 const index=storeIndex(data),cached=index.purchaseHistories.get(purchase);if(cached)return cached;
 const phones=index.phonesByPurchase.get(purchase.id)||[];
 const accessories=index.accessoriesByPurchase.get(purchase.id)||[];
 const details=Array.isArray(purchase.item_details)&&purchase.item_details.length?purchase.item_details:[...phones,...accessories];
 const result={...purchase,seller:index.sellers.get(purchase.seller_id),phones,accessories,
  model:details.map(i=>[i.model||i.name,i.storage].filter(Boolean).join(' · ')).join(', '),
  imei:details.filter(i=>i.model).map(i=>[i.imei_1,i.imei_2||i.serial_number].filter(Boolean).join(' / ')).join(', '),
  payable:due(purchase,index.paymentsByPurchase.get(purchase.id)||[],'purchase_id','total_amount'),
  costPending:phones.some(i=>i.purchase_cost_pending)};
 index.purchaseHistories.set(purchase,result);return result;
}
