import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const built=await build({stdin:{contents:`export {default as Inventory} from './src/Inventory.tsx'; export {default as SaleForm} from './src/SaleForm.tsx'; export {default as PurchaseForm} from './src/PurchaseForm.tsx'; export {default as CustomerCRM} from './src/CustomerCRM.tsx';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',write:false});
const temp=resolve('node_modules/.cache/workflow-ui-'+process.pid+'.mjs');
await mkdir(resolve('node_modules/.cache'),{recursive:true});
await writeFile(temp,built.outputFiles[0].text);
const components=await import(pathToFileURL(temp).href);
await unlink(temp);
const profile={id:'staff',full_name:'Billing person',role:'owner',is_active:true};
const data={profile,staff:[profile],inventory:[{id:'active',model:'Active phone',status:'in_stock',imei_1:'111111111111111',stock_code:'AS-ACTIVE',default_sale_price:120000,purchase_price:98765},{id:'old',model:'Old sold phone',status:'sold',stock_code:'AS-SOLD',purchase_price:90000}],soldPhones:[],accessories:[],customers:[],sales:[],payments:[],saleItems:[]};
test('Active inventory hides sold phone rows and purchase cost columns',()=>{
  const html=renderToStaticMarkup(React.createElement(components.Inventory,{data,manager:true,busy:false,setModal(){},safe:async fn=>fn(),repair(){}}));
  assert.match(html,/Active phone/);assert.doesNotMatch(html,/Old sold phone|98765|Purchase price/);assert.match(html,/Sold phones/);assert.match(html,/Price/);
});
test('Checkout displays complete bill summary before payment, with staff and shopkeeper options',()=>{
  const html=renderToStaticMarkup(React.createElement(components.SaleForm,{data,initial:'active'}));
  assert.ok(html.indexOf('Bill summary')<html.indexOf('Payment details'));
  assert.match(html,/Shopkeeper sale/);assert.match(html,/Billing person/);assert.match(html,/Use phone camera/);assert.match(html.match(/<input[^>]*name="customer_mobile"[^>]*>/)?.[0]||'',/required/);
});
test('Registered supplier form permits optional photo and pending purchase cost',()=>{
  const html=renderToStaticMarkup(React.createElement(components.PurchaseForm,{suppliers:[],onType(){}}));
  assert.match(html,/Seller photo \(optional\)/);
  const photo=html.match(/<input[^>]*name="photo"[^>]*>/)?.[0];
  const cost=html.match(/<input[^>]*name="purchase_price"[^>]*>/)?.[0];
  assert.ok(photo);assert.ok(cost);assert.doesNotMatch(photo,/required/);assert.doesNotMatch(cost,/required/);
});
test('CRM includes an editable message and a preview without sending messages',()=>{
  const html=renderToStaticMarkup(React.createElement(components.CustomerCRM,{data,customerDue:()=>0}));
  assert.match(html,/Campaign message/);assert.match(html,/Message preview/);assert.match(html,/review before sending/);
});
