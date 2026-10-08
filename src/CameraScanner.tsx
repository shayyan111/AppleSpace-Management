import {useEffect,useRef,useState} from 'react';
import {RefreshCw,ScanLine,X} from 'lucide-react';
import {startCamera} from './camera.mjs';

export default function CameraScanner({onCode,onClose}:{onCode:(code:string)=>void;onClose:()=>void}) {
  const video=useRef<HTMLVideoElement>(null);
  const callbacks=useRef({onCode,onClose});
  callbacks.current={onCode,onClose};
  const [error,setError]=useState(''),[devices,setDevices]=useState<Array<{id:string;label:string}>>([]),[deviceId,setDeviceId]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!video.current)return;
    setError('');
    const scanner=startCamera(video.current,code=>{
      callbacks.current.onCode(code);
      callbacks.current.onClose();
    },setError,{deviceId,onCameras:setDevices});
    return scanner.stop;
  },[deviceId,retry]);
  return <div className="camera-scanner"><div className="camera-head"><b>Scan barcode / QR with camera</b><button type="button" aria-label="Close camera" onClick={onClose}><X size={17}/></button></div><label className="camera-device"><span>Camera</span><select aria-label="Barcode camera" value={deviceId} onChange={e=>setDeviceId(e.target.value)}><option value="">Automatic — rear camera on phone</option>{devices.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>{error&&<div className="error" role="alert">{error}</div>}<video ref={video} autoPlay playsInline muted hidden={!!error}/>{!error&&<div className="scan-guide"><ScanLine size={28}/><span>Keep the whole barcode or QR visible. Use good light and hold the camera steady.</span></div>}<div className="camera-actions"><button type="button" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={16}/>Retry camera</button></div></div>;
}
