export const sessionAuthOptions={persistSession:false,autoRefreshToken:true,detectSessionInUrl:false};
export const ownerUnlockMs=10*60*1000;

export async function verifyPassword(auth,user,email,password){
 if(!user?.id||email.trim().toLowerCase()!==user.email?.toLowerCase())throw Error('Use the ID of the owner currently signed in.');
 try{
  const {data,error}=await auth.signInWithPassword({email:email.trim(),password});
  if(error)throw error;
  if(data.user?.id!==user.id)throw Error('The account does not match the signed-in owner.');
 }finally{
  await auth.signOut({scope:'local'});
 }
}
