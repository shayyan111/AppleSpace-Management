export const sum=(rows,key)=>rows.reduce((s,r)=>s+Number(r[key]||0),0);
export const due=(row,payments,key,total)=>Math.max(0,Math.round((Number(row[total])-sum(payments.filter(p=>p[key]===row.id),'amount'))*100)/100);
export const profit=(items,costs)=>{const byItem=new Map();for(const cost of costs)if(!byItem.has(cost.sale_item_id))byItem.set(cost.sale_item_id,cost);return items.reduce((s,i)=>s+Number(i.final_price)-Number(byItem.get(i.id)?.cost_price_snapshot||0),0);};
const currencyFormatter=new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR',maximumFractionDigits:0});
export const money=n=>currencyFormatter.format(Number(n||0));
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'});
export const localDay=value=>dayFormatter.format(new Date(value));
export const accountBalance=(accounts,code)=>{const a=accounts.find(x=>x.code===code);return Number(a?.debit||0)-Number(a?.credit||0)};
