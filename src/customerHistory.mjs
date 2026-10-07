import {due,sum} from './math.mjs';
export function customerHistory(data,customer) {
  const records=(data.sales||[]).filter(s=>s.customer_id===customer.id);
  const invoices=records.filter(s=>!s.is_opening_balance).sort((a,b)=>new Date(b.sale_date)-new Date(a.sale_date));
  const phones=invoices.flatMap(s=>(data.saleItems||[]).filter(i=>i.sale_id===s.id&&i.inventory_item_id).map(i=>{
    const phone=(data.soldPhones||[]).find(p=>p.original_inventory_id===i.inventory_item_id)
      ||(data.inventory||[]).find(p=>p.id===i.inventory_item_id);
    return {...i,name:i.item_name,phone,sale:s};
  }));
  return {...customer,records,realSales:invoices,phones,last:invoices[0],lastPhone:phones[0]?.name||'phone',
    totalSpent:sum(invoices,'final_total'),
    balance:records.reduce((n,s)=>n+due(s,data.payments||[],'sale_id','final_total'),0),
    paymentHistory:(data.payments||[]).filter(p=>records.some(s=>s.id===p.sale_id)).sort((a,b)=>new Date(b.payment_date)-new Date(a.payment_date))};
}

export function invoiceHistory(data){
 return (data.sales||[]).filter(s=>!s.is_opening_balance||due(s,data.payments||[],'sale_id','final_total')===0);
}
