import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const built=await build({stdin:{contents:`export {default as AccessoryForm} from './src/AccessoryForm.tsx'; export {default as ExpenseForm} from './src/ExpenseForm.tsx'; export {default as LabelForm} from './src/LabelForm.tsx'; export {default as InvoiceWhatsApp} from './src/InvoiceWhatsApp.tsx'; export {default as LedgerPage} from './src/LedgerPage.tsx'; export {default as Purchases} from './src/Purchases.tsx'; export {default as Customers} from './src/Customers.tsx'; export {default as RecordCleanup} from './src/RecordCleanup.tsx'; export {default as Inventory} from './src/Inventory.tsx'; export {default as SaleForm} from './src/SaleForm.tsx'; export {default as PurchaseForm} from './src/PurchaseForm.tsx'; export {default as CustomerCRM} from './src/CustomerCRM.tsx';`,resolveDir:process.cwd(),loader:'ts'},loader:{'.png':'dataurl','.ttf':'dataurl'},bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',write:false});
const temp=resolve('node_modules/.cache/workflow-ui-'+process.pid+'.mjs');
await mkdir(resolve('node_modules/.cache'),{recursive:true});
await writeFile(temp,built.outputFiles[0].text);
const components=await import(pathToFileURL(temp).href);
await unlink(temp);
const profile={id:'staff',full_name:'Billing person',role:'owner',is_active:true};
const data={profile,staff:[profile],inventory:[{id:'active',model:'Active phone',pta_status:'non_pta',status:'in_stock',imei_1:'111111111111111',stock_code:'AS-ACTIVE',default_sale_price:120000,purchase_price:98765},{id:'old',model:'Old sold phone',status:'sold',stock_code:'AS-SOLD',purchase_price:90000}],soldPhones:[],accessories:[],customers:[],sales:[],payments:[],saleItems:[]};
test('Active inventory hides sold rows and shows separate purchase and sale prices to managers',()=>{
  const html=renderToStaticMarkup(React.createElement(components.Inventory,{data,manager:true,busy:false,setModal(){},safe:async fn=>fn(),repair(){}}));
  assert.match(html,/Active phone/);assert.doesNotMatch(html,/Old sold phone/);assert.match(html,/Sold phones/);assert.match(html,/Purchase cost/);assert.match(html,/98,765/);assert.match(html,/Sale price/);
  const staff=renderToStaticMarkup(React.createElement(components.Inventory,{data,manager:false,busy:false,setModal(){},safe:async fn=>fn(),repair(){}}));assert.doesNotMatch(staff,/98,765|<th>Purchase cost/);
});
test('Checkout displays complete bill summary before payment, with staff and shopkeeper options',()=>{
  const html=renderToStaticMarkup(React.createElement(components.SaleForm,{data,initial:'active'}));
  assert.ok(html.indexOf('Bill summary')<html.indexOf('Payment details'));
  assert.match(html,/Shopkeeper sale/);assert.match(html,/Billing person/);assert.match(html.match(/<input[^>]*name="billed_by_name"[^>]*>/)?.[0]||'',/required/);assert.doesNotMatch(html,/<select[^>]*name="billed_by"/);assert.match(html,/PTA: Non-PTA/);assert.match(html,/IMEI: 111111111111111/);assert.match(html,/Use phone camera/);assert.match(html.match(/<input[^>]*name="customer_mobile"[^>]*>/)?.[0]||'',/required/);
});
test('Registered supplier details are optional and phone cost, storage and PTA are required',()=>{
  const html=renderToStaticMarkup(React.createElement(components.PurchaseForm,{suppliers:[],onType(){}}));
  assert.match(html,/Seller photo \(optional\)/);
  const photo=html.match(/<input[^>]*name="photo"[^>]*>/)?.[0];
  const cost=html.match(/<input[^>]*name="purchase_price"[^>]*>/)?.[0];
  assert.ok(photo);assert.ok(cost);assert.doesNotMatch(photo,/required/);assert.match(cost,/required/);
  assert.match(html.match(/<input[^>]*name="paid"[^>]*>/)?.[0]||'',/required/);
  for(const name of ['storage','pta_status'])assert.match(html.match(new RegExp('<select[^>]*name="'+name+'"[^>]*>'))?.[0]||'',/required/);
  for(const name of ['mobile','cnic'])assert.doesNotMatch(html.match(new RegExp('<input[^>]*name="'+name+'"[^>]*>'))?.[0]||'',/required/);
  assert.match(html.match(/<input[^>]*name="supplier_name"[^>]*>/)?.[0]||'',/required/);
});
test('CRM includes an editable message and a preview without sending messages',()=>{
  const html=renderToStaticMarkup(React.createElement(components.CustomerCRM,{data,customerDue:()=>0}));
  assert.match(html,/Campaign message/);assert.match(html,/Message preview/);assert.match(html,/review before sending/);
});

test('Cleanup is owner-only and requires a preview before any delete control is displayed',()=>{
 const props={owner:true,preview:async()=>{},remove:async()=>{},exportBackup:async()=>{},refresh:async()=>{}};
 const html=renderToStaticMarkup(React.createElement(components.RecordCleanup,props));
 assert.match(html,/Current year protected/);assert.match(html,/From date \(inclusive\)/);assert.match(html,/To date \(inclusive\)/);assert.match(html,/Preview records/);
 assert.doesNotMatch(html,/Delete eligible old records/);
 const denied=renderToStaticMarkup(React.createElement(components.RecordCleanup,{...props,owner:false}));
 assert.match(denied,/requires an active owner account/);assert.doesNotMatch(denied,/type="date"|Preview records/);
});

test('Purchase list displays seller, IMEI, model, total and payable for sold and active phones',()=>{
 const input={...data,purchases:[{id:'p',purchase_number:17,seller_id:'vendor',purchase_date:'2026-10-01',total_amount:1000}],suppliers:[{id:'vendor',full_name:'Test supplier'}],inventory:[{id:'phone',purchase_id:'p',model:'iPhone 15',imei_1:'111111111111111',status:'sold'}],supplierPayments:[{purchase_id:'p',amount:400}]};
 const html=renderToStaticMarkup(React.createElement(components.Purchases,{data:input,search:'',setSearch(){},setModal(){},print(){},exportRows(){}}));
 for(const text of ['Seller name','IMEI','Model','Total','Payable','Test supplier','111111111111111','iPhone 15','600'])assert.ok(html.includes(text));
 const matching=renderToStaticMarkup(React.createElement(components.Purchases,{data:input,search:'Test supplier',setSearch(){},setModal(){},print(){},exportRows(){}}));
 assert.match(matching,/iPhone 15/);
});
test('Customers list removes a settled contact while CRM retains it for selectable offers',()=>{
 const input={...data,customers:[{id:'settled',full_name:'Settled contact',mobile:'03000000001'},{id:'pending',full_name:'Pending contact',mobile:'03000000002'}],sales:[{id:'s1',customer_id:'settled',final_total:100,sale_date:'2026-10-01'},{id:'s2',customer_id:'pending',final_total:100,sale_date:'2026-10-01'}],payments:[{sale_id:'s1',amount:100}],saleItems:[{id:'item',sale_id:'s1',inventory_item_id:'old',item_name:'iPhone 13'}]};
 const props={data:input,manager:true,setModal(){},customerDue:()=>0,safe:async fn=>fn()};
 const html=renderToStaticMarkup(React.createElement(components.Customers,props));
 assert.match(html,/Pending contact/);assert.doesNotMatch(html,/Settled contact/);
 const crm=renderToStaticMarkup(React.createElement(components.CustomerCRM,{data:input}));
 assert.match(crm,/Select Settled contact/);assert.match(crm,/Select all matching customers/);assert.match(crm,/Prepare selected messages/);assert.match(crm,/iPhone 13/);assert.doesNotMatch(crm,/\[object Object\]/);
});

test('Both ledger pages show other balances and hide them from salespeople',()=>{
 const input={...data,ledgerEntries:[{id:'r',kind:'receivable',category:'existing_balance',full_name:'Loan receivable',description:'Old loan',record_date:'2026-10-01',amount:500},{id:'p',kind:'payable',category:'expense_owed',full_name:'Rent payable',description:'Unpaid rent',record_date:'2026-10-01',amount:200}],ledgerPayments:[]};
 for(const [kind,name,button] of [['receivable','Loan receivable','Add other receivable'],['payable','Rent payable','Add other payable']]){
  const html=renderToStaticMarkup(React.createElement(components.LedgerPage,{kind,data:input,manager:true,save:async()=>{},setModal(){}}));assert.match(html,new RegExp(name));assert.match(html,new RegExp(button));assert.match(html,/All records \/ history/);
  const denied=renderToStaticMarkup(React.createElement(components.LedgerPage,{kind,data:input,manager:false,save:async()=>{},setModal(){}}));assert.doesNotMatch(denied,new RegExp(name));assert.match(denied,/Owner or manager access/);
 }
});

test('Expense description is required only for Other categories',()=>{
 for(const [phone,category,required] of [[false,'Rent',false],[false,'Other',true],[true,'Repair',false],[true,'Other phone expense',true]]){
  const html=renderToStaticMarkup(React.createElement(components.ExpenseForm,{phone,initialCategory:category}));const input=html.match(/<input[^>]*name="description"[^>]*>/)?.[0]||'';if(required)assert.match(input,/required/);else assert.doesNotMatch(input,/required/);
 }
});
test('Accessory label form prints one shared label regardless of stock quantity',()=>{
 const html=renderToStaticMarkup(React.createElement(components.LabelForm,{item:{name:'Cable',quantity:100},accessory:true,safe:async f=>f()}));assert.doesNotMatch(html,/type="number"/);assert.match(html,/one shared accessory SKU/);assert.doesNotMatch(html,/Include battery health/);assert.match(html,/<option value="40x25" selected="">/);assert.match(html,/50 × 30 mm/);assert.match(html,/100% \/ actual size/);
});

test('Accessory quantity additions request neither cost nor supplier; new purchases require supplier name',()=>{
 const base={item:{name:'Cable',quantity:100},suppliers:[],onType(){}};
 const restock=renderToStaticMarkup(React.createElement(components.AccessoryForm,{...base,action:'accessory_restock'}));assert.doesNotMatch(restock,/name="purchase_price"|name="supplier_id"|name="supplier_name"/);assert.match(restock,/existing supplier/);assert.match(restock,/name="quantity"/);
 const purchase=renderToStaticMarkup(React.createElement(components.AccessoryForm,{...base,action:'accessory_purchase'}));assert.match(purchase.match(/<input[^>]*name="supplier_name"[^>]*>/)?.[0]||'',/required/);
});
test('Receivables offer balance reminders only for outstanding balances',()=>{
 const input={...data,ledgerEntries:[{id:'r',kind:'receivable',category:'existing_balance',full_name:'Debtor',mobile:'03000000001',description:'',record_date:'2026-10-01',amount:100}],ledgerPayments:[]};const props={kind:'receivable',data:input,manager:true,save:async()=>{},setModal(){}};assert.match(renderToStaticMarkup(React.createElement(components.LedgerPage,props)),/Remind on WhatsApp/);
 assert.doesNotMatch(renderToStaticMarkup(React.createElement(components.LedgerPage,{...props,data:{...input,ledgerPayments:[{entry_id:'r',amount:100}]}})),/Remind on WhatsApp/);
});


test('WhatsApp PDF dialog names the customer and prepares the file before enabling sending',()=>{
 const html=renderToStaticMarkup(React.createElement(components.InvoiceWhatsApp,{sale:{id:'s',invoice_number:'AS-123'},items:[],payments:[],customer:{full_name:'Invoice customer',mobile:'03000000001'},phones:[]}));
 assert.match(html,/AS-123.pdf/);assert.match(html,/Invoice customer/);assert.match(html,/03000000001/);assert.match(html,/Preparing invoice PDF/);assert.doesNotMatch(html,/Send PDF via WhatsApp|Download PDF &amp; open WhatsApp/);
});
