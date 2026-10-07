import { createClient } from '@supabase/supabase-js';
export const db=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export async function readStore(){const {data,error}=await db.rpc('erp_read');if(error)throw error;return data;}
const pendingRequests=new Map<string,string>();
export async function act(payload:Record<string,unknown>){const {data:{session}}=await db.auth.getSession();const key=session?.user.id+':'+JSON.stringify(payload);const id=pendingRequests.get(key)||crypto.randomUUID();pendingRequests.set(key,id);const {data,error}=await db.rpc('erp_action',{p:{...payload,request_id:id}});if(error)throw error;pendingRequests.delete(key);return data;}
export async function uploadSeller(file:File,userId:string){if(file.size>5*1024*1024)throw Error('Choose a photo smaller than 5 MB.');const path=`${userId}/${crypto.randomUUID()}.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`;const {error}=await db.storage.from('seller-photos').upload(path,file);if(error)throw error;return path;}
