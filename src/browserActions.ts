export function download(name:string,data:BlobPart,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function whatsappNumber(phone:string){let n=phone.replace(/\D/g,'');if(n.startsWith('0'))n='92'+n.slice(1);if(!/^\d{7,15}$/.test(n))throw Error('Add a valid customer phone number first.');return n;}
export function whatsapp(phone:string,text:string){const n=whatsappNumber(phone);window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');}
export function canShareInvoicePDF(file:File){try{return typeof navigator!=='undefined'&&typeof navigator.share==='function'&&navigator.canShare?.({files:[file]})===true}catch{return false}}
// Keep share/open in the user's click: awaiting a dynamic import here can lose
// the phone's share permission or cause a popup blocker to reject WhatsApp.
export async function sendInvoiceWhatsApp(file:File,customer:any,downloadAndOpen=false):Promise<'shared'|'downloaded'|'cancelled'>{
 const phone=whatsappNumber(String(customer?.mobile||''));
 if(file.type!=='application/pdf'||!file.size)throw Error('Prepare the invoice PDF before sharing.');
 if(!downloadAndOpen&&canShareInvoicePDF(file)){
  try{await navigator.share({files:[file],title:'AppleSpace invoice '+file.name.replace(/\.pdf$/i,'')});return 'shared'}
  catch(error){if((error as Error)?.name==='AbortError')return 'cancelled';throw error;}
 }
 download(file.name,file,'application/pdf');
 whatsapp(phone,`Dear ${customer?.full_name||'Customer'},\nYour AppleSpace invoice ${file.name.replace(/\.pdf$/i,'')} is ready.\nThank you for choosing AppleSpace.`);
 return 'downloaded';
}
