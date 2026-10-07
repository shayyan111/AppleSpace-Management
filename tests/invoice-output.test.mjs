import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const bundle=await build({entryPoints:['src/output.ts','src/invoiceDetails.ts'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,outdir:'out'});
const modules=[];
for(const [index,file] of bundle.outputFiles.entries()){const p=resolve('node_modules/.cache/invoice-output-'+process.pid+'-'+index+'.mjs');await mkdir(resolve('node_modules/.cache'),{recursive:true});await writeFile(p,file.text);modules.push(await import(pathToFileURL(p).href));await unlink(p);}
const output=modules.find(m=>m.printLabel),details=modules.find(m=>m.invoiceMessage);
const sale={id:'s',invoice_number:'AS-TEST',sale_date:'2026-10-08T00:00:00Z',final_total:120000,billed_by_name:'Typed billing name'};
const snapshot={model:'iPhone 15',storage:'128GB',pta_status:'non_pta',imei_1:'111111111111111',imei_2:'222222222222222',battery_health:91};
const items=[{sale_id:'s',item_name:'iPhone 15',inventory_item_id:'p',phone_details:snapshot,quantity:1,final_price:120000},{sale_id:'s',item_name:'Cable',quantity:1,final_price:0,price_visible:false}];
const customer={full_name:'Customer',mobile:'03000000001'},payments=[{sale_id:'s',amount:100000}];
function dom(){let html='',opened='';class Element{constructor(name){this.nodeName=name;this.attributes={};this.children=[];}setAttribute(k,v){this.attributes[k]=String(v)}getAttribute(k){return this.attributes[k]??null}hasAttribute(k){return k in this.attributes}get firstChild(){return this.children[0]}appendChild(e){this.children.push(e);return e}removeChild(e){this.children.splice(this.children.indexOf(e),1)}get outerHTML(){return `<${this.nodeName} ${Object.entries(this.attributes).map(([k,v])=>`${k}="${v}"`).join(' ')}>${this.children.map(e=>e.outerHTML||'').join('')}</${this.nodeName}>`}}
 const globals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,setTimeout:globalThis.setTimeout};
 globalThis.document={createElementNS:(_ns,name)=>new Element(name),createElement:name=>name==='iframe'?{style:{},contentDocument:{open(){},write(v){html=v},close(){},images:[]},contentWindow:{focus(){},print(){}},remove(){}}:new Element(name),body:{append(){}}};globalThis.window={open(url){opened=url}};globalThis.localStorage={getItem(){return null}};globalThis.setTimeout=()=>0;
 return {html:()=>html,opened:()=>opened,restore(){for(const [k,v] of Object.entries(globals))globalThis[k]=v}};
}
test('WhatsApp invoice includes immutable phone details, billing name, totals and included accessories',()=>{
 const message=details.invoiceMessage(sale,items,payments,customer,[{id:'p',model:'Edited later',pta_status:'pta_approved'}]);
 for(const text of ['iPhone 15','Non-PTA','111111111111111','222222222222222','91%','Typed billing name','Cable — Included','20,000'])assert.ok(message.includes(text));assert.doesNotMatch(message,/Edited later|purchase_price/);
 const browser=dom();try{output.sendInvoiceWhatsApp(sale,items,payments,customer,[]);const url=new URL(browser.opened());assert.equal(url.pathname,'/923000000001');assert.equal(url.searchParams.get('text'),message);}finally{browser.restore()}
});
test('Printed invoice includes PTA, both IMEIs and snapshot details with escaped customer input',async()=>{
 const browser=dom();try{output.printInvoice(sale,items,payments,{...customer,full_name:'<script>unsafe</script>'},[]);await Promise.resolve();const html=browser.html();for(const text of ['Non-PTA','111111111111111','222222222222222','128GB','Typed billing name'])assert.ok(html.includes(text));assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);}finally{browser.restore()}
});
test('Compact phone labels include PTA and IMEI with optional health and actual QR/barcode symbols',async()=>{
 const browser=dom();try{await output.printLabel(snapshot,{copies:1,includeHealth:false});await Promise.resolve();const html=browser.html();assert.match(html,/size:50mm 30mm/);assert.match(html,/Non-PTA/);assert.match(html,/111111111111111/);assert.doesNotMatch(html,/Health/);assert.match(html,/<svg /);assert.match(html,/data:image\/png;base64/);assert.match(html,/>QR</);await output.printLabel(snapshot);assert.match(browser.html(),/Health 91%/);}finally{browser.restore()}
});
test('100 accessory labels are identical and use one SKU without exposing purchase costs',async()=>{
 const browser=dom();try{await output.printLabel({name:'Cable',category:'Cable',sku:'ACC-CABLE',purchase_price:400},{accessory:true,copies:100});const html=browser.html();assert.equal((html.match(/class="stock-label"/g)||[]).length,100);const labels=html.match(/<div class="stock-label">[\s\S]*?(?=<div class="stock-label">|<\/body>)/g);assert.equal(new Set(labels).size,1);assert.match(html,/SKU: ACC-CABLE/);assert.doesNotMatch(html.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<img[^>]*>/g,''),/purchase_price|\b400\b/);await assert.rejects(()=>output.printLabel({sku:'ACC-CABLE'},{accessory:true,copies:501}),/1 to 500/);}finally{browser.restore()}
});

test('Invoice PDF generation paginates long item histories with phone details',async()=>{
 const many=Array.from({length:30},()=>({...items[0]}));const file=await output.invoicePDF(sale,many,payments,customer,[]);assert.equal(file.type,'application/pdf');const bytes=new Uint8Array(await file.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>1);
});
