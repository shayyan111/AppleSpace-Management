import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierLedger} from '../src/supplierLedger.mjs';
const first={id:'p1',seller_id:'supplier',purchase_number:1,purchase_date:'2026-10-01T09:00:00Z',total_amount:100000,item_details:[{model:'iPhone 15',storage:'128 GB',imei_1:'111111111111111',pta_status:'non_pta'}]};
const second={id:'p2',seller_id:'supplier',purchase_number:2,purchase_date:'2026-10-03T09:00:00Z',total_amount:60000,item_details:[{model:'iPhone 13',imei_1:'222222222222222'}]};
test('Supplier ledger interleaves product purchases and payments with a running balance',()=>{
 const data={purchases:[second,first,{...first,id:'other',seller_id:'other'}],supplierPayments:[{id:'pay',purchase_id:'p1',amount:50000,method:'bank_transfer',payment_date:'2026-10-02T09:00:00Z'},{id:'foreign',purchase_id:'other',amount:70000,payment_date:'2026-10-04T09:00:00Z'}]};
 const rows=supplierLedger(data,'supplier');
 assert.deepEqual(rows.map(r=>[r.kind,r.bought,r.paid,r.balance]),[['purchase',100000,0,100000],['payment',0,50000,50000],['purchase',60000,0,110000]]);
 assert.match(rows[0].product,/iPhone 15.*128 GB.*non pta/);assert.equal(rows[0].imei,'111111111111111');assert.equal(rows[1].method,'bank transfer');assert.equal(rows[1].reference,'#1');assert.equal(rows[2].imei,'222222222222222');
});
test('Paid-now payment follows its purchase when timestamps match and settles exactly',()=>{
 const date='2026-10-01T10:00:00Z';
 const rows=supplierLedger({purchases:[{...first,purchase_date:date,total_amount:0.3}],supplierPayments:[{id:'a',purchase_id:'p1',amount:0.1,payment_date:date},{id:'b',purchase_id:'p1',amount:0.2,payment_date:date}]},'supplier');
 assert.deepEqual(rows.map(r=>r.balance),[0.3,0.2,0]);assert.equal(rows[0].kind,'purchase');
});
test('Product snapshots survive inventory edits and accessory restocks use purchased quantity',()=>{
 const purchase={...first,item_details:[{name:'Cable',quantity:100,sku:'CAB'}]};
 const rows=supplierLedger({purchases:[purchase],accessories:[{purchase_id:'p1',name:'Renamed cable',quantity:500}]},'supplier');
 assert.equal(rows[0].product,'Cable · Qty 100');
 const fallback=supplierLedger({purchases:[{...first,item_details:null}],inventory:[{purchase_id:'p1',model:'Legacy phone',imei_1:'333333333333333'}]},'supplier');
 assert.equal(fallback[0].product,'Legacy phone');assert.equal(fallback[0].imei,'333333333333333');
});
test('Missing purchase costs flag subsequent balances as incomplete',()=>{
 const rows=supplierLedger({purchases:[{...first,total_amount:0},second],inventory:[{purchase_id:'p1',purchase_cost_pending:true}]},'supplier');
 assert.equal(rows[0].costPending,true);assert.equal(rows[1].balanceIncomplete,true);assert.equal(rows[1].balance,60000);
 assert.deepEqual(supplierLedger({},'missing'),[]);
});
