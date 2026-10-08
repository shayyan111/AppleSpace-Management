import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {customerHistory} from '../src/customerHistory.mjs';
import {due,sum} from '../src/math.mjs';

// Run after: npm run build -- --manifest
const manifest=JSON.parse(readFileSync('dist/.vite/manifest.json','utf8')),seen=new Set();
function visit(key){if(seen.has(key))return;seen.add(key);for(const next of manifest[key].imports||[])visit(next);}
visit('index.html');
assert.ok(!seen.has('src/output.ts'),'Printing libraries must not load with the login page');
const chunks=[...seen].map(key=>readFileSync('dist/'+manifest[key].file));
const data={customers:[],sales:[],saleItems:[],payments:[],inventory:[],soldPhones:[]};
for(let i=0;i<1000;i++)data.customers.push({id:'c'+i,full_name:'Customer '+i});
for(let i=0;i<10000;i++){
 const id='s'+i,phone='p'+i;
 data.sales.push({id,customer_id:'c'+i%1000,sale_date:'2026-10-01',final_total:1000});
 data.saleItems.push({id:'i'+i,sale_id:id,inventory_item_id:phone,item_name:'iPhone'});
 data.inventory.push({id:phone,imei_1:String(i).padStart(15,'0')});
 data.payments.push({sale_id:id,amount:600,payment_date:'2026-10-02'});
}
// Reference is the previous repeated-array-search algorithm. Both executions
// calculate complete histories (not just balances) on a cold store snapshot.
function referenceHistory(data,customer){
 const records=data.sales.filter(s=>s.customer_id===customer.id),invoices=records.filter(s=>!s.is_opening_balance).sort((a,b)=>new Date(b.sale_date)-new Date(a.sale_date));
 const phones=invoices.flatMap(s=>data.saleItems.filter(i=>i.sale_id===s.id&&i.inventory_item_id).map(i=>({...i,name:i.item_name,phone:data.soldPhones.find(p=>p.original_inventory_id===i.inventory_item_id)||data.inventory.find(p=>p.id===i.inventory_item_id),sale:s})));
 return {...customer,records,realSales:invoices,phones,last:invoices[0],lastPhone:phones[0]?.name||'phone',totalSpent:sum(invoices,'final_total'),balance:records.reduce((n,s)=>n+due(s,data.payments,'sale_id','final_total'),0),paymentHistory:data.payments.filter(p=>records.some(s=>s.id===p.sale_id)).sort((a,b)=>new Date(b.payment_date)-new Date(a.payment_date))};
}
function run(fn){const start=performance.now(),histories=data.customers.map(c=>fn(data,c));return {ms:Number((performance.now()-start).toFixed(2)),balance:histories.reduce((n,h)=>n+h.balance,0),phones:histories.reduce((n,h)=>n+h.phones.length,0),spent:histories.reduce((n,h)=>n+h.totalSpent,0)};}
const before=run(referenceHistory),after=run(customerHistory);
assert.equal(after.balance,before.balance);assert.equal(after.spent,before.spent);assert.equal(after.phones,before.phones);
console.log(JSON.stringify({initial_js_bytes:chunks.reduce((n,c)=>n+c.length,0),initial_js_gzip_bytes:chunks.reduce((n,c)=>n+gzipSync(c).length,0),synthetic_history:{customers:1000,sales:10000,before,after,speedup:Number((before.ms/after.ms).toFixed(1))}},null,2));
