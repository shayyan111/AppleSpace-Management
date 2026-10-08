import {due,sum} from './math.mjs';
import {storeIndex} from './storeIndex.mjs';
export function customerHistory(data,customer) {
  const index=storeIndex(data),cached=index.customerHistories.get(customer);if(cached)return cached;
  const records=index.salesByCustomer.get(customer.id)||[];
  const invoices=records.filter(s=>!s.is_opening_balance).sort((a,b)=>new Date(b.sale_date)-new Date(a.sale_date));
  const phones=invoices.flatMap(s=>(index.itemsBySale.get(s.id)||[]).filter(i=>i.inventory_item_id).map(i=>{
    const phone=index.archivedPhones.get(i.inventory_item_id)||index.phones.get(i.inventory_item_id);
    return {...i,name:i.item_name,phone,sale:s};
  }));
  const result={...customer,records,realSales:invoices,phones,last:invoices[0],lastPhone:phones[0]?.name||'phone',
    totalSpent:sum(invoices,'final_total'),
    balance:records.reduce((n,s)=>n+due(s,index.paymentsBySale.get(s.id)||[],'sale_id','final_total'),0),
    paymentHistory:records.flatMap(s=>index.paymentsBySale.get(s.id)||[]).sort((a,b)=>new Date(b.payment_date)-new Date(a.payment_date))};
  index.customerHistories.set(customer,result);return result;
}

export function invoiceHistory(data){
 const index=storeIndex(data);
 return (data.sales||[]).filter(s=>!s.is_opening_balance||due(s,index.paymentsBySale.get(s.id)||[],'sale_id','final_total')===0);
}
