export const sum=(rows,key)=>rows.reduce((s,r)=>s+Number(r[key]||0),0);
export const due=(row,payments,key,total)=>Math.max(0,Number(row[total])-sum(payments.filter(p=>p[key]===row.id),'amount'));
export const profit=(items,costs)=>items.reduce((s,i)=>s+Number(i.final_price)-Number(costs.find(c=>c.sale_item_id===i.id)?.cost_price_snapshot||0),0);
export const money=n=>new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR',maximumFractionDigits:0}).format(Number(n||0));
export const localDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const accountBalance=(accounts,code)=>{const a=accounts.find(x=>x.code===code);return Number(a?.debit||0)-Number(a?.credit||0)};
