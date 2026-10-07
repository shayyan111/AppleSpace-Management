import {useState} from 'react';
export default function ExpenseForm({phone=false,initialCategory}:{phone?:boolean;initialCategory?:string}){
 const options=phone?['Repair','Parts','Transport','Other phone expense']:['Rent','Utilities','Salaries','Marketing','Transport','Repairs','Other'];
 const [category,setCategory]=useState(initialCategory||options[0]);const other=/^others?(\b|\s)/i.test(category);
 return <><label className="field"><span>{phone?'Expense type':'Category'}</span><select name="category" value={category} onChange={e=>setCategory(e.target.value)}>{options.map(c=><option key={c}>{c}</option>)}</select></label><label className="field"><span>Amount *</span><input name="amount" type="number" min="0.01" step="0.01" required/></label><label className="field"><span>Description {other?'*':'(optional)'}</span><input name="description" required={other} maxLength={1000}/></label><label className="field"><span>Payment method</span><select name="method">{['cash','bank_transfer','card','jazzcash','easypaisa'].map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label></>;
}
