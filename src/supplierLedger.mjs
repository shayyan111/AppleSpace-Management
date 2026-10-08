import {purchaseHistory} from './purchaseHistory.mjs';

// Use immutable purchase snapshots: stock can be sold, edited, or restocked later.
export function supplierLedger(data,supplierId){
 const purchases=(data.purchases||[]).filter(p=>p.seller_id===supplierId);
 const byId=new Map(purchases.map(p=>[p.id,p]));
 const rows=purchases.map(p=>{
  const h=purchaseHistory(data,p);
  const details=p.item_details?.length?p.item_details:[...h.phones,...h.accessories];
  const product=details.map(i=>[i.model||i.name,i.storage,!i.model&&i.quantity?`Qty ${i.quantity}`:null,i.pta_status?.replaceAll('_',' ')].filter(Boolean).join(' · ')).join(', ')||p.notes||'Stock purchase';
  return {id:'purchase:'+p.id,kind:'purchase',purchaseId:p.id,reference:'#'+p.purchase_number,date:p.purchase_date||p.created_at,product,imei:h.imei,bought:Number(p.total_amount),paid:0,method:'',notes:p.notes||'',costPending:h.costPending};
 });
 for(const payment of data.supplierPayments||[]){
  const purchase=byId.get(payment.purchase_id);if(!purchase)continue;
  const h=purchaseHistory(data,purchase);
  rows.push({id:'payment:'+payment.id,kind:'payment',purchaseId:purchase.id,reference:'#'+purchase.purchase_number,date:payment.payment_date||payment.created_at,product:h.model||'Stock purchase',imei:h.imei,bought:0,paid:Number(payment.amount),method:payment.method?.replaceAll('_',' ')||'—',notes:payment.notes||'',costPending:false});
 }
 rows.sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()||(a.kind===b.kind?0:a.kind==='purchase'?-1:1)||a.id.localeCompare(b.id));
 let cents=0,incomplete=false;
 return rows.map(row=>{
  cents+=Math.round(row.bought*100)-Math.round(row.paid*100);
  incomplete ||= row.costPending;
  return {...row,balance:cents/100,balanceIncomplete:incomplete};
 });
}
