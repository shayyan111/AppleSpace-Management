import test from 'node:test';
import assert from 'node:assert/strict';
import {customerHistory} from '../src/customerHistory.mjs';
test('CRM balances include legacy receivables but purchase history excludes them',()=>{
  const history=customerHistory({sales:[{id:'old',customer_id:'c',is_opening_balance:true,final_total:9000},{id:'new',customer_id:'c',sale_date:'2026-10-01',final_total:20000},{id:'other',customer_id:'other',final_total:999}],payments:[{sale_id:'old',amount:2000},{sale_id:'new',amount:20000}],saleItems:[]},{id:'c'});
  assert.equal(history.balance,7000);assert.equal(history.realSales.length,1);assert.equal(history.totalSpent,20000);
});
test('History chooses the most recent phone and retains the archived IMEI after buyback',()=>{
  const history=customerHistory({sales:[{id:'s1',customer_id:'c',sale_date:'2026-09-01',final_total:100},{id:'s2',customer_id:'c',sale_date:'2026-10-01',final_total:200}],saleItems:[{id:'i1',sale_id:'s1',inventory_item_id:'p1',item_name:'iPhone 13'},{id:'i2',sale_id:'s2',inventory_item_id:'p2',item_name:'iPhone 16'}],soldPhones:[{original_inventory_id:'p1',imei_1:'111111111111111'}],inventory:[{id:'p2',imei_1:'222222222222222'}],payments:[]},{id:'c'});
  assert.equal(history.lastPhone,'iPhone 16');assert.equal(history.phones[1].phone.imei_1,'111111111111111');
});
