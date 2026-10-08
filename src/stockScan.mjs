import {storeIndex} from './storeIndex.mjs';
export function stockMatches(data,query,exact=false){
 const code=String(query||'').trim().toLowerCase();if(!code)return {phones:[],accessories:[]};
 if(exact){const index=storeIndex(data);return {phones:index.phoneCodes.get(code)||[],accessories:index.accessoryCodes.get(code)||[]};}
 const matches=values=>values.some(value=>value!=null&&(exact?String(value).toLowerCase()===code:String(value).toLowerCase().includes(code)));
 return {phones:(data.inventory||[]).filter(p=>matches(exact?[p.barcode_value,p.stock_code,p.imei_1,p.imei_2,p.serial_number]:[p.barcode_value,p.stock_code,p.imei_1,p.imei_2,p.serial_number,p.model,p.storage])),accessories:(data.accessories||[]).filter(a=>matches(exact?[a.sku]:[a.sku,a.name,a.category]))};
}
export function phoneScannerURL(address){
 const url=new URL(address);url.search='';url.hash='scan';return url.href;
}
