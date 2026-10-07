import logo from './assets/applespace-logo.png';
import regularFont from './fonts/DejaVuSans.ttf?url';
import boldFont from './fonts/DejaVuSans-Bold.ttf?url';
import {money,localDay} from './math.mjs';
import {phoneDetails,phoneDetailLines,paymentLines} from './invoiceDetails';
type Row=Record<string,any>;
type Element={type:'text'|'image';x:number;y:number;width?:number;height?:number;text?:string;size?:number;bold?:boolean;color?:string;url?:string;opacity?:number;alt?:string};
export type FormPage={width:number;height:number;elements:Element[]};
const present=(v:unknown)=>v!=null&&String(v).trim()!=='';
function wrap(value:string,width:number,size:number){const max=Math.max(8,Math.floor(width/(size*.6)));const result:string[]=[];for(const paragraph of value.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(line&&line.length+word.length+1>max){result.push(line);line=''}if(word.length>max){if(line){result.push(line);line=''}for(let i=0;i<word.length;i+=max)result.push(word.slice(i,i+max));}else line+=(line?' ':'')+word;}if(line)result.push(line);}return result;}
function text(page:FormPage,x:number,y:number,value:unknown,size=12,width=0,bold=false,color='#171717'){if(!present(value))return;const label=String(value);if(width)size=Math.min(size,width/Math.max(1,label.length*.54));page.elements.push({type:'text',x,y,text:label,size,bold,color,width});}
function multiline(page:FormPage,x:number,y:number,value:string,width:number,size=10){const lines=wrap(value,width,size);lines.forEach((line,i)=>text(page,x,y+i*(size+4),line,size));return y+lines.length*(size+4);}
function form(title:string):FormPage{
 const p:FormPage={width:595.28,height:841.89,elements:[]};
 p.elements.push({type:'image',x:82.64,y:310,width:430,height:260,url:logo,opacity:.14,alt:'AppleSpace logo watermark'});
 p.elements.push({type:'image',x:25,y:22,width:112,height:81,url:logo,alt:'AppleSpace logo'});
 text(p,145,65,'APPLE SPACE',23,235,true);text(p,145,84,'Trusted Apple Products Provider',8.5,235,false,'#626262');text(p,145,105,title,11,235,true);
 text(p,405,40,'Sharoz Abbasi',11,148,true);text(p,405,57,'+92 334 5136382',10,148);text(p,405,82,'Saad Ali Awan',11,148,true);text(p,405,99,'+92 311 5701370',10,148);
 text(p,42,134,'Shop 103 & 104, Mezzanine Floor, Noor Mobile Mall,',9.5,320);text(p,42,151,'6th Road, Rawalpindi',9.5,320);
 return p;
}
function footer(p:FormPage,index:number,count:number){text(p,42,814,'APPLE SPACE  /  Thank you for your trust.',9,400,false,'#626262');text(p,487,814,`Page ${index+1} of ${count}`,9,67,false,'#626262');}
export function saleFormPages(sale:Row,items:Row[],payments:Row[],customer:Row|undefined,phones:Row[]):FormPage[]{
 const pages:FormPage[]=[];const create=()=>{const p=form(sale.is_opening_balance?'BALANCE RECEIPT':'SALES INVOICE');pages.push(p);
 text(p,42,190,'BILL TO',9,0,true,'#626262');text(p,42,210,customer?.full_name||'Walk-in',14,285,true);text(p,42,229,customer?.mobile,11,285);
 text(p,365,190,'INVOICE',9,0,true,'#626262');text(p,365,208,sale.invoice_number,11,188,true);text(p,365,227,localDay(sale.sale_date),11);
 if(sale.is_opening_balance)text(p,42,247,'Prior record: '+(sale.opening_reference||''),10,510);
 text(p,42,274,'PRODUCT',10,0,true,'#626262');text(p,352,274,'QTY',10,0,true,'#626262');text(p,392,274,'RATE',10,0,true,'#626262');text(p,484,274,'AMOUNT',10,0,true,'#626262');return p;};
 let page=create(),y=300;
 for(const item of items.filter(i=>i.sale_id===sale.id)){
  const phone=phoneDetails(item,phones),name=phone?.model||item.item_name||'Product';
  const lines=[...wrap(String(name),293,13).map(value=>({value,size:13,bold:true})),...phoneDetailLines(phone).flatMap(detail=>wrap(detail,293,10.5).map(value=>({value,size:10.5,bold:false}))),...(Number(item.discount)>0?[{value:'Discount: '+money(item.discount),size:10.5,bold:false}]:[])];
  const height=lines.reduce((n,line)=>n+line.size+4,0)+16;if(y+height>560&&height<=260){page=create();y=300;}
  let first=true;
  for(const line of lines){if(y+line.size+4>548){page=create();y=300;text(page,42,y,String(name)+' (continued)',12,293,true);y+=20;}
   if(first){text(page,352,y,item.quantity||1,11,30);text(page,392,y,item.price_visible===false?'Included':money(item.unit_price??item.final_price),11,83);text(page,484,y,item.price_visible===false?'Included':money(item.final_price),11,70);first=false;}
   text(page,42,y,line.value,line.size,0,line.bold,line.bold?'#171717':'#505050');y+=line.size+4;
  }y+=16;
 }
 const matching=payments.filter(p=>p.sale_id===sale.id),paid=matching.reduce((n,p)=>n+Number(p.amount),0),methods=paymentLines(matching,'Received');
 pages.forEach((p,index)=>{
  text(p,42,586,'PAYMENT RECEIVED',9,0,true,'#626262');(methods.length?methods:['Payment: Unpaid']).forEach((line,i)=>text(p,42,607+i*15,line.replace(/^Received by /,''),10,260));
  text(p,359,590,sale.is_opening_balance?'Opening balance':'Total bill',11);text(p,462,590,money(sale.final_total),12,92,true);text(p,359,619,'Received',11);text(p,462,619,money(paid),12,92);text(p,359,652,'BALANCE',11,0,true);text(p,462,652,money(Math.max(0,Number(sale.final_total)-paid)),15,92,true);
  text(p,42,684,'Bill made by: '+(sale.billed_by_name||'Staff'),10,505);
  text(p,42,714,'TERMS & CONDITIONS',9,0,true,'#626262');
  const terms=['10-15% deduction on return of new or used phones within one week, at the current rate.','7 days check warranty. Screen and camera dots/shadows must be checked on the spot.','Touch or Face ID faults are not claimable. New-phone prices may change with exchange rates.'];let ty=731;for(const term of terms)ty=multiline(p,42,ty,term,508,8.5);
  footer(p,index,pages.length);
 });return pages;
}
export function purchaseFormPages(purchase:Row,items:Row[],supplier:Row|undefined,payments:Row[],accessories:Row[]=[]):FormPage[]{
 const saved=Array.isArray(purchase.item_details)&&purchase.item_details.length?purchase.item_details:items.filter(i=>i.purchase_id===purchase.id).concat(accessories.filter(a=>a.purchase_id===purchase.id));
 const products=saved.length?saved:[{model:'Stock purchase',purchase_price:purchase.total_amount}];const matching=payments.filter(p=>p.purchase_id===purchase.id),paid=matching.reduce((n,p)=>n+Number(p.amount),0);
 const pages:FormPage[]=[];
 for(const item of products){
  const create=()=>{const p=form('PURCHASE SLIP');pages.push(p);text(p,405,134,'Ref #'+purchase.purchase_number,11,148,true);text(p,405,151,localDay(purchase.purchase_date),10,148);
   text(p,42,192,'SELLER INFORMATION',9,0,true,'#626262');text(p,42,215,supplier?.full_name||'Seller',15,355,true);if(present(supplier?.mobile))text(p,42,236,'Contact: '+supplier!.mobile,11,355);if(present(supplier?.cnic))text(p,42,257,'CNIC: '+supplier!.cnic,11,355);
   if(supplier?.print_photo_url){p.elements.push({type:'image',x:448,y:179,width:105,height:112,url:supplier.print_photo_url,alt:'Seller photo'});text(p,448,306,'Seller photo',9,105,false,'#626262');}
   text(p,42,325,'PRODUCT DETAILS',9,0,true,'#626262');return p;};
  let p=create(),y=348;
  const lines=[...wrap(String(item.model||item.name||'Product'),510,15).map(value=>({value,size:15,bold:true})),...phoneDetailLines(item).flatMap(detail=>wrap(detail,510,11).map(value=>({value,size:11,bold:false}))),...(present(item.sku)?[{value:'Barcode / SKU: '+item.sku,size:11,bold:false}]:[]),...(present(item.name)&&present(item.quantity)?[{value:'Quantity purchased: '+item.quantity,size:11,bold:false}]:[]),...wrap(purchase.notes?'Notes: '+purchase.notes:'',510,11).map(value=>({value,size:11,bold:false}))];
  for(const line of lines){if(y+line.size+4>541){p=create();y=348;text(p,42,y,'Product details (continued)',12,510,true);y+=20;}text(p,42,y,line.value,line.size,0,line.bold,line.bold?'#171717':'#505050');y+=line.size+4;}
 }
 pages.forEach((p,index)=>{
  text(p,42,577,'PAYMENT DETAILS',9,0,true,'#626262');const methods=paymentLines(matching,'Paid');(methods.length?methods:['Payment: Unpaid']).forEach((line,i)=>text(p,42,598+i*15,line,10,280));
  text(p,359,580,'Purchase price',10,95);text(p,462,580,purchase.costPending?'Cost pending':money(purchase.total_amount),12,92,true);text(p,359,611,'Paid',11);text(p,462,611,money(paid),12,92);text(p,359,644,'PAYABLE',11,0,true);text(p,462,644,purchase.costPending?'Cost pending':money(Math.max(0,Number(purchase.total_amount)-paid)),15,92,true);
  text(p,42,683,'SELLER DECLARATION',9,0,true,'#626262');multiline(p,42,702,'I declare that the above device(s) are my lawful property and are sold voluntarily to APPLE SPACE. All provided information, including IMEI and specifications, is accurate. I accept legal responsibility in case of theft, misrepresentation, dispute, blacklist or network blocking in the future.',510,9.5);
  text(p,42,782,'Seller signature',10,145,false,'#626262');text(p,229,782,'Seller thumb',10,130,false,'#626262');text(p,424,782,"Buyer's signature",10,130,false,'#626262');footer(p,index,pages.length);
 });return pages;
}
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function formsHTML(pages:FormPage[]){return pages.map(p=>`<div class="reference-form">${p.elements.filter(e=>e.type==='image').map(e=>`<img alt="${esc(e.alt||'Image')}" src="${esc(e.url)}" style="position:absolute;left:${e.x/p.width*100}%;top:${e.y/p.height*100}%;width:${(e.width||0)/p.width*100}%;height:${(e.height||0)/p.height*100}%;object-fit:contain;opacity:${e.opacity??1}"/>`).join('')}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.width} ${p.height}" preserveAspectRatio="none">${p.elements.filter(e=>e.type==='text').map(e=>`<text x="${e.x}" y="${e.y}" font-family="AppleSpaceForm, Arial, sans-serif" font-size="${e.size}" font-weight="${e.bold?'bold':'normal'}" fill="${e.color}">${esc(e.text)}</text>`).join('')}</svg></div>`).join('')}
export const formsCSS=`@font-face{font-family:AppleSpaceForm;src:url("${regularFont}");font-weight:normal}@font-face{font-family:AppleSpaceForm;src:url("${boldFont}");font-weight:bold}@page{size:A4;margin:0}body{margin:0!important;width:210mm!important;background:#fff!important}.reference-form{position:relative;width:210mm;height:297mm;background:#fff;break-after:page;overflow:hidden}.reference-form:last-child{break-after:auto}.reference-form>svg{position:absolute;inset:0;width:100%;height:100%;max-width:none}`;
async function bytes(url:string){const response=await fetch(url);if(!response.ok)throw Error('Could not load the seller photo. Please retry.');return new Uint8Array(await response.arrayBuffer())}
export async function printablePhoto(url:string){const data=await bytes(url);let type='';if(data[0]===137&&data[1]===80)type='image/png';else if(data[0]===255&&data[1]===216)type='image/jpeg';if(type){let binary='';for(let i=0;i<data.length;i+=32768)binary+=String.fromCharCode(...data.subarray(i,i+32768));return 'data:'+type+';base64,'+btoa(binary);}
 const objectUrl=URL.createObjectURL(new Blob([data]));try{const photo=new Image();await new Promise<void>((resolve,reject)=>{photo.onload=()=>resolve();photo.onerror=()=>reject(Error('Could not load seller photo.'));photo.src=objectUrl});const canvas=document.createElement('canvas');canvas.width=photo.naturalWidth;canvas.height=photo.naturalHeight;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Could not prepare seller photo.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(photo,0,0);return canvas.toDataURL('image/jpeg',.95);}finally{URL.revokeObjectURL(objectUrl)}
}
export async function formsPDF(pages:FormPage[],name:string){
 const [{PDFDocument,rgb},{default:fontkit}]=await Promise.all([import('pdf-lib'),import('@pdf-lib/fontkit')]);const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const [font,bold]=await Promise.all([pdf.embedFont(await bytes(regularFont),{subset:true}),pdf.embedFont(await bytes(boldFont),{subset:true})]);const cache=new Map<string,any>();const supported=new Set(font.getCharacterSet());
 async function embed(url:string){if(!cache.has(url)){const data=await bytes(url);cache.set(url,data[0]===255?await pdf.embedJpg(data):await pdf.embedPng(data));}return cache.get(url)}
 const color=(hex='#171717')=>{const full=hex.length===4?'#'+hex.slice(1).split('').map(c=>c+c).join(''):hex;return rgb(parseInt(full.slice(1,3),16)/255,parseInt(full.slice(3,5),16)/255,parseInt(full.slice(5,7),16)/255)};
 for(const form of pages){const page=pdf.addPage([form.width,form.height]);for(const e of form.elements){if(e.type==='text'){const value=Array.from(String(e.text)).map(c=>supported.has(c.codePointAt(0)!)?c:'?').join(''),selected=e.bold?bold:font;const size=Math.min(e.size||12,e.width?e.width/Math.max(1,selected.widthOfTextAtSize(value,1)):Infinity);page.drawText(value,{x:e.x,y:form.height-e.y,size,font:selected,color:color(e.color)});}else if(e.type==='image'&&e.url){const img=await embed(e.url),boxWidth=e.width||0,boxHeight=e.height||0,scale=Math.min(boxWidth/img.width,boxHeight/img.height);page.drawImage(img,{x:e.x+(boxWidth-img.width*scale)/2,y:form.height-(e.y+boxHeight)+(boxHeight-img.height*scale)/2,width:img.width*scale,height:img.height*scale,opacity:e.opacity??1});}}}
 return new File([new Uint8Array(await pdf.save())],name+'.pdf',{type:'application/pdf'});
}
