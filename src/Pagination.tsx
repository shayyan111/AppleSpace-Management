import {useState} from 'react';
export function usePagination<T>(rows:T[],resetKey:string,size=50){
 const [position,setPosition]=useState({key:resetKey,page:0});
 const count=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(position.key===resetKey?position.page:0,count-1);
 const move=(next:number)=>setPosition({key:resetKey,page:Math.max(0,Math.min(next,count-1))});
 return {visible:rows.slice(page*size,(page+1)*size),pagination:{page,count,size,total:rows.length,move}};
}
export default function Pagination({page,count,size,total,move}:{page:number;count:number;size:number;total:number;move:(page:number)=>void}){
 if(total<=size)return null;
 return <div className="pagination" aria-label="Record pages"><span>Showing {page*size+1}–{Math.min((page+1)*size,total)} of {total}</span><div><button type="button" disabled={page===0} onClick={()=>move(page-1)}>Previous</button><label>Page <select aria-label="Record page" value={page} onChange={e=>move(Number(e.target.value))}>{Array.from({length:count},(_,i)=><option value={i} key={i}>{i+1}</option>)}</select> of {count}</label><button type="button" disabled={page===count-1} onClick={()=>move(page+1)}>Next</button></div></div>;
}
