import type {SupabaseClient} from '@supabase/supabase-js';

type Row=Record<string,any>;
export type QueueStatus='pending'|'syncing'|'failed';
export type OfflineQueueItem={
 id:string;
 requestId:string;
 payload:Row;
 createdAt:string;
 updatedAt:string;
 status:QueueStatus;
 retries:number;
 lastError?:string;
 photo?:Blob;
 photoName?:string;
 userId?:string;
 meta:Row;
};
export type OfflineState={online:boolean;pending:number;failed:number;syncing:boolean;lastSync?:string;lastError?:string};

const DB_NAME='applespace-offline-v1';
const DB_VERSION=1;
const QUEUE='queue';
const CACHE='cache';
const CACHE_KEY='erp-store';
const state:OfflineState={online:typeof navigator==='undefined'?true:navigator.onLine,pending:0,failed:0,syncing:false};
const listeners=new Set<(s:OfflineState)=>void>();

function emit(){const copy={...state};listeners.forEach(fn=>fn(copy));}
export function subscribeOfflineState(fn:(s:OfflineState)=>void){listeners.add(fn);fn({...state});return()=>listeners.delete(fn);}
export function getOfflineState(){return {...state};}
export function setNetworkState(online:boolean){state.online=online;emit();}
export function isNetworkError(error:any){
 const message=String(error?.message||error||'').toLowerCase();
 return !navigator.onLine||error instanceof TypeError||/fetch|network|failed to fetch|load failed|connection|offline|timeout/.test(message);
}
function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(QUEUE))db.createObjectStore(QUEUE,{keyPath:'id'});if(!db.objectStoreNames.contains(CACHE))db.createObjectStore(CACHE);};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function tx<T>(storeName:string,mode:IDBTransactionMode,work:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await openDb();return new Promise((resolve,reject)=>{const tr=db.transaction(storeName,mode),store=tr.objectStore(storeName),req=work(store);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tr.oncomplete=()=>db.close();tr.onerror=()=>reject(tr.error);});
}
export async function cacheStore(data:Row){await tx(CACHE,'readwrite',s=>s.put(structuredClone(data),CACHE_KEY));}
export async function cachedStore(){return (await tx<any>(CACHE,'readonly',s=>s.get(CACHE_KEY)))||null;}
export async function queueItems(){const rows=(await tx<any[]>(QUEUE,'readonly',s=>s.getAll()))||[];return rows.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)) as OfflineQueueItem[];}
async function putQueue(item:OfflineQueueItem){await tx(QUEUE,'readwrite',s=>s.put(item));await refreshCounts();}
async function deleteQueue(id:string){await tx(QUEUE,'readwrite',s=>s.delete(id));await refreshCounts();}
async function refreshCounts(){const rows=await queueItems();state.pending=rows.filter(x=>x.status!=='failed').length;state.failed=rows.filter(x=>x.status==='failed').length;emit();}
export async function initializeOfflineState(){await refreshCounts();setNetworkState(navigator.onLine);}

function metaFor(payload:Row){
 const action=String(payload.action||'');
 const meta:Row={};
 if(action==='purchase'){meta.purchaseId=crypto.randomUUID();meta.inventoryId=crypto.randomUUID();}
 if(action==='sale'){meta.saleId=crypto.randomUUID();if(!payload.customer_id)meta.customerId=crypto.randomUUID();}
 if(action==='customer')meta.entityId=crypto.randomUUID();
 if(action==='supplier')meta.entityId=crypto.randomUUID();
 if(action==='accessory_purchase')meta.accessoryId=crypto.randomUUID();
 return meta;
}
export async function enqueueAction(payload:Row,opts:{photo?:File;userId?:string;requestId?:string}={}){
 const now=new Date().toISOString(),requestId=opts.requestId||String(payload.request_id||crypto.randomUUID());
 const clean={...payload,request_id:requestId};delete clean.photo;
 const item:OfflineQueueItem={id:crypto.randomUUID(),requestId,payload:clean,createdAt:now,updatedAt:now,status:'pending',retries:0,photo:opts.photo,photoName:opts.photo?.name,userId:opts.userId,meta:metaFor(clean)};
 await putQueue(item);return item;
}

function n(v:any){const x=Number(v);return Number.isFinite(x)?x:0;}
function cloneStore(base:Row){const out={...base};for(const k of ['inventory','soldPhones','accessories','customers','sales','saleItems','payments','suppliers','walkInSellers','purchases','supplierPayments','expenses','sessions','ledgerEntries','ledgerPayments'])out[k]=[...(base[k]||[])];return out;}
export async function projectedStore(base:Row){
 const out=cloneStore(base);const queue=await queueItems();
 for(const q of queue){if(q.status==='failed')continue;const p=q.payload,a=String(p.action||''),m=q.meta,at=q.createdAt;
  if(a==='purchase'){
   out.purchases.unshift({id:m.purchaseId,purchase_number:'OFFLINE',seller_id:p.supplier_id||null,purchase_date:at,total_amount:n(p.purchase_price),notes:p.notes||'',offline_pending:true});
   out.inventory.unshift({id:m.inventoryId,purchase_id:m.purchaseId,stock_code:'OFF-'+q.requestId.slice(0,6).toUpperCase(),barcode_value:'OFF-'+q.requestId.slice(0,6).toUpperCase(),model:p.model,storage:p.storage,color:p.color,imei_1:p.imei_1,imei_2:p.imei_2||null,serial_number:p.serial_number||null,battery_health:p.battery_health?Number(p.battery_health):null,pta_status:p.pta_status,purchase_price:n(p.purchase_price),default_sale_price:p.sale_price===''?null:n(p.sale_price),condition_grade:p.condition_grade||'',warranty_notes:p.warranty_notes||'',status:'in_stock',created_at:at,offline_pending:true});
  } else if(a==='sale'){
   let customerId=p.customer_id||m.customerId;
   if(!p.customer_id)out.customers.unshift({id:customerId,full_name:p.customer_name,mobile:p.customer_mobile,customer_kind:p.sale_kind||'customer',offline_pending:true});
   const phone=out.inventory.find((x:Row)=>x.id===p.inventory_id);if(phone){phone.status='sold';phone.sold_at=at;}
   const extras=Array.isArray(p.extras)?p.extras:[];const extraTotal=extras.reduce((s:number,x:Row)=>s+n(x.price)*n(x.quantity||1),0),total=n(p.price)+extraTotal-n(p.discount);
   out.sales.unshift({id:m.saleId,invoice_number:'OFFLINE-'+q.requestId.slice(0,8).toUpperCase(),customer_id:customerId,subtotal:n(p.price)+extraTotal,discount:n(p.discount),final_total:total,payment_status:n(p.paid)>=total?'paid':n(p.paid)>0?'partial':'unpaid',sale_date:at,sale_kind:p.sale_kind||'customer',billed_by_name:p.billed_by_name||'',offline_pending:true});
   if(phone)out.saleItems.unshift({id:crypto.randomUUID(),sale_id:m.saleId,inventory_item_id:phone.id,item_name:phone.model,quantity:1,unit_price:n(p.price),discount:n(p.discount),final_price:n(p.price)-n(p.discount),offline_pending:true});
   for(const ex of extras){out.saleItems.unshift({id:crypto.randomUUID(),sale_id:m.saleId,accessory_id:ex.accessory_id||null,item_name:ex.name,quantity:n(ex.quantity||1),unit_price:n(ex.price),discount:0,final_price:n(ex.price)*n(ex.quantity||1),offline_pending:true});if(ex.accessory_id){const acc=out.accessories.find((x:Row)=>x.id===ex.accessory_id);if(acc)acc.quantity=Math.max(0,n(acc.quantity)-n(ex.quantity||1));}}
   if(n(p.paid)>0)out.payments.unshift({id:crypto.randomUUID(),sale_id:m.saleId,amount:n(p.paid),method:p.method||'cash',payment_date:at,offline_pending:true});
  } else if(a==='customer')out.customers.unshift({id:m.entityId,full_name:p.full_name,mobile:p.mobile,cnic:p.cnic,address:p.address,notes:p.notes,customer_kind:p.customer_kind||'customer',offline_pending:true});
  else if(a==='supplier')out.suppliers.unshift({id:m.entityId,full_name:p.full_name,mobile:p.mobile,cnic:p.cnic,notes:p.notes,seller_kind:p.seller_kind||'supplier',offline_pending:true});
  else if(a==='accessory_purchase'){
   const qty=n(p.quantity||1),cost=n(p.purchase_price),sale=p.sale_price===''?null:n(p.sale_price);
   out.accessories.unshift({id:m.accessoryId,name:p.name,category:p.category||'Other',quantity:qty,purchase_price:cost,sale_price:sale,supplier_id:p.supplier_id||null,barcode_value:'OFF-'+q.requestId.slice(0,6).toUpperCase(),created_at:at,updated_at:at,offline_pending:true});
  } else if(a==='accessory_restock'){
   const acc=out.accessories.find((x:Row)=>x.id===p.accessory_id);if(acc){acc.quantity=n(acc.quantity)+n(p.quantity);if(p.sale_price!=='')acc.sale_price=n(p.sale_price);acc.offline_pending=true;}
  } else if(a==='accessory_edit'){
   const acc=out.accessories.find((x:Row)=>x.id===p.accessory_id);if(acc){Object.assign(acc,{name:p.name||acc.name,category:p.category||acc.category,sale_price:p.sale_price===''?acc.sale_price:n(p.sale_price),notes:p.notes,offline_pending:true});}
  } else if(a==='customer_payment')out.payments.unshift({id:crypto.randomUUID(),sale_id:p.sale_id,amount:n(p.amount),method:p.method||'cash',payment_date:at,notes:p.notes,offline_pending:true});
  else if(a==='supplier_payment')out.supplierPayments.unshift({id:crypto.randomUUID(),purchase_id:p.purchase_id,amount:n(p.amount),method:p.method||'cash',payment_date:at,notes:p.notes,offline_pending:true});
  else if(a==='expense')out.expenses.unshift({id:crypto.randomUUID(),category:p.category,description:p.description,amount:n(p.amount),method:p.method||'cash',expense_date:at,inventory_item_id:p.inventory_item_id||null,offline_pending:true});
  else if(a==='repair'){const item=out.inventory.find((x:Row)=>x.id===p.inventory_id);if(item)item.status=p.repairing?'repair':'in_stock';}
  else if(a==='inventory_edit'){const item=out.inventory.find((x:Row)=>x.id===p.inventory_id);if(item)Object.assign(item,{status:p.status,default_sale_price:p.sale_price===''?item.default_sale_price:n(p.sale_price),color:p.color,battery_health:p.battery_health===''?null:Number(p.battery_health),condition_grade:p.condition_grade,warranty_notes:p.warranty_notes,public_notes:p.public_notes,offline_pending:true});}
  else if(a==='website'){const item=out.inventory.find((x:Row)=>x.id===p.inventory_id);if(item)Object.assign(item,{show_on_website:String(p.visible)==='true',website_price:p.price===''?null:n(p.price),website_title:p.title,website_description:p.description,offline_pending:true});}
 }
 return out;
}

async function rewriteTempReference(tempId:string,realId:string){
 const rows=await queueItems();
 for(const item of rows){let changed=false;const p={...item.payload};
  for(const key of ['inventory_id','customer_id','supplier_id','purchase_id','sale_id','accessory_id'])if(p[key]===tempId){p[key]=realId;changed=true;}
  if(Array.isArray(p.extras)){const extras=p.extras.map((x:Row)=>x.accessory_id===tempId?({...x,accessory_id:realId}):x);if(JSON.stringify(extras)!==JSON.stringify(p.extras)){p.extras=extras;changed=true;}}
  if(changed)await putQueue({...item,payload:p,updatedAt:new Date().toISOString()});
 }
}
async function resolveContact(client:SupabaseClient,item:OfflineQueueItem){
 if(!item.meta.customerId&&!item.meta.supplierId)return;
 const {data,error}=await client.rpc('erp_read');if(error||!data)return;
 if(item.meta.customerId){const actual=(data.customers||[]).find((c:Row)=>c.mobile===item.payload.customer_mobile&&c.full_name===item.payload.customer_name);if(actual)await rewriteTempReference(item.meta.customerId,actual.id);}
 if(item.meta.supplierId){const actual=(data.suppliers||[]).find((s:Row)=>(item.payload.cnic&&s.cnic===item.payload.cnic)||(item.payload.mobile&&s.mobile===item.payload.mobile));if(actual)await rewriteTempReference(item.meta.supplierId,actual.id);}
}
export async function syncPendingActions(client:SupabaseClient,uploadPhoto:(file:File,userId:string)=>Promise<string>){
 if(state.syncing||!navigator.onLine)return {synced:0,failed:0};
 state.syncing=true;state.lastError=undefined;emit();let synced=0,failed=0;
 try{
  const rows=await queueItems();
  for(const original of rows){
   let item={...original,status:'syncing' as QueueStatus,updatedAt:new Date().toISOString()};await putQueue(item);
   try{
    let payload={...item.payload,request_id:item.requestId};
    if(item.photo&&item.userId&&!payload.photo_url){const file=new File([item.photo],item.photoName||'seller-photo.jpg',{type:item.photo.type||'image/jpeg'});payload.photo_url=await uploadPhoto(file,item.userId);}
    const {data,error}=await client.rpc('erp_action',{p:payload});if(error)throw error;
    if(item.meta.inventoryId&&data?.inventory_id)await rewriteTempReference(item.meta.inventoryId,data.inventory_id);
    if(item.meta.entityId&&data?.id)await rewriteTempReference(item.meta.entityId,data.id);
    if(item.meta.accessoryId&&data?.id)await rewriteTempReference(item.meta.accessoryId,data.id);
    await resolveContact(client,item);
    await deleteQueue(item.id);synced++;
   }catch(error:any){
    if(isNetworkError(error)){await putQueue({...item,status:'pending',retries:item.retries+1,lastError:String(error?.message||error),updatedAt:new Date().toISOString()});state.lastError=String(error?.message||error);break;}
    await putQueue({...item,status:'failed',retries:item.retries+1,lastError:String(error?.message||error),updatedAt:new Date().toISOString()});failed++;
   }
  }
  if(synced){state.lastSync=new Date().toISOString();}
  return {synced,failed};
 }finally{state.syncing=false;setNetworkState(navigator.onLine);await refreshCounts();}
}
export async function retryFailed(){const rows=await queueItems();for(const i of rows.filter(x=>x.status==='failed'))await putQueue({...i,status:'pending',lastError:undefined,updatedAt:new Date().toISOString()});}
export async function pendingDetails(){return queueItems();}
