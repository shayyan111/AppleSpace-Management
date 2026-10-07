import test from 'node:test';
import assert from 'node:assert/strict';
import {customerHistory,invoiceHistory} from '../src/customerHistory.mjs';
import {purchaseHistory} from '../src/purchaseHistory.mjs';
import {campaignMatches,campaignRecipients,campaignMessage} from '../src/campaign.mjs';
import {due} from '../src/math.mjs';
test('A customer remains outstanding until all invoices and legacy balances are settled',()=>{
 const customer={id:'c',full_name:'Paid contact',mobile:'03000000000'};
 const data={sales:[{id:'s',customer_id:'c',final_total:100},{id:'old',customer_id:'c',final_total:20,is_opening_balance:true},{id:'other',customer_id:'other',final_total:999}],payments:[{sale_id:'s',amount:100},{sale_id:'old',amount:10}],customers:[customer]};
 assert.equal(customerHistory(data,customer).balance,10);
 assert.deepEqual(invoiceHistory(data).map(s=>s.id),['s','other']);
 data.payments.push({sale_id:'old',amount:10});
 assert.equal(customerHistory(data,customer).balance,0);
 assert.deepEqual(invoiceHistory(data).map(s=>s.id),['s','old','other']);
 assert.equal(data.customers.length,1);assert.equal(customerHistory(data,customer).totalSpent,100);
});
test('Fully paid decimal amounts have no residual customer balance',()=>{
 assert.equal(due({id:'s',final_total:0.3},[{sale_id:'s',amount:0.1},{sale_id:'s',amount:0.2}],'sale_id','final_total'),0);
 assert.equal(due({id:'s',final_total:0.8},[{sale_id:'s',amount:0.1},{sale_id:'s',amount:0.7}],'sale_id','final_total'),0);
 assert.equal(due({id:'s',final_total:0.6},[{sale_id:'s',amount:0.1},{sale_id:'s',amount:0.5}],'sale_id','final_total'),0);
});
test('Purchases include seller, sold phone details and only the matching payment balance',()=>{
 const p=purchaseHistory({suppliers:[],walkInSellers:[{id:'w',full_name:'Walk-in name'}],inventory:[{id:'i',purchase_id:'p',model:'iPhone 16',storage:'128GB',imei_1:'111111111111111',imei_2:'222222222222222',status:'sold'}],supplierPayments:[{purchase_id:'p',amount:60},{purchase_id:'other',amount:100}]},{id:'p',seller_id:'w',total_amount:100});
 assert.equal(p.seller.full_name,'Walk-in name');assert.match(p.model,/iPhone 16/);assert.match(p.imei,/111111111111111/);assert.equal(p.payable,40);assert.equal(p.phones.length,1);
});
test('Campaigns filter purchased model names, and only selected reachable contacts receive drafts',()=>{
 const contacts=[{id:'paid',full_name:'Ali',mobile:'03000000001',balance:0,phones:[{name:'iPhone 16'}],lastPhone:'iPhone 16'},{id:'due',full_name:'Sara',mobile:'03000000002',balance:100,phones:[]},{id:'missing',full_name:'No phone',mobile:'',phones:[]}];
 assert.equal(campaignMatches(contacts[0],'all','iPhone 16'),true);
 assert.equal(campaignMatches(contacts[0],'outstanding',''),false);
 assert.equal(campaignMatches(contacts[1],'outstanding',''),true);
 const recipients=campaignRecipients(contacts,new Set(['paid','missing','deleted-id']));
 assert.deepEqual(recipients.map(c=>c.id),['paid']);
 assert.equal(campaignMessage('Hello {name}, offer for {last_phone}: {custom}','10% off',recipients[0]),'Hello Ali, offer for iPhone 16: 10% off');
});
