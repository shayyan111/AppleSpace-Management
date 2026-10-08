const empty=[];
const cache=new WeakMap();
const fields=['sales','saleItems','payments','inventory','soldPhones','accessories','customers','suppliers','walkInSellers','purchases','supplierPayments','ledgerEntries','ledgerPayments','costs','staff'];
export function groupRows(rows,key){
 const groups=new Map();
 for(const row of rows){const value=row[key];let group=groups.get(value);if(!group)groups.set(value,group=[]);group.push(row);}
 return groups;
}
function stockCodes(rows,fields){const codes=new Map();for(const row of rows){const seen=new Set();for(const field of fields){const raw=row[field];if(raw==null)continue;const code=String(raw).trim().toLowerCase();if(!code||seen.has(code))continue;seen.add(code);let matches=codes.get(code);if(!matches)codes.set(code,matches=[]);matches.push(row);}}return codes;}
function firstBy(rows,key){const map=new Map();for(const row of rows)if(!map.has(row[key]))map.set(row[key],row);return map;}
// Store snapshots are immutable. Also detect array replacement/append so a new
// payment cannot leave a cached balance behind in callers that append records.
export function storeIndex(data){
 const arrays=fields.map(key=>data[key]||empty),previous=cache.get(data);
 if(previous&&arrays.every((rows,i)=>rows===previous.arrays[i]&&rows.length===previous.lengths[i]))return previous.index;
 const rows=Object.fromEntries(fields.map((key,i)=>[key,arrays[i]]));
 const index={
  salesByCustomer:groupRows(rows.sales,'customer_id'),itemsBySale:groupRows(rows.saleItems,'sale_id'),paymentsBySale:groupRows(rows.payments,'sale_id'),
  phonesByPurchase:groupRows(rows.inventory,'purchase_id'),accessoriesByPurchase:groupRows(rows.accessories,'purchase_id'),purchasesBySeller:groupRows(rows.purchases,'seller_id'),paymentsByPurchase:groupRows(rows.supplierPayments,'purchase_id'),paymentsByEntry:groupRows(rows.ledgerPayments,'entry_id'),
  customers:firstBy(rows.customers,'id'),sellers:firstBy([...rows.suppliers,...rows.walkInSellers],'id'),phones:firstBy(rows.inventory,'id'),archivedPhones:firstBy(rows.soldPhones,'original_inventory_id'),sales:firstBy(rows.sales,'id'),costs:firstBy(rows.costs,'sale_item_id'),staff:firstBy(rows.staff,'id'),
  phoneCodes:stockCodes(rows.inventory,['barcode_value','stock_code','imei_1','imei_2','serial_number']),accessoryCodes:stockCodes(rows.accessories,['sku']),
  customerHistories:new WeakMap(),purchaseHistories:new WeakMap(),ledgers:new Map()
 };
 cache.set(data,{arrays,lengths:arrays.map(rows=>rows.length),index});return index;
}
