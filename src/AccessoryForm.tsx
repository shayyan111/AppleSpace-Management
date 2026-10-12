import {useState} from 'react';
import {money} from './math.mjs';
type Row=Record<string,any>;
export default function AccessoryForm({action,item={},suppliers=[],onType,initialSupplier}:{action:string;item?:Row;suppliers?:Row[];onType:(type:string)=>void;initialSupplier?:string}){
 const restock=action==='accessory_restock',purchase=action==='accessory_purchase',edit=action==='accessory_edit';
 const [supplier,setSupplier]=useState(initialSupplier||((restock&&item.supplier_id)||''));
 const [qty,setQty]=useState('');
 const [cost,setCost]=useState(action==='accessory_edit'&&item.purchase_price!=null?String(item.purchase_price):restock&&item.purchase_price!=null?String(item.purchase_price):'');
 const oldQty=restock?Math.max(0,Number(item.quantity)||0):0;
 const oldCost=restock?Math.max(0,Number(item.purchase_price)||0):0;
 const newQty=Math.max(0,Number(qty)||0),newCost=Math.max(0,Number(cost)||0);
 const total=newQty*newCost;
 const average=oldQty+newQty>0?(oldQty*oldCost+newQty*newCost)/(oldQty+newQty):0;
 return <>
 {purchase&&<label className="field"><span>Purchase type</span><select value="accessory_purchase" onChange={e=>onType(e.target.value)}><option value="purchase">iPhone</option><option value="accessory_purchase">Accessories</option></select></label>}
 {!restock&&<><div className="form-section">Accessory details</div><label className="field"><span>Accessory name *</span><input name="name" required defaultValue={item.name||''}/></label><label className="field"><span>Category</span><select name="category" defaultValue={item.category||'Other'}>{['Charger','Cable','Case','Screen protector','Audio','Other'].map(v=><option key={v}>{v}</option>)}</select></label></>}
 {(purchase||restock)&&<>
  <div className="form-section">{restock?'Restock '+item.name:'Stock quantity & cost'}</div>
  <label className="field"><span>{restock?'New units received':'Quantity'} *</span><input name="quantity" type="number" min="1" step="1" required value={qty} onChange={e=>setQty(e.target.value)}/></label>
  <label className="field"><span>New purchase cost per unit *</span><input name="purchase_price" type="number" min="0" step="0.01" required value={cost} onChange={e=>setCost(e.target.value)}/></label>
  {restock&&<div className="purchase-total-card"><span>Updated weighted average cost</span><strong>{money(average)}</strong><small>Existing: {oldQty} × {money(oldCost)} · Incoming: {newQty} × {money(newCost)}</small><small>Stock after restock: {oldQty+newQty} units · Selling price remains unchanged.</small></div>}
  <div className="purchase-total-card"><span>New purchase amount</span><strong>{money(total)}</strong><small>{newQty} × {money(newCost)}</small></div>
 </>}
 {edit&&<label className="field"><span>Average purchase cost per unit (view only)</span><input type="number" value={cost} readOnly/><small>For cost corrections, edit the original purchase rather than overwriting the average.</small></label>}
 <label className="field"><span>Sale price per unit</span><input name="sale_price" type="number" min="0" step="0.01" defaultValue={item.sale_price??''}/></label>
 {(purchase||restock)&&<><div className="form-section">Accessory supplier</div><label className="field"><span>Existing accessory supplier</span><select name="supplier_id" value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Add a new accessory supplier</option>{suppliers.filter(s=>s.seller_kind==='accessory_supplier').map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>{!supplier&&<label className="field"><span>Supplier name *</span><input name="supplier_name" required/></label>}</>}
 {(purchase||restock)&&<><label className="field"><span>Paid now</span><input name="paid" type="number" min="0" max={total} step="0.01" placeholder="Leave blank for 0"/></label><label className="field"><span>Payment method</span><select name="method">{['cash','bank_transfer','card','jazzcash','easypaisa'].map(v=><option value={v} key={v}>{v.replaceAll('_',' ')}</option>)}</select></label></>}
 <label className="field"><span>Notes</span><input name="notes" defaultValue={restock?'':item.notes||''}/></label>
 </>;
}
