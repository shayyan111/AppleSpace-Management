import {money} from './math.mjs';
type Row=Record<string,any>;
export function ptaName(value:unknown){return ({non_pta:'Non-PTA',pta_approved:'PTA Approved',jv:'JV'} as Record<string,string>)[String(value)]||String(value||'Not recorded').replaceAll('_',' ')}
export function phoneDetails(item:Row,phones:Row[]){return item.phone_details&&Object.keys(item.phone_details).length?item.phone_details:phones.find(p=>p.id===item.inventory_item_id)||null}
export function phoneDetailLines(phone:Row|null,includeHealth=true){if(!phone)return [];return [phone.storage?`Storage: ${phone.storage}`:'',`PTA: ${ptaName(phone.pta_status)}`,phone.imei_1?`IMEI: ${phone.imei_1}`:phone.serial_number?`Serial: ${phone.serial_number}`:'',phone.imei_2?`IMEI 2: ${phone.imei_2}`:'',includeHealth&&phone.battery_health!=null?`Battery health: ${phone.battery_health}%`:''].filter(Boolean)}
export function invoiceMessage(sale:Row,items:Row[],payments:Row[],customer:Row|undefined,phones:Row[]){
 const lines=items.filter(i=>i.sale_id===sale.id).flatMap(i=>{const phone=phoneDetails(i,phones);return [`${phone?.model||i.item_name}${Number(i.quantity)>1?' × '+i.quantity:''} — ${i.price_visible===false?'Included':money(i.final_price)}`,...phoneDetailLines(phone)];});
 const paid=payments.filter(p=>p.sale_id===sale.id).reduce((s,p)=>s+Number(p.amount),0);
 return [`AppleSpace ${sale.is_opening_balance?'balance receipt':'invoice'} ${sale.invoice_number}`,new Date(sale.sale_date).toLocaleString('en-PK',{timeZone:'Asia/Karachi'}),`Customer: ${customer?.full_name||'Walk-in'}`,`Bill made by: ${sale.billed_by_name||'Staff'}`,...(sale.is_opening_balance?[`Prior record: ${sale.opening_reference||''}`]:[]),'',...lines,'',`Total: ${money(sale.final_total)}`,`Received: ${money(paid)}`,`Balance: ${money(Math.max(0,Number(sale.final_total)-paid))}`,'Thank you for choosing AppleSpace.'].join('\n');
}
