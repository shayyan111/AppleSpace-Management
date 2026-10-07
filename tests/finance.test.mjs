import test from 'node:test';
import assert from 'node:assert/strict';
import {due,profit,accountBalance,localDay} from '../src/math.mjs';
test('Partial payments reduce only the matching invoice balance',()=>{assert.equal(due({id:'a',final_total:150000},[{sale_id:'a',amount:100000},{sale_id:'b',amount:40000}],'sale_id','final_total'),50000)});
test('Profit uses immutable cost snapshot and discounted final price',()=>{assert.equal(profit([{id:'a',final_price:135000}],[{sale_item_id:'a',cost_price_snapshot:120000}]),15000)});
test('Cash is debits less credits',()=>{assert.equal(accountBalance([{code:'1000',debit:210000,credit:125000}],'1000'),85000)});
test('Pakistan business day includes UTC evening transactions',()=>{assert.equal(localDay('2026-09-29T22:30:00Z'),'2026-09-30')});
