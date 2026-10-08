import {useEffect,useRef,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {ShieldCheck} from 'lucide-react';
import {ownerUnlockMs} from './authPolicy.mjs';
export default function PasswordGate({required,page,email,verify,onLock,children}:{required:boolean;page:string;email:string;verify:(email:string,password:string)=>Promise<void>;onLock:()=>void;children:ReactNode}){
 const [unlocked,setUnlocked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),active=useRef(true),lockCallback=useRef(onLock);lockCallback.current=onLock;
 function lock(){generation.current++;setUnlocked(false);lockCallback.current();}
 useEffect(()=>{active.current=true;return()=>{active.current=false;generation.current++;}},[]);
 useEffect(()=>{
  if(!required)return;
  const hidden=()=>{if(document.hidden)lock();};
  document.addEventListener('visibilitychange',hidden);
  const timer=unlocked?setTimeout(lock,ownerUnlockMs):undefined;
  return()=>{document.removeEventListener('visibilitychange',hidden);clearTimeout(timer);};
 },[required,unlocked]);
 async function unlock(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  const form=e.currentTarget,values=new FormData(form),attempt=++generation.current;
  setBusy(true);setError('');
  try{await verify(String(values.get('email')),String(values.get('password')));if(active.current&&generation.current===attempt)setUnlocked(true);}
  catch(err:any){if(active.current&&generation.current===attempt)setError(err.message||'Password verification failed.');}
  finally{form.reset();if(active.current)setBusy(false);}
 }
 if(!required)return <>{children}</>;
 if(unlocked)return <><div className="owner-unlock"><span><ShieldCheck size={16}/>Owner verified · {page}</span><button onClick={lock}>Lock now</button></div>{children}</>;
 return <section className="panel owner-gate"><ShieldCheck size={32}/><h2>Unlock {page}</h2><p>Enter your owner ID and password to open this page.</p><form onSubmit={unlock}><label className="field"><span>Owner ID (email)</span><input name="email" type="email" defaultValue={email} required autoComplete="username"/></label><label className="field"><span>Password</span><input name="password" type="password" required autoComplete="current-password"/></label>{error&&<div className="error" role="alert">{error}</div>}<button className="primary" disabled={busy}>{busy?'Verifying…':'Unlock '+page}</button></form><small>Locks when you leave this page, switch away from the app, or after 10 minutes.</small></section>;
}
