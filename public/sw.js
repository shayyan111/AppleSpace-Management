const CACHE='applespace-shell-v1';
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(['/','/index.html']);self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith((async()=>{try{const fresh=await fetch(req);const cache=await caches.open(CACHE);cache.put('/index.html',fresh.clone());return fresh;}catch{const cache=await caches.open(CACHE);return (await cache.match('/index.html'))||(await cache.match('/'));}})());return;
 }
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(req);try{const fresh=await fetch(req);if(fresh.ok)cache.put(req,fresh.clone());return fresh;}catch{if(cached)return cached;throw new Error('Offline and resource not cached');}})());
});
