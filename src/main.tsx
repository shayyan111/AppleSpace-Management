import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import appleSpaceLogo from './assets/applespace-logo.png';
import './style.css';


function installBrandManifest(){
 const manifest={
  name:'AppleSpace Store ERP',
  short_name:'AppleSpace',
  description:'AppleSpace store management ERP',
  start_url:'/',
  scope:'/',
  display:'standalone',
  background_color:'#ADABAE',
  theme_color:'#23262B',
  icons:[
   {src:appleSpaceLogo,sizes:'any',type:'image/png',purpose:'any'},
   {src:appleSpaceLogo,sizes:'any',type:'image/png',purpose:'maskable'}
  ]
 };
 const blob=new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'});
 const manifestUrl=URL.createObjectURL(blob);
 let manifestLink=document.querySelector('link[rel="manifest"]') as HTMLLinkElement|null;
 if(!manifestLink){manifestLink=document.createElement('link');manifestLink.rel='manifest';document.head.appendChild(manifestLink);}
 manifestLink.href=manifestUrl;
 let touch=document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement|null;
 if(!touch){touch=document.createElement('link');touch.rel='apple-touch-icon';document.head.appendChild(touch);}
 touch.href=appleSpaceLogo;
 let icon=document.querySelector('link[rel="icon"]') as HTMLLinkElement|null;
 if(!icon){icon=document.createElement('link');icon.rel='icon';icon.type='image/png';document.head.appendChild(icon);}
 icon.href=appleSpaceLogo;
}
installBrandManifest();

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
