// Share concurrent reads, while explicit post-save reads supersede old reads.
// No persistent cache: each completed refresh reaches the live database.
export function createReadCoordinator(fetchSnapshot){
 let active;
 const cancel=()=>{const previous=active;active=undefined;previous?.controller.abort();};
 const read=(key,{force=false}={})=>{
  if(active?.key===key&&!force)return active.promise;
  cancel();
  const controller=new AbortController(),entry={key,controller};
  entry.promise=Promise.resolve().then(()=>fetchSnapshot(controller.signal)).finally(()=>{if(active===entry)active=undefined;});
  active=entry;return entry.promise;
 };
 return {read,cancel};
}
