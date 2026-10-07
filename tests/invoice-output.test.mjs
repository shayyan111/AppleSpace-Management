import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const bundle=await build({entryPoints:['src/output.ts','src/invoiceDetails.ts','src/documentForms.ts'],loader:{'.png':'dataurl','.ttf':'dataurl'},bundle:true,platform:'node',format:'esm',packages:'external',write:false,outdir:'out'});
const modules=[];
for(const [index,file] of bundle.outputFiles.entries()){const p=resolve('node_modules/.cache/invoice-output-'+process.pid+'-'+index+'.mjs');await mkdir(resolve('node_modules/.cache'),{recursive:true});await writeFile(p,file.text);modules.push(await import(pathToFileURL(p).href));await unlink(p);}
const output=modules.find(m=>m.printLabel),details=modules.find(m=>m.invoiceMessage),forms=modules.find(m=>m.saleFormPages);
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

test('Missing phone fields are omitted while payment methods appear in invoice messages and forms',()=>{
 const minimal=[{...items[0],phone_details:{model:'iPhone 15',imei_1:'111111111111111',battery_health:'',pta_status:'',color:null}}];const paid=[{sale_id:'s',amount:100000,method:'bank_transfer'},{sale_id:'s',amount:20000,method:'cash'}];const message=details.invoiceMessage(sale,minimal,paid,customer,[]);assert.doesNotMatch(message,/Battery|PTA:|Color:|Storage:|Not recorded/);assert.match(message,/Received by Bank transfer/);assert.match(message,/Received by Cash/);
 const pages=forms.saleFormPages(sale,minimal,paid,customer,[]);const texts=pages.flatMap(p=>p.elements.filter(e=>e.type==='text').map(e=>e.text)).join('\n');assert.match(texts,/PRODUCT/);assert.doesNotMatch(texts,/Phone \/ IMEI|Battery|PTA:|Color:/);assert.match(texts,/Bank transfer/);
});
test('Purchase form includes price, payment methods, seller photo and saved product details without a separate receipt',async()=>{
 const purchase={id:'p',purchase_number:19,purchase_date:'2026-10-08',total_amount:100000,item_details:[{...snapshot,purchase_price:100000}]};const seller={full_name:'Seller',cnic:'1234567890123',mobile:'03000000002',print_photo_url:'data:image/png;base64,photo'};const pages=forms.purchaseFormPages(purchase,[],seller,[{purchase_id:'p',amount:50000,method:'cash'},{purchase_id:'p',amount:40000,method:'bank_transfer'}]);const texts=pages.flatMap(p=>p.elements.filter(e=>e.type==='text').map(e=>e.text)).join('\n');assert.match(texts,/Purchase price/);assert.match(texts,/100,000/);assert.match(texts,/Paid by Bank transfer/);assert.match(texts,/Paid by Cash/);assert.match(texts,/Seller/);assert.match(texts,/111111111111111/);assert.ok(pages[0].elements.some(e=>e.type==='image'&&e.url===seller.print_photo_url));
 const file=await forms.formsPDF(forms.purchaseFormPages(purchase,[],{...seller,print_photo_url:undefined},[]),'purchase-test');const {PDFDocument}=await import('pdf-lib');assert.equal((await PDFDocument.load(await file.arrayBuffer())).getPageCount(),1);
});
test('Balance reminder states the amount and reference without sending anything',()=>{
 const message=details.receivableReminder({person:'Customer',reference:'AS-TEST',balance:5000});assert.match(message,/5,000/);assert.match(message,/AS-TEST/);assert.match(message,/Customer/);
});


test('Borderless invoice uses a white page with a logo watermark behind the details and no seller signature',()=>{
 const pages=forms.saleFormPages(sale,items,payments,customer,[]);const html=forms.formsHTML(pages);assert.doesNotMatch(html,/<line|<rect|<table|form-background|Seller signature/);assert.match(forms.formsCSS,/background:#fff/);for(const p of pages){const watermark=p.elements.find(e=>e.alt==='AppleSpace logo watermark'),header=p.elements.find(e=>e.alt==='AppleSpace logo');assert.ok(watermark&&watermark.opacity>0&&watermark.opacity<.2);assert.equal(header.url,watermark.url);assert.ok(p.elements.indexOf(watermark)<p.elements.findIndex(e=>e.text==='PRODUCT'));}assert.ok(html.indexOf('AppleSpace logo watermark')<html.indexOf('<svg'));assert.match(html,/opacity:0.14/);
});
test('Purchase slip prints one main seller section and embeds a saved photo into the PDF',async()=>{
 const url='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1EAAAAASUVORK5CYII=';
 const purchase={id:'p',purchase_number:19,purchase_date:'2026-10-08',total_amount:100000,item_details:[{...snapshot,purchase_price:100000}]};const pages=forms.purchaseFormPages(purchase,[],{full_name:'Seller',print_photo_url:url},[]);const texts=pages[0].elements.filter(e=>e.type==='text').map(e=>e.text);assert.equal(texts.filter(v=>v==='SELLER INFORMATION').length,1);assert.ok(!texts.some(v=>/seller receipt/i.test(v)));const photo=pages[0].elements.find(e=>e.alt==='Seller photo');assert.ok(photo.width>=100&&photo.height>=110);const html=forms.formsHTML(pages);assert.equal((html.match(/alt="Seller photo"/g)||[]).length,1);assert.match(html,/alt="Seller photo"/);
 const file=await forms.formsPDF(pages,'photo-slip');const {PDFDocument,PDFName}=await import('pdf-lib');const pdf=await PDFDocument.load(await file.arrayBuffer());assert.equal(pdf.getPageCount(),1);assert.equal(new Set(pdf.getPage(0).node.Resources().lookup(PDFName.of('XObject')).entries().map(([,ref])=>ref.toString())).size,2);
});
test('Long invoice and purchase details paginate inside the content area without clipping',()=>{
 const note='Long recorded warranty details '.repeat(200);const long={...snapshot,warranty_notes:note};for(const pages of [forms.saleFormPages(sale,[{...items[0],phone_details:long}],payments,customer,[]),forms.purchaseFormPages({id:'p',purchase_number:1,purchase_date:'2026-10-08',total_amount:100,item_details:[long]},[],{full_name:'Seller'},[])]){assert.ok(pages.length>1);assert.ok(pages.every(p=>p.elements.every(e=>e.y<=p.height-20)));const content=pages.flatMap(p=>p.elements.filter(e=>e.text?.includes('recorded warranty')).map(e=>e.text));assert.ok(content.length>5);assert.ok(pages.every(p=>p.elements.some(e=>e.text?.startsWith('Page '))));}
});


test('Both document headers include the logo, business name and top-right business contacts',()=>{
 const purchase={id:'p',purchase_number:19,purchase_date:'2026-10-08',total_amount:100000,item_details:[snapshot]};for(const pages of [forms.saleFormPages(sale,items,payments,customer,[]),forms.purchaseFormPages(purchase,[],{full_name:'Seller'},[])]){for(const p of pages){assert.ok(p.elements.some(e=>e.alt==='AppleSpace logo'));assert.ok(p.elements.some(e=>e.text==='APPLE SPACE'));for(const value of ['Sharoz Abbasi','+92 334 5136382','Saad Ali Awan','+92 311 5701370'])assert.ok(p.elements.some(e=>e.text===value&&e.x>390&&e.y<110));}}const purchaseTexts=forms.purchaseFormPages(purchase,[],{},[])[0].elements.map(e=>e.text).join('\n');assert.match(purchaseTexts,/Seller signature/);assert.doesNotMatch(purchaseTexts,/seller receipt/i);
});
