import test from 'node:test';
import assert from 'node:assert/strict';
import {ledgerRows,ledgerImpact,pageAllowed} from '../src/ledger.mjs';
import {profit} from '../src/math.mjs';
test('Ledgers combine phone balances and other balances without counting settled records twice',()=>{
 const data={customers:[{id:'c',full_name:'Customer'}],sales:[{id:'s',customer_id:'c',final_total:100,sale_date:'2026-10-01'}],payments:[{sale_id:'s',amount:60}],suppliers:[{id:'v',full_name:'Supplier'}],purchases:[{id:'p',seller_id:'v',total_amount:200,purchase_date:'2026-10-01'}],supplierPayments:[{purchase_id:'p',amount:80}],ledgerEntries:[{id:'r',kind:'receivable',full_name:'Other debtor',category:'existing_balance',record_date:'2026-10-01',amount:50},{id:'a',kind:'payable',full_name:'Other creditor',category:'expense_owed',record_date:'2026-10-01',amount:30}],ledgerPayments:[{entry_id:'r',amount:10},{entry_id:'a',amount:30}]};
 const receivables=ledgerRows(data,'receivable'),payables=ledgerRows(data,'payable');
 assert.equal(receivables.reduce((n,r)=>n+r.balance,0),80);assert.equal(payables.reduce((n,r)=>n+r.balance,0),120);
 assert.equal(payables.find(r=>r.source==='manual').balance,0);assert.equal(receivables.length,2);
});
test('Loans and existing balances do not create profit; service income and unpaid expenses do',()=>{
 const data={ledgerEntries:[{category:'existing_balance',record_date:'2026-10-01',amount:900},{category:'money_advance',record_date:'2026-10-01',amount:800},{category:'money_borrowed',record_date:'2026-10-01',amount:700},{category:'service_income',record_date:'2026-10-01',amount:100},{category:'expense_owed',record_date:'2026-10-01',amount:30},{category:'service_income',record_date:'2026-09-01',amount:50}]};
 assert.deepEqual(ledgerImpact(data),{income:150,expenses:30});assert.deepEqual(ledgerImpact(data,d=>d>='2026-10-01'),{income:100,expenses:30});
});
test('Opening/closing and reports are owner-only, while ledgers allow managers',()=>{
 for(const page of ['Daily closing','Reports','Record cleanup','Settings']){assert.equal(pageAllowed(page,'owner'),true);for(const role of ['manager','salesperson',''])assert.equal(pageAllowed(page,role),false);}
 for(const page of ['Receivables ledger','Payables ledger']){assert.equal(pageAllowed(page,'owner'),true);assert.equal(pageAllowed(page,'manager'),true);assert.equal(pageAllowed(page,'salesperson'),false);}
});
test('A free stocked accessory reduces invoice profit without changing the amount billed',()=>{
 const items=[{id:'phone',final_price:120000},{id:'cable',final_price:0,quantity:2}];const costs=[{sale_item_id:'phone',cost_price_snapshot:100000},{sale_item_id:'cable',cost_price_snapshot:800}];
 assert.equal(items.reduce((n,i)=>n+i.final_price,0),120000);assert.equal(profit(items,costs),19200);
});
