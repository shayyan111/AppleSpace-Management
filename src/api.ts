import { createClient } from '@supabase/supabase-js';
import {sessionAuthOptions,verifyPassword} from './authPolicy.mjs';
export const db=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:sessionAuthOptions});
// A separate, memory-only session verifies the password without replacing the main login.
const verificationClient=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{...sessionAuthOptions,autoRefreshToken:false,storageKey:'applespace-owner-verification'}});
let verifyingOwner=false;
export async function verifyOwnerPassword(email:string,password:string){
 if(verifyingOwner)throw Error('Password verification is already in progress.');
 verifyingOwner=true;
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session)throw Error('Sign in again to continue.');
  await verifyPassword(verificationClient.auth,session.user,email,password);
  const {data:{session:current}}=await db.auth.getSession();
  if(current?.user.id!==session.user.id)throw Error('The login changed. Sign in again.');
 }finally{verifyingOwner=false;}
}
export async function readStore(){const [{data,error},{data:sold,error:soldError}]=await Promise.all([db.rpc('erp_read'),db.rpc('erp_sold_phones')]);if(error)throw error;if(soldError)throw soldError;return {...(data||{}),soldPhones:sold||[]};}
const pendingRequests=new Map<string,string>();
export async function act(payload:Record<string,unknown>){const {data:{session}}=await db.auth.getSession();const key=session?.user.id+':'+JSON.stringify(payload);const id=pendingRequests.get(key)||crypto.randomUUID();pendingRequests.set(key,id);const {data,error}=await db.rpc('erp_action',{p:{...payload,request_id:id}});if(error)throw error;pendingRequests.delete(key);return data;}
export async function uploadSeller(file:File,userId:string){if(file.size>5*1024*1024)throw Error('Choose a photo smaller than 5 MB.');const path=`${userId}/${crypto.randomUUID()}.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`;const {error}=await db.storage.from('seller-photos').upload(path,file);if(error)throw error;return path;}
