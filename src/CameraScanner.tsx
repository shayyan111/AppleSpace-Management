import {useEffect,useRef,useState} from 'react';
import {ScanLine,X} from 'lucide-react';
import {startCamera} from './camera.mjs';

export default function CameraScanner({onCode,onClose}:{onCode:(code:string)=>void;onClose:()=>void}) {
  const video=useRef<HTMLVideoElement>(null);
  const callbacks=useRef({onCode,onClose});
  callbacks.current={onCode,onClose};
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!video.current)return;
    const scanner=startCamera(video.current,code=>{
      callbacks.current.onCode(code);
      callbacks.current.onClose();
    },setError);
    return scanner.stop;
  },[]);
  return <div className="camera-scanner"><div className="camera-head"><b>Scan with phone camera</b><button type="button" aria-label="Close camera" onClick={onClose}><X size={17}/></button></div>{error&&<div className="error" role="alert">{error}</div>}<video ref={video} playsInline muted hidden={!!error}/>{!error&&<div className="scan-guide"><ScanLine size={28}/><span>Place the barcode inside the frame</span></div>}</div>;
}
