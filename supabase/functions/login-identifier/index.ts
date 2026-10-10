import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!service||!anon)return json({error:"Server configuration missing"},500);
  const body=await req.json();
  const identifier=String(body?.identifier||"").trim();
  const password=String(body?.password||"");
  if(!identifier||!password)return json({error:"Username/email and password are required"},400);
  let email=identifier.toLowerCase();
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  if(!identifier.includes("@")){
    const {data:profile,error}=await admin.from("user_profiles").select("id,is_active").ilike("username",identifier).maybeSingle();
    if(error||!profile||!profile.is_active)return json({error:"Invalid username/email or password"},401);
    const {data:userData,error:userError}=await admin.auth.admin.getUserById(profile.id);
    if(userError||!userData.user?.email)return json({error:"Invalid username/email or password"},401);
    email=userData.user.email;
  }
  const authClient=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await authClient.auth.signInWithPassword({email,password});
  if(error||!data.session)return json({error:"Invalid username/email or password"},401);
  return json({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
 }catch{return json({error:"Invalid username/email or password"},401);}
});