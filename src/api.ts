import { createClient } from '@supabase/supabase-js';
import {sessionAuthOptions,verifyPassword} from './authPolicy.mjs';
import {cacheStore,cachedStore,enqueueAction,getOfflineState,initializeOfflineState,isNetworkError,projectedStore,retryFailed,setNetworkState,subscribeOfflineState,syncPendingActions,pendingDetails} from './offline';
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
export async function uploadSeller(file:File,userId:string){
 if(file.size>5*1024*1024)throw Error('Choose a photo smaller than 5 MB.');
 const path=`${userId}/${crypto.randomUUID()}.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`;
 const {error}=await db.storage.from('seller-photos').upload(path,file);
 if(error)throw error;
 return path;
}
export async function readStore(signal?:AbortSignal){
 try{
  if(!navigator.onLine)throw new TypeError('Offline');
  const rpc=(name:string)=>{const request=db.rpc(name);return signal?request.abortSignal(signal):request;};
  const [{data,error},{data:sold,error:soldError}]=await Promise.all([rpc('erp_read'),rpc('erp_sold_phones')]);
  if(error)throw error;if(soldError)throw soldError;
  const fresh={...(data||{}),soldPhones:sold||[]};
  await cacheStore(fresh);
  return await projectedStore(fresh);
 }catch(error:any){
  if(signal?.aborted)throw error;
  if(!isNetworkError(error))throw error;
  const cached=await cachedStore();
  if(!cached)throw Error('You are offline and this device has no saved AppleSpace data yet. Connect once to load the store, then offline mode will work.');
  return await projectedStore(cached);
 }
}
const pendingRequests=new Map<string,string>();
export async function act(payload:Record<string,unknown>,options:{photo?:File;userId?:string}={}){
 const {data:{session}}=await db.auth.getSession();
 if(!session)throw Error('Your saved login is required for offline work. Sign in once while online on this device.');
 const key=session.user.id+':'+JSON.stringify(payload);
 const id=pendingRequests.get(key)||crypto.randomUUID();
 pendingRequests.set(key,id);
 let photoPath:string|undefined;
 let finalPayload={...payload,request_id:id} as Record<string,unknown>;
 try{
  if(!navigator.onLine)throw new TypeError('Offline');
  if(options.photo?.size){
   photoPath=await uploadSeller(options.photo,options.userId||session.user.id);
   finalPayload.photo_url=photoPath;
  }
  const {data,error}=await db.rpc('erp_action',{p:finalPayload});
  if(error)throw error;
  pendingRequests.delete(key);
  try{
   const current=await cachedStore();
   if(current){
    // A refresh will replace this cache with authoritative server data.
    await cacheStore(await projectedStore(current));
   }
  }catch{}
  return {...data,offline:false};
 }catch(error:any){
  if(isNetworkError(error)){
   if(photoPath){finalPayload.photo_url=photoPath;}
   await enqueueAction(finalPayload,{photo:photoPath?undefined:options.photo,userId:options.userId||session.user.id,requestId:id});
   pendingRequests.delete(key);
   return {offline:true,queued:true,request_id:id};
  }
  if(photoPath)await db.storage.from('seller-photos').remove([photoPath]).catch(()=>{});
  throw error;
 }
}
export async function syncOffline(){
 setNetworkState(navigator.onLine);
 if(!navigator.onLine)return {synced:0,failed:0};
 const result=await syncPendingActions(db,uploadSeller);
 return result;
}
export {getOfflineState,initializeOfflineState,retryFailed,setNetworkState,subscribeOfflineState,pendingDetails};


export async function createStaffUser(input:{email?:string;password:string;username?:string;full_name:string;role:string;is_active:boolean;website_portal_access:boolean}){
 const {data,error}=await db.functions.invoke('staff-admin',{body:{action:'create',...input}});
 if(error)throw error;
 if(data?.error)throw Error(data.error);
 return data;
}

export async function deleteStaffUser(userId:string){
 const {data,error}=await db.functions.invoke('staff-admin',{body:{action:'delete',user_id:userId}});
 if(error)throw error;
 if(data?.error)throw Error(data.error);
 return data;
}


export async function updateStaffUser(input:{user_id:string;username?:string;full_name:string;role:string;is_active:boolean;website_portal_access:boolean}){
 const {data,error}=await db.functions.invoke('staff-admin',{body:{action:'update',...input}});
 if(error)throw error;
 if(data?.error)throw Error(data.error);
 return data;
}


export async function loginWithIdentifier(identifier:string,password:string){
 const value=identifier.trim();
 if(!value)throw Error('Enter your username or email.');
 if(value.includes('@')){
  const {error}=await db.auth.signInWithPassword({email:value.toLowerCase(),password});
  if(error)throw Error('Invalid username/email or password');
  return;
 }
 const {data,error}=await db.functions.invoke('login-identifier',{body:{identifier:value,password}});
 if(error)throw Error('Invalid username/email or password');
 if(data?.error)throw Error(data.error);
 const {error:setError}=await db.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
 if(setError)throw setError;
}


export async function updatePhonePurchase(payload:Record<string,unknown>){
 const {data,error}=await db.rpc('erp_update_phone_purchase',{p:payload});
 if(error)throw error;
 return data;
}

export async function deletePhonePurchase(purchaseId:string){
 const {data,error}=await db.rpc('erp_delete_phone_purchase',{p_purchase_id:purchaseId});
 if(error)throw error;
 return data;
}
