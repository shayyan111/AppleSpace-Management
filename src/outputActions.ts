export {download,whatsapp,whatsappNumber,canShareInvoicePDF,sendInvoiceWhatsApp} from './browserActions';
type Output=typeof import('./output');
let pending:Promise<Output>|undefined;
const load=()=>pending??(pending=import('./output').catch(error=>{pending=undefined;throw error;}));
export async function exportRows(...args:Parameters<Output['exportRows']>){return (await load()).exportRows(...args);}
export async function printLabel(...args:Parameters<Output['printLabel']>){return (await load()).printLabel(...args);}
export async function printInvoice(...args:Parameters<Output['printInvoice']>){return (await load()).printInvoice(...args);}
export async function printSlip(...args:Parameters<Output['printSlip']>){return (await load()).printSlip(...args);}
export async function purchaseSlipPDF(...args:Parameters<Output['purchaseSlipPDF']>){return (await load()).purchaseSlipPDF(...args);}
export async function printReport(...args:Parameters<Output['printReport']>){return (await load()).printReport(...args);}
export async function invoicePDF(...args:Parameters<Output['invoicePDF']>){return (await load()).invoicePDF(...args);}
