import test from 'node:test';
import assert from 'node:assert/strict';
import {storeIndex} from '../src/storeIndex.mjs';
import {customerHistory} from '../src/customerHistory.mjs';
import {purchaseHistory} from '../src/purchaseHistory.mjs';
import {ledgerRows} from '../src/ledger.mjs';
import {createReadCoordinator} from '../src/readCoordinator.mjs';

function records(count=1000){
 const data={customers:[],sales:[],saleItems:[],payments:[],suppliers:[],purchases:[],supplierPayments:[],inventory:[]};
 for(let i=0;i<count;i++){
  const id=String(i);data.customers.push({id,full_name:'Customer '+id});data.suppliers.push({id,full_name:'Supplier '+id});
  data.sales.push({id,customer_id:id,final_total:100,sale_date:'2026-10-01',invoice_number:'AS-'+id});data.payments.push({sale_id:id,amount:40,payment_date:'2026-10-02'});
  data.saleItems.push({id,sale_id:id,inventory_item_id:id,item_name:'iPhone'});data.inventory.push({id,purchase_id:id,model:'iPhone',imei_1:id});
  data.purchases.push({id,seller_id:id,total_amount:200,purchase_date:'2026-09-01'});data.supplierPayments.push({purchase_id:id,amount:50});
 }
 return data;
}
test('Large histories and ledgers preserve totals and reuse grouped records',()=>{
 const data=records(),index=storeIndex(data);
 assert.strictEqual(storeIndex(data),index);
 for(const customer of data.customers){const h=customerHistory(data,customer);assert.equal(h.balance,60);assert.equal(h.totalSpent,100);assert.equal(h.phones[0].phone.imei_1,customer.id);assert.strictEqual(customerHistory(data,customer),h);}
 for(const purchase of data.purchases){const h=purchaseHistory(data,purchase);assert.equal(h.payable,150);assert.equal(h.seller.id,purchase.seller_id);assert.strictEqual(purchaseHistory(data,purchase),h);}
 const receivables=ledgerRows(data,'receivable'),payables=ledgerRows(data,'payable');
 assert.equal(receivables.length,1000);assert.equal(receivables.reduce((n,r)=>n+r.balance,0),60000);assert.equal(payables.reduce((n,r)=>n+r.balance,0),150000);assert.strictEqual(ledgerRows(data,'receivable'),receivables);
});
test('New payment arrays, appended payments and different accounts never reuse stale balances',()=>{
 const data=records(1),customer=data.customers[0];assert.equal(customerHistory(data,customer).balance,60);
 data.payments.push({sale_id:'0',amount:30});assert.equal(customerHistory(data,customer).balance,30);
 data.payments=[...data.payments,{sale_id:'0',amount:30}];assert.equal(customerHistory(data,customer).balance,0);assert.equal(ledgerRows(data,'receivable')[0].balance,0);
 const other=records(1);assert.equal(customerHistory(other,other.customers[0]).balance,60);assert.notStrictEqual(storeIndex(data),storeIndex(other));
});
test('Duplicate in-flight refreshes share one request and completed reads are never cached',async()=>{
 let calls=0,resolve;const coordinator=createReadCoordinator(()=>{calls++;return new Promise(r=>resolve=r)});
 const a=coordinator.read('owner'),b=coordinator.read('owner');assert.strictEqual(a,b);await Promise.resolve();assert.equal(calls,1);
 resolve({value:1});assert.deepEqual(await a,{value:1});const next=coordinator.read('owner');await Promise.resolve();assert.equal(calls,2);resolve({value:2});assert.deepEqual(await next,{value:2});
});
test('Post-save refresh aborts older work; switching accounts and cancellation release reads',async()=>{
 const pending=[];const coordinator=createReadCoordinator(signal=>new Promise(resolve=>pending.push({signal,resolve})));
 const old=coordinator.read('owner');await Promise.resolve();const fresh=coordinator.read('owner',{force:true});await Promise.resolve();assert.equal(pending[0].signal.aborted,true);
 pending[0].resolve('old');assert.equal(await old,'old');assert.strictEqual(coordinator.read('owner'),fresh);
 const staff=coordinator.read('staff');await Promise.resolve();assert.equal(pending[1].signal.aborted,true);coordinator.cancel();assert.equal(pending[2].signal.aborted,true);
 pending[1].resolve('fresh');pending[2].resolve('staff');await Promise.all([fresh,staff]);
});
test('Failed refreshes are released so retry can succeed',async()=>{
 let calls=0;const coordinator=createReadCoordinator(async()=>{if(++calls===1)throw Error('Network unavailable');return 'live';});
 await assert.rejects(coordinator.read('owner'),/Network unavailable/);assert.equal(await coordinator.read('owner'),'live');
});
