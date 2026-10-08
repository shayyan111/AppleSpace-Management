export const sessionAuthOptions:{persistSession:false;autoRefreshToken:true;detectSessionInUrl:false};
export const ownerUnlockMs:number;
export function verifyPassword(auth:any,user:{id:string;email?:string}|undefined,email:string,password:string):Promise<void>;
