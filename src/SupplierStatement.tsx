import {useMemo,useState} from 'react';
import Pagination,{usePagination} from './Pagination';
import {storeIndex} from './storeIndex.mjs';
import {Download,Printer,Wallet} from 'lucide-react';
import {supplierLedger} from './supplierLedger.mjs';
import {due,money} from './math.mjs';
import {printReport,exportRows} from './outputActions';
type Row=Record<string,any>;
const stamp=(value:string)=>new Date(value).toLocaleString('en-PK',{timeZone:'Asia/Karachi',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
export default function SupplierStatement({supplier,data,setModal}:{supplier:Row;data:Row;setModal:(value:Row)=>void}){
 const rows=useMemo(()=>supplierLedger(data,supplier.id),[data,supplier.id]);
 const {visible,pagination}=usePagination(rows,supplier.id);
 const [error,setError]=useState('');
 const run=async(fn:()=>Promise<any>)=>{try{setError('');await fn();}catch(error:any){setError(error.message||'Could not prepare this document.');}};
 const balance=rows.at(-1)?.balance||0,incomplete=rows.some(r=>r.costPending);
 const outstanding=(storeIndex(data).purchasesBySeller.get(supplier.id)||[]).map((p:Row)=>({...p,balance:due(p,storeIndex(data).paymentsByPurchase.get(p.id)||[],'purchase_id','total_amount')})).filter((p:Row)=>p.balance>0);
 const exportData=rows.map(r=>({Date:stamp(r.date),Entry:r.kind==='purchase'?'Purchase':'Payment to supplier',Reference:r.reference,Product:r.product,IMEI:r.imei||'—',Method:r.method||'—',Bought:r.costPending?'Cost pending':r.bought,Paid:r.paid,Balance:r.balanceIncomplete?'Incomplete (known: '+r.balance+')':r.balance,Notes:r.notes}));
 return <><div className="statement-summary"><div><b>{supplier.full_name}</b><small>{supplier.mobile||'No phone number'}</small></div><span>{money(balance)} {incomplete?'known balance':'outstanding'}</span></div>
 <p className="form-hint">Purchases increase what you owe. Payments reduce it. Read from top to bottom to follow the running balance.</p>
 {incomplete&&<div className="error">Some purchases need a cost. Balances marked * include known costs only.</div>}
 <div className="statement-actions"><button onClick={()=>run(()=>printReport(supplier.full_name+' · Supplier ledger',exportData))}><Printer size={16}/>Print / PDF</button><button onClick={()=>run(()=>exportRows('Supplier-ledger',exportData,'xlsx'))}><Download size={16}/>Excel</button>{outstanding.length>0&&<button className="primary" onClick={()=>setModal({action:'supplier_payment_bulk',title:'Pay '+supplier.full_name,supplierId:supplier.id})}><Wallet size={16}/>Pay supplier</button>}</div>
 {error&&<div className="error" role="alert">{error}</div>}{rows.length?<div className="table-scroll supplier-ledger"><table><thead><tr>{['Date / reference','Entry / product','Bought','Paid','Balance owed'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.id}><td>{stamp(r.date)}<small>{r.reference}</small></td><td><b>{r.kind==='purchase'?'Purchase':'Payment to supplier'}</b><small>{r.product}</small>{r.imei&&<small className="mono">IMEI: {r.imei}</small>}{r.method&&<small>{r.method}</small>}{r.notes&&<small>{r.notes}</small>}</td><td>{r.costPending?'Cost pending':r.kind==='purchase'?money(r.bought):'—'}</td><td>{r.kind==='payment'?money(r.paid):'—'}</td><td><b>{money(r.balance)}{r.balanceIncomplete?' *':''}</b></td></tr>)}</tbody></table><Pagination {...pagination}/></div>:<div className="empty"><p>No purchases or payments recorded for this supplier.</p></div>}
 {outstanding.length>0&&<><h3 className="section-title">Pay a specific purchase</h3><div className="supplier-open-purchases">{outstanding.map((p:Row)=><div className="setting-row" key={p.id}><span>#{p.purchase_number} · {money(p.balance)} remaining</span><button onClick={()=>setModal({action:'supplier_payment',title:'Pay purchase #'+p.purchase_number,balance:p.balance,payload:{purchase_id:p.id}})}>Pay</button></div>)}</div></>}
 </>;
}
