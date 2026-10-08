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
