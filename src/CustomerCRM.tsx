import {useMemo,useState} from 'react';
import {Send} from 'lucide-react';
import {money} from './math.mjs';
import {customerHistory} from './customerHistory.mjs';
import {canMessage,campaignMatches,campaignMessage,campaignRecipients} from './campaign.mjs';
import {whatsapp} from './output';
type Row=Record<string,any>;
type Message={id:string;name:string;mobile:string;text:string};
const templates:Record<string,string>={
 greeting:'Assalam u Alaikum {name}! AppleSpace wishes you a great day. Thank you for being part of our customer family.',
 deal:'Assalam u Alaikum {name}! We have new AppleSpace deals available. Reply here or visit us to check the latest iPhones and accessories.',
 update:'Assalam u Alaikum {name}! A quick AppleSpace update: {custom}',
 followup:'Assalam u Alaikum {name}! We hope you are enjoying your {last_phone}. If you need accessories, upgrades or any help, message AppleSpace anytime.'
};
export default function CustomerCRM({data}:{data:Row}){
 const [audience,setAudience]=useState('all'),[template,setTemplate]=useState('deal'),[custom,setCustom]=useState(''),[search,setSearch]=useState(''),[draft,setDraft]=useState(templates.deal),[preview,setPreview]=useState('');
 const [selected,setSelected]=useState<Set<string>>(new Set()),[queue,setQueue]=useState<Message[]>([]),[next,setNext]=useState(0),[error,setError]=useState('');
 const contacts=useMemo(()=>data.customers.map((c:Row)=>customerHistory(data,c)),[data]);
 const shown=contacts.filter((c:Row)=>campaignMatches(c,audience,search));
 const recipients=campaignRecipients(contacts,selected),selectable=shown.filter(canMessage);
 const allSelected=selectable.length>0&&selectable.every((c:Row)=>selected.has(c.id));
 const message=(c:Row)=>campaignMessage(draft,custom,c);
 const resetQueue=()=>{setQueue([]);setNext(0);setError('')};
 const toggle=(id:string)=>{setSelected(ids=>{const copy=new Set(ids);if(copy.has(id))copy.delete(id);else copy.add(id);return copy});resetQueue()};
 const toggleMatching=()=>{setSelected(ids=>{const copy=new Set(ids);selectable.forEach((c:Row)=>allSelected?copy.delete(c.id):copy.add(c.id));return copy});resetQueue()};
 const prepare=()=>{setQueue(recipients.map(c=>({id:c.id,name:c.full_name,mobile:c.mobile,text:message(c)})));setNext(0);setError('')};
 const open=(mobile:string,text:string)=>{try{whatsapp(mobile,text);setError('');return true}catch(e:any){setError(e.message||'Could not open WhatsApp.');return false}};
 return <div className="crm-grid"><section className="panel"><div className="panel-head"><div><h3>Message composer</h3><small>Greetings, deals, alerts and follow-ups</small></div></div>
 <label className="field"><span>Audience</span><select value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">All contacts</option><option value="customers">Customers only</option><option value="shopkeepers">Shopkeepers only</option><option value="recent">Bought in last 30 days</option><option value="outstanding">Outstanding balance</option></select></label>
 <label className="field"><span>Message type</span><select value={template} onChange={e=>{setTemplate(e.target.value);setDraft(templates[e.target.value]);resetQueue()}}><option value="greeting">Greeting</option><option value="deal">New deal / offer</option><option value="update">Update / alert</option><option value="followup">After-sale follow-up</option></select></label>
 <label className="field"><span>Message text</span><textarea aria-label="Campaign message" value={draft} onChange={e=>{setDraft(e.target.value);resetQueue()}}/><small>Personalize with {'{name}'} or {'{last_phone}'}.</small></label>
 {template==='update'&&<label className="field"><span>Update text</span><textarea value={custom} onChange={e=>{setCustom(e.target.value);resetQueue()}} placeholder="Example: iPhone 16 Pro Max stock has arrived."/></label>}
 <div className="message-preview"><b>Message preview</b><p>{message(shown.find((c:Row)=>c.id===preview)||recipients[0]||shown[0]||{full_name:'Customer',lastPhone:'phone'})}</p></div>
 <div className="campaign-selection"><b>{recipients.length} customers selected</b><small>Selections stay selected when you change the audience or search.</small><div className="actions"><button className="primary" disabled={!recipients.length||!draft.trim()} onClick={prepare}><Send size={15}/>Prepare selected messages</button><button disabled={!selected.size} onClick={()=>{setSelected(new Set());resetQueue()}}>Clear selection</button></div></div>
 <div className="info">Messages open in WhatsApp one customer at a time so you can review before sending. Press Send inside WhatsApp. Opening a draft does not confirm delivery.</div>
 {queue.length>0&&<section className="campaign-queue" aria-label="Selected customer messages"><h3>Selected recipients</h3><p>{next} of {queue.length} drafts opened for review</p><ol>{queue.map((m,i)=><li key={m.id}>{m.name} · {m.mobile}<small>{i<next?'Draft opened':i===next?'Next customer':'Waiting'}</small></li>)}</ol>{next<queue.length?<><div className="message-preview"><b>Next: {queue[next].name}</b><p>{queue[next].text}</p></div><button className="primary" onClick={()=>{if(open(queue[next].mobile,queue[next].text))setNext(i=>i+1)}}><Send size={15}/>Review next in WhatsApp</button></>:<p>All selected drafts have been opened. Check WhatsApp for the messages you sent.</p>}</section>}
 {error&&<div className="error" role="alert">{error}</div>}</section>
 <section className="panel"><div className="panel-head"><div><h3>Customer list</h3><small>{shown.length} matching contacts · {recipients.length} selected</small></div></div><div className="toolbar"><input aria-label="Search message recipients" placeholder="Search customer, phone or purchased model" value={search} onChange={e=>setSearch(e.target.value)}/><button disabled={!selectable.length} onClick={toggleMatching}>{allSelected?'Deselect matching':'Select all matching'}</button></div>
 <div className="table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all matching customers" disabled={!selectable.length} checked={allSelected} onChange={toggleMatching}/></th><th>Name</th><th>Phone</th><th>Purchase history</th><th>Last purchase</th><th>Balance</th><th>Message</th></tr></thead><tbody>{shown.map((c:Row)=><tr key={c.id}><td><input type="checkbox" aria-label={'Select '+c.full_name} checked={selected.has(c.id)} disabled={!canMessage(c)} onChange={()=>toggle(c.id)}/></td><td><b>{c.full_name}</b><small>{c.customer_kind||'customer'}</small></td><td>{c.mobile||'—'}</td><td>{c.phones.length?c.phones.map((p:Row)=><div key={p.id}>{p.name}<small>{p.phone?.imei_1||''}</small></div>):'No recorded phone purchases'}</td><td>{c.last?new Date(c.last.sale_date).toLocaleDateString('en-PK',{timeZone:'Asia/Karachi'}):'—'}</td><td>{money(c.balance)}</td><td><div className="row-actions"><button onClick={()=>setPreview(c.id)}>Preview</button><button disabled={!canMessage(c)||!draft.trim()} onClick={()=>open(c.mobile,message(c))}><Send size={15}/>WhatsApp</button></div></td></tr>)}</tbody></table></div>{!shown.length&&<div className="empty">No customers match this audience.</div>}</section></div>;
}
