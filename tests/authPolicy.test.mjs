import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {sessionAuthOptions,verifyPassword} from '../src/authPolicy.mjs';
const owner={id:'owner',email:'owner@example.com'};
test('A new Supabase client requires login even if an earlier client signed in',async()=>{
 const calls=[];
 const storage={getItem:key=>{calls.push(['read',key]);return null;},setItem:(key,value)=>calls.push(['write',key,value]),removeItem:key=>calls.push(['remove',key])};
 const fetch=async()=>new Response(JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user:owner}),{status:200,headers:{'content-type':'application/json'}});
 const make=()=>createClient('https://example.supabase.co','publishable-test',{auth:{...sessionAuthOptions,storage},global:{fetch}});
 const original=make(),fresh=make();
 try{
  const signed=await original.auth.signInWithPassword({email:owner.email,password:'test-password'});assert.equal(signed.error,null);
  assert.equal((await original.auth.getSession()).data.session.user.id,'owner');
  assert.equal((await fresh.auth.getSession()).data.session,null);
  assert.deepEqual(calls,[],'Sessions must never read/write browser storage');
 }finally{await original.auth.signOut({scope:'local'});await fresh.auth.signOut({scope:'local'});}
});
test('Owner verification checks the password with Auth and closes only its verification session',async()=>{
 const calls=[];
 const auth={signInWithPassword:async credentials=>{calls.push(credentials);return {data:{user:owner},error:null};},signOut:async options=>{calls.push(options);}};
 await verifyPassword(auth,owner,' OWNER@example.com ','secret');
 assert.deepEqual(calls,[{email:'OWNER@example.com',password:'secret'},{scope:'local'}]);
});
test('Wrong credentials and a different owner identity cannot unlock a page',async()=>{
 let closed=0,attempts=0;
 const auth={signInWithPassword:async()=>{attempts++;return {data:{},error:new Error('Invalid login credentials')};},signOut:async()=>{closed++;}};
 await assert.rejects(verifyPassword(auth,owner,'someone@example.com','secret'),/owner currently signed in/);assert.equal(attempts,0);
 await assert.rejects(verifyPassword(auth,owner,owner.email,'wrong'),/Invalid login credentials/);assert.equal(closed,1);
 auth.signInWithPassword=async()=>({data:{user:{id:'other'}},error:null});
 await assert.rejects(verifyPassword(auth,owner,owner.email,'secret'),/does not match/);assert.equal(closed,2);
});
