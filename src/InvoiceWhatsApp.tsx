import {useEffect,useState} from 'react';
import {Download,FileText,Send} from 'lucide-react';
import {invoicePDF,canShareInvoicePDF,sendInvoiceWhatsApp,whatsappNumber,download,whatsapp} from './outputActions';
type Row=Record<string,any>;
export default function InvoiceWhatsApp({sale,items,payments,customer,phones}:{sale:Row;items:Row[];payments:Row[];customer?:Row;phones:Row[]}){
 const [file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let alive=true;setFile(null);setError('');setStatus('');
  (async()=>{whatsappNumber(String(customer?.mobile||''));return invoicePDF(sale,items,payments,customer,phones)})()
   .then(pdf=>{if(alive)setFile(pdf)}).catch(e=>{if(alive)setError(e.message||'Could not prepare the invoice PDF. Please retry.');});
  return()=>{alive=false};
 },[sale,items,payments,customer,phones,retry]);
 const native=file?canShareInvoicePDF(file):false;
 async function send(downloadAndOpen=false){
  if(!file||busy)return;setBusy(true);setError('');setStatus('');
  try{
   const result=await sendInvoiceWhatsApp(file,customer,downloadAndOpen);
   if(result==='shared')setStatus('PDF handed to the sharing app. Complete sending in WhatsApp.');
   if(result==='downloaded')setStatus(`PDF download started. Attach ${file.name} in the customer's WhatsApp chat using Attach → Document, then press Send.`);
  }catch(e){setError((e as Error).message||'Could not share the PDF. Try Download PDF & open WhatsApp.');}
  finally{setBusy(false)}
 }
 return <div className="invoice-whatsapp">
  <div className="invoice-recipient"><FileText size={28}/><div><b>{sale.invoice_number}.pdf</b><small>{customer?.full_name||'Customer'} · {customer?.mobile||'No phone number recorded'}</small></div></div>
  {!file&&!error&&<p role="status">Preparing invoice PDF…</p>}
  {file&&<>
   <p className="form-hint">{native?`Choose WhatsApp, select ${customer?.full_name||'the customer'} (${customer?.mobile}), and press Send. The invoice PDF is included.`:"Download the PDF and open the customer's WhatsApp chat. Attach the downloaded file using Attach → Document, then press Send."}</p>
   <div className="invoice-share-actions"><button type="button" className="primary" disabled={busy} onClick={()=>send()}><Send size={16}/>{busy?'Opening…':native?'Send PDF via WhatsApp':'Download PDF & open WhatsApp'}</button>{native&&<button type="button" disabled={busy} onClick={()=>send(true)}>Download PDF & open WhatsApp</button>}<button type="button" disabled={busy} onClick={()=>download(file.name,file,'application/pdf')}><Download size={16}/>Download PDF</button></div>
   {status&&<><p role="status" className="form-hint">{status}</p><button type="button" disabled={busy} onClick={()=>whatsapp(String(customer?.mobile||''),`AppleSpace invoice ${sale.invoice_number}`)}>Open customer chat</button></>}
  </>}
  {error&&<div role="alert" className="error">{error}</div>}
  {!file&&error&&<button type="button" onClick={()=>setRetry(retry+1)}>Retry preparing PDF</button>}
 </div>;
}
