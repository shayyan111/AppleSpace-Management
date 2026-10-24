export function cameraError(error){
 const messages={NotAllowedError:'Camera permission was denied. Allow camera access in your browser site settings, then retry.',NotFoundError:'No camera found. Connect a camera, then retry.',NotReadableError:'The camera is busy or unavailable. Close other camera apps, then retry.',OverconstrainedError:'This camera is no longer available. Choose another camera.'};
 return messages[error?.name]||error?.message||'Could not open the camera.';
}
export function videoConstraints(deviceId='',facingMode='user'){
 return {audio:false,video:{width:{ideal:1280},height:{ideal:720},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:facingMode}})}};
}
export async function availableCameras(media=globalThis.navigator?.mediaDevices){
 if(!media?.enumerateDevices)return [];
 const devices=await media.enumerateDevices();
 return devices.filter(d=>d.kind==='videoinput'&&d.deviceId).map((d,i)=>({id:d.deviceId,label:d.label||`Camera ${i+1}`}));
}
export function startPhotoCamera(video,onReady,onError,options={},dependencies={}){
 let stopped=false,stream;
 const stop=()=>{stopped=true;stream?.getTracks().forEach(t=>t.stop());stream=undefined;video.srcObject=null;};
 const ready=(async()=>{
  try{
   const media=dependencies.mediaDevices??globalThis.navigator?.mediaDevices;
   if(!media?.getUserMedia)throw Error('Open the ERP through HTTPS or localhost to use the camera.');
   stream=await media.getUserMedia(videoConstraints(options.deviceId,options.facingMode));
   if(stopped){stop();return;}
   video.srcObject=stream;await video.play();
   if(stopped){stop();return;}
   let cameras=[];try{cameras=await availableCameras(media);}catch{/* Capture still works if device listing is unavailable. */}
   if(stopped){stop();return;}
   onReady(cameras);
  }catch(error){const notify=!stopped;stop();if(notify)onError(cameraError(error));}
 })();
 return {stop,ready};
}
export async function captureSellerPhoto(video,dependencies={}){
 if(!video.videoWidth||!video.videoHeight)throw Error('Wait for the camera preview before taking the photo.');
 const canvas=(dependencies.createCanvas||(()=>document.createElement('canvas')))();
 const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
 canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
 const context=canvas.getContext('2d');if(!context)throw Error('Could not capture the photo. Choose a photo file instead.');
 context.drawImage(video,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));
 if(!blob)throw Error('Could not create the photo. Please retry.');
 if(blob.size>5*1024*1024)throw Error('Choose a photo smaller than 5 MB.');
 return new File([blob],`seller-photo-${Date.now()}.jpg`,{type:'image/jpeg'});
}
export function attachSellerPhoto(input,file,dependencies={}){
 const Transfer=dependencies.DataTransfer??globalThis.DataTransfer;
 if(!Transfer)throw Error('This browser cannot attach a camera photo. Choose a photo file instead.');
 const transfer=new Transfer();transfer.items.add(file);input.files=transfer.files;
}

export async function compressSellerPhoto(file,dependencies={}){
 if(!file)return file;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP photo.');
 const createBitmap=dependencies.createImageBitmap??globalThis.createImageBitmap;
 let source,width,height,cleanup=()=>{};
 if(createBitmap){
  source=await createBitmap(file);
  width=source.width;height=source.height;
  cleanup=()=>source.close?.();
 }else{
  const URLImpl=dependencies.URL??globalThis.URL;
  const ImageImpl=dependencies.Image??globalThis.Image;
  if(!URLImpl?.createObjectURL||!ImageImpl)throw Error('This browser cannot compress this photo.');
  const url=URLImpl.createObjectURL(file);
  source=await new Promise((resolve,reject)=>{const img=new ImageImpl();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not read this photo.'));img.src=url;});
  width=source.naturalWidth||source.width;height=source.naturalHeight||source.height;
  cleanup=()=>URLImpl.revokeObjectURL(url);
 }
 try{
  const maxSide=900;
  const scale=Math.min(1,maxSide/Math.max(width,height));
  const canvas=(dependencies.createCanvas||(()=>document.createElement('canvas')))();
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Could not compress this photo.');
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  let quality=.68,blob=null;
  for(let i=0;i<5;i++){
   blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
   if(!blob)throw Error('Could not compress this photo.');
   if(blob.size<=180*1024||quality<=.38)break;
   quality-=.08;
  }
  if(blob.size>280*1024){
   const shrink=Math.sqrt((220*1024)/blob.size);
   const next=(dependencies.createCanvas||(()=>document.createElement('canvas')))();
   next.width=Math.max(1,Math.round(canvas.width*shrink));next.height=Math.max(1,Math.round(canvas.height*shrink));
   const nextCtx=next.getContext('2d');if(!nextCtx)throw Error('Could not compress this photo.');
   nextCtx.drawImage(canvas,0,0,next.width,next.height);
   blob=await new Promise(resolve=>next.toBlob(resolve,'image/jpeg',.58));
   if(!blob)throw Error('Could not compress this photo.');
  }
  const base=(file.name||'seller-photo').replace(/\.[^.]+$/,'');
  return new File([blob],base+'-compressed.jpg',{type:'image/jpeg',lastModified:Date.now()});
 }finally{cleanup();}
}
