import {useEffect,useRef,useState} from 'react';
import {Camera,RefreshCw,X} from 'lucide-react';
import {availableCameras,captureSellerPhoto,startPhotoCamera} from './photoCamera.mjs';
export default function PhotoCapture({onCapture,onClose}:{onCapture:(file:File)=>void;onClose:()=>void}){
 const video=useRef<HTMLVideoElement>(null),callbacks=useRef({onCapture,onClose});callbacks.current={onCapture,onClose};
 const [devices,setDevices]=useState<Array<{id:string;label:string}>>([]),[deviceId,setDeviceId]=useState(''),[retry,setRetry]=useState(0),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0);
 useEffect(()=>{
  if(!video.current)return;
  const version=++generation.current;setReady(false);setError('');setBusy(false);
  const camera=startPhotoCamera(video.current,list=>{setDevices(list);setReady(true);},setError,{deviceId});
  const refresh=()=>{void availableCameras().then(list=>{if(version===generation.current)setDevices(list);}).catch(()=>{});};
  navigator.mediaDevices?.addEventListener('devicechange',refresh);
  return()=>{generation.current++;camera.stop();navigator.mediaDevices?.removeEventListener('devicechange',refresh);};
 },[deviceId,retry]);
 async function takePhoto(){
  if(!ready||busy||!video.current)return;const version=generation.current;setBusy(true);setError('');
  try{const file=await captureSellerPhoto(video.current);if(version===generation.current)callbacks.current.onCapture(file);}
  catch(err:any){if(version===generation.current)setError(err.message);}
  finally{if(version===generation.current)setBusy(false);}
 }
 return <div className="camera-scanner photo-camera"><div className="camera-head"><b>Take seller photo</b><button type="button" aria-label="Close seller camera" onClick={onClose}><X size={17}/></button></div><label className="camera-device"><span>Camera</span><select aria-label="Seller camera" value={deviceId} disabled={busy} onChange={e=>setDeviceId(e.target.value)}><option value="">Default camera</option>{devices.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>{error&&<div className="error" role="alert">{error}</div>}<video ref={video} autoPlay playsInline muted/><p className="camera-tip">Position the seller in the preview. Choose your built-in or connected USB camera above.</p><div className="camera-actions"><button type="button" className="primary" disabled={!ready||busy} onClick={takePhoto}><Camera size={17}/>{busy?'Capturing…':'Capture photo'}</button><button type="button" disabled={busy} onClick={()=>setRetry(r=>r+1)}><RefreshCw size={16}/>Retry camera</button></div></div>;
}
