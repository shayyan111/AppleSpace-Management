import {due} from './math.mjs';
export function purchaseHistory(data,purchase){
 const sellers=[...(data.suppliers||[]),...(data.walkInSellers||[])];
 const phones=(data.inventory||[]).filter(i=>i.purchase_id===purchase.id);
 const accessories=(data.accessories||[]).filter(i=>i.purchase_id===purchase.id);
 return {...purchase,seller:sellers.find(s=>s.id===purchase.seller_id),phones,accessories,
  model:phones.map(i=>[i.model,i.storage].filter(Boolean).join(' · ')).concat(accessories.map(i=>i.name)).join(', '),
  imei:phones.map(i=>[i.imei_1,i.imei_2||i.serial_number].filter(Boolean).join(' / ')).join(', '),
  payable:due(purchase,data.supplierPayments||[],'purchase_id','total_amount'),
  costPending:phones.some(i=>i.purchase_cost_pending)};
}
