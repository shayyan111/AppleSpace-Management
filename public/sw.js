const CACHE='applespace-shell-v2';

async function precacheBuild(){
 const cache=await caches.open(CACHE);
 await cache.addAll(['/','/index.html']);
 try{
  const response=await fetch('/manifest.json',{cache:'no-store'});
  if(!response.ok)return;
  const manifest=await response.json();
  const files=new Set(['/','/manifest.json']);
  for(const entry of Object.values(manifest)){
   if(entry?.file)files.add('/'+entry.file);
   for(const key of ['css','assets'])for(const file of (entry?.[key]||[]))files.add('/'+file);
  }
  await Promise.all([...files].map(async file=>{try{await cache.add(file);}catch{}}));
 }catch{}
}

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{await precacheBuild();self.skipWaiting();})());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await precacheBuild();
  await self.clients.claim();
 })());
});

self.addEventListener('message',event=>{
 if(event.data?.type==='PRECACHE')event.waitUntil?.(precacheBuild());
});

self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;

 if(req.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    const fresh=await fetch(req);
    const cache=await caches.open(CACHE);
    cache.put('/index.html',fresh.clone());
    return fresh;
   }catch{
    const cache=await caches.open(CACHE);
    return (await cache.match('/index.html'))||(await cache.match('/'));
   }
  })());
  return;
 }

 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(req);
  if(cached){
   fetch(req).then(fresh=>{if(fresh.ok)cache.put(req,fresh.clone());}).catch(()=>{});
   return cached;
  }
  try{
   const fresh=await fetch(req);
   if(fresh.ok)cache.put(req,fresh.clone());
   return fresh;
  }catch{
   throw new Error('Offline and resource not cached');
  }
 })());
});
