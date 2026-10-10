import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

if('serviceWorker' in navigator){
 if(import.meta.env.PROD){
  window.addEventListener('load',()=>{
   void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
  });
 }else{
  // Never let a production service worker control Vite's development server.
  // An old cached bundle can otherwise make local code changes appear to do nothing.
  void navigator.serviceWorker.getRegistrations().then(registrations=>Promise.all(registrations.map(r=>r.unregister()))).then(()=>{
   if('caches' in window) return caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('applespace-shell-')).map(k=>caches.delete(k))));
  }).catch(()=>{});
 }
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
