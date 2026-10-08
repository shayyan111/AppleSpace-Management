import {useEffect,useRef,useState} from 'react';
import {RefreshCw,ScanLine,Flashlight,Volume2,X} from 'lucide-react';
import {startCamera,type ScannerControls} from './camera.mjs';
import {prepareScanFeedback,scanBeep} from './scanFeedback.mjs';

export default function CameraScanner({onCode,onClose}:{onCode:(code:string)=>void;onClose:()=>void}) {
  const video=useRef<HTMLVideoElement>(null);
  const callbacks=useRef({onCode,onClose});
  const session=useRef<ReturnType<typeof startCamera>|null>(null);
  callbacks.current={onCode,onClose};
  const [error,setError]=useState(''),[devices,setDevices]=useState<Array<{id:string;label:string}>>([]),[deviceId,setDeviceId]=useState(''),[retry,setRetry]=useState(0);
  const [controls,setControls]=useState<ScannerControls>({torch:false,zoom:null}),[torch,setTorch]=useState(false),[zoom,setZoom]=useState(1),[controlError,setControlError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  useEffect(()=>{
    if(!video.current)return;
    let active=true;
    setError('');setReady(false);setControls({torch:false,zoom:null});setTorch(false);setControlError('');setBusy(false);
    const scanner=startCamera(video.current,code=>{
      callbacks.current.onCode(code);
      callbacks.current.onClose();
    },message=>{if(active)setError(message);},{deviceId,onCameras:list=>{if(active)setDevices(list);},onReady:features=>{if(active){setReady(true);setControls(features);setZoom(features.zoom?.value??1);}}});
    session.current=scanner;
    return ()=>{active=false;scanner.stop();if(session.current===scanner)session.current=null;};
  },[deviceId,retry]);
  const adjust=async(name:'torch'|'zoom',value:boolean|number)=>{
    const scanner=session.current;if(!scanner)return;
    setBusy(true);setControlError('');
    try{await scanner.setControl(name,value);if(session.current===scanner){if(name==='torch')setTorch(Boolean(value));else setZoom(Number(value));}}
    catch{if(session.current===scanner)setControlError('The camera could not apply that setting. Try another camera or use more light.');}
    finally{if(session.current===scanner)setBusy(false);}
  };
  return <div className="camera-scanner"><div className="camera-head"><b>Scan barcode / QR with camera</b><button type="button" aria-label="Close camera" onClick={onClose}><X size={17}/></button></div><label className="camera-device"><span>Camera</span><select aria-label="Barcode camera" value={deviceId} onChange={e=>{void prepareScanFeedback();setDeviceId(e.target.value);}}><option value="">Automatic — rear camera on phone</option>{devices.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>{error&&<div className="error" role="alert">{error}</div>}<video ref={video} autoPlay playsInline muted hidden={!!error}/>{!error&&<div className="scan-guide" role="status"><ScanLine size={28}/><span>{ready?'Scanning… Centre the complete barcode or QR. Start 15–25 cm away and move slowly until sharp.':'Starting camera…'}</span></div>}<div className="camera-actions"><button type="button" onClick={()=>{void prepareScanFeedback();setRetry(n=>n+1);}}><RefreshCw size={16}/>Retry camera</button><button type="button" onClick={()=>{void scanBeep().then(played=>{if(!played)setControlError('Sound is blocked by this browser. Check site sound permissions and device volume.');});}}><Volume2 size={16}/>Test beep</button>{controls.torch&&<button type="button" aria-pressed={torch} disabled={busy} onClick={()=>void adjust('torch',!torch)}><Flashlight size={16}/>{torch?'Torch off':'Torch on'}</button>}</div>{controls.zoom&&controls.zoom.max>controls.zoom.min&&<label className="scan-zoom"><span>Zoom {zoom.toFixed(1)}×</span><input type="range" aria-label="Camera zoom" min={controls.zoom.min} max={controls.zoom.max} step={controls.zoom.step} value={zoom} disabled={busy} onChange={e=>void adjust('zoom',Number(e.target.value))}/></label>}{controlError&&<p role="status" className="scan-control-error">{controlError}</p>}</div>;
}
