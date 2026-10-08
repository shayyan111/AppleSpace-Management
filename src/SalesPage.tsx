import {useDeferredValue,useMemo} from 'react';
import {Download,Printer,Search,Send} from 'lucide-react';
import {invoiceHistory} from './customerHistory.mjs';
import {storeIndex} from './storeIndex.mjs';
import {due,localDay,money} from './math.mjs';
import {printInvoice} from './outputActions';
import Pagination,{usePagination} from './Pagination';
type Row=Record<string,any>;
type Props={data:Row;search:string;setSearch:(s:string)=>void;from:string;to:string;setFrom:(s:string)=>void;setTo:(s:string)=>void;setModal:(value:Row)=>void;safe:(fn:()=>Promise<any>)=>Promise<any>;exportRows:(rows:Row[])=>void};
export default function SalesPage({data,search,setSearch,from,to,setFrom,setTo,setModal,safe,exportRows}:Props){
 const query=useDeferredValue(search).toLowerCase();
 const records=useMemo(()=>{
  const index=storeIndex(data);
  return invoiceHistory(data).map((sale:Row)=>{
   const customer=index.customers.get(sale.customer_id);
   const items:Row[]=index.itemsBySale.get(sale.id)||[];
   const codes=items.flatMap(item=>{
    const phone=item.phone_details&&Object.keys(item.phone_details).length?item.phone_details:index.phones.get(item.inventory_item_id)||index.archivedPhones.get(item.inventory_item_id);
    return [item.item_name,phone?.imei_1,phone?.imei_2,phone?.serial_number];
   });
   return {sale,customer,balance:due(sale,index.paymentsBySale.get(sale.id)||[],'sale_id','final_total'),billedBy:sale.billed_by_name||index.staff.get(sale.billed_by)?.full_name||'Staff',day:localDay(sale.sale_date),searchText:[...Object.values(sale),customer?.full_name,customer?.mobile,...codes].map(value=>String(value??'')).join(' ').toLowerCase()};
  });
 },[data]);
 const shown=useMemo(()=>records.filter(r=>(!query||r.searchText.includes(query))&&(!from||r.day>=from)&&(!to||r.day<=to)),[records,query,from,to]);
 const {visible,pagination}=usePagination(shown,JSON.stringify([query,from,to]));
 return <section className="panel"><div className="toolbar"><div className="search"><Search size={17}/><input aria-label="Search sales" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search IMEI, invoice number, customer or date…"/></div><div className="toolbar-actions"><button onClick={()=>exportRows(shown.map(r=>r.sale))}><Download size={16}/>Excel</button></div></div><div className="report-tools"><label>From<input aria-label="Sales from date" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input aria-label="Sales to date" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>{records.length?<><div className="table-scroll"><table><thead><tr>{['Invoice','Customer','Date','Total','Balance','Status','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(({sale:s,customer:c,balance,billedBy})=><tr key={s.id}><td><b>{s.invoice_number}</b>{s.is_opening_balance&&<small>Settled opening balance · {s.opening_reference}</small>}</td><td>{c?.full_name||'Walk-in'}<small>{s.is_opening_balance?'Opening balance receipt':s.sale_kind==='shopkeeper'?'Shopkeeper sale':'Customer sale'} · Bill by {billedBy}</small></td><td>{new Date(s.sale_date).toLocaleDateString('en-PK',{timeZone:'Asia/Karachi',day:'numeric',month:'short',year:'numeric'})}</td><td>{money(s.final_total)}</td><td>{money(balance)}</td><td><span className={'tag '+s.payment_status}>{String(s.payment_status||'—').replaceAll('_',' ')}</span></td><td><div className="row-actions"><button title="Print receipt / Save PDF" onClick={()=>safe(()=>printInvoice(s,data.saleItems,data.payments,c,data.inventory))}><Printer size={16}/></button><button title="Send invoice PDF to WhatsApp" onClick={()=>setModal({action:'invoice_whatsapp',title:'Send invoice PDF via WhatsApp',sale:s,customer:c})}><Send size={16}/>WhatsApp PDF</button>{balance>0&&<button onClick={()=>setModal({action:'customer_payment',title:'Receive payment',balance,payload:{sale_id:s.id}})}>Receive</button>}</div></td></tr>)}</tbody></table></div><Pagination {...pagination}/>{!shown.length&&<div className="empty">No invoices match your search or dates.</div>}</>:<div className="empty">Your first sale starts here. Choose New sale to create an invoice.</div>}</section>;
}
