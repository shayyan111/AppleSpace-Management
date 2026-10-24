import {useState} from 'react';
import {printLabel} from './outputActions';
import {labelFormats,defaultLabelSize,type LabelSize} from './labelLayout';

export default function LabelForm({item,accessory=false,safe}:{item:Record<string,any>;accessory?:boolean;safe:(fn:()=>Promise<void>)=>Promise<unknown>}){
 const [copies,setCopies]=useState('1'),[busy,setBusy]=useState(false),[size,setSize]=useState<LabelSize>(defaultLabelSize);
 return <form onSubmit={e=>{e.preventDefault();if(busy)return;setBusy(true);safe(()=>printLabel(item,{accessory,copies:accessory?1:Number(copies),size})).finally(()=>setBusy(false));}}>
  <p>{item.model||item.name} · Label printer</p>
  <label className="field"><span>Label paper size</span><select value={size} onChange={e=>setSize(e.target.value as LabelSize)}>{Object.entries(labelFormats).map(([key,format])=><option key={key} value={key}>{format.name}</option>)}</select></label>
  {!accessory&&<label className="field"><span>Number of identical labels *</span><input type="number" min="1" max="500" step="1" value={copies} onChange={e=>setCopies(e.target.value)} required/></label>}
  <button className="primary" disabled={busy}>{busy?'Preparing…':'Print labels / Save PDF'}</button>
 </form>;
}
