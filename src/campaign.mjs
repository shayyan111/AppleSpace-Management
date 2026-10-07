export const canMessage=contact=>{const digits=String(contact.mobile||'').replace(/\D/g,'');return digits.length>=10&&digits.length<=15;};
export function campaignMatches(contact,audience,search,now=Date.now()){
 const query=search.trim().toLowerCase();
 if(![contact.full_name,contact.mobile,...(contact.phones||[]).map(p=>p.name)].some(v=>String(v||'').toLowerCase().includes(query)))return false;
 if(audience==='customers')return (contact.customer_kind||'customer')==='customer';
 if(audience==='shopkeepers')return contact.customer_kind==='shopkeeper';
 if(audience==='outstanding')return contact.balance>0;
 if(audience==='recent')return Boolean(contact.last&&now-new Date(contact.last.sale_date).getTime()<30*86400000);
 return true;
}
export function campaignMessage(draft,custom,contact){return draft.replaceAll('{name}',contact.full_name||'Customer').replaceAll('{last_phone}',contact.lastPhone||'phone').replaceAll('{custom}',custom||'New stock and updates are available.');}
export function campaignRecipients(contacts,selected){return contacts.filter(c=>selected.has(c.id)&&canMessage(c));}
