import {availableCameras,cameraError,videoConstraints} from './photoCamera.mjs';
import {loadScanDecoder,nativeFormats} from './scanDecoder.mjs';
import {scanBeep} from './scanFeedback.mjs';

export function startCamera(video,onCode,onError,dependencies={}){
 let stopped=false,stream,timer,track,capabilities={},attempt=0;
 const schedule=dependencies.schedule??((fn,ms)=>setTimeout(fn,ms));
 const cancel=dependencies.cancel??clearTimeout;
 const stop=()=>{
  stopped=true;if(timer!==undefined)cancel(timer);timer=undefined;
  stream?.getTracks().forEach(t=>t.stop());stream=undefined;track=undefined;
  video.srcObject=null;
 };
 const setControl=async(name,value)=>{
  if(stopped||!track?.applyConstraints)throw Error('Camera is not ready.');
  if(name==='torch'&&!capabilities.torch)throw Error('This camera has no torch control.');
  if(name==='zoom'&&(!capabilities.zoom||value<capabilities.zoom.min||value>capabilities.zoom.max))throw Error('This zoom is unavailable.');
  if(!['torch','zoom'].includes(name))throw Error('Unknown camera control.');
  await track.applyConstraints({advanced:[{[name]:value}]});
 };
 const ready=(async()=>{
  try{
   const media=dependencies.mediaDevices??globalThis.navigator?.mediaDevices;
   if(!media?.getUserMedia)throw Error('Open the app through HTTPS or localhost and allow camera access.');
   const constraints=videoConstraints(dependencies.deviceId,'environment');
   constraints.video.width={ideal:1920};constraints.video.height={ideal:1080};constraints.video.frameRate={ideal:30};
   const decoderPromise=(dependencies.loadDecoder??loadScanDecoder)().then(value=>({value}),error=>({error}));
   stream=await media.getUserMedia(constraints);
   if(stopped){stop();return;}
   track=stream.getVideoTracks?.()[0];
   try{capabilities=track?.getCapabilities?.()||{};}catch{/* Optional camera features. */}
   if(capabilities.focusMode?.includes('continuous')){
    try{await track.applyConstraints({advanced:[{focusMode:'continuous'}]});}catch{/* Use camera defaults. */}
   }
   if(stopped){stop();return;}
   video.srcObject=stream;await video.play();
   if(stopped){stop();return;}
   let detector;
   const Detector=dependencies.BarcodeDetector??globalThis.BarcodeDetector;
   if(Detector){try{
    const supported=await Detector.getSupportedFormats();
    const formats=nativeFormats.filter(f=>supported.includes(f));
    if(formats.includes('code_128')||formats.includes('qr_code'))detector=new Detector({formats});
   }catch{/* Software decoder works without the experimental native API. */}}
   const loaded=await decoderPromise;
   if(stopped){stop();return;}
   if(loaded.error&&!detector)throw loaded.error;
   const decoder=loaded.value;
   let cameras=[];try{cameras=await availableCameras(media);}catch{/* Default camera still works. */}
   if(stopped){stop();return;}
   dependencies.onCameras?.(cameras);
   const zoom=capabilities.zoom;
   dependencies.onReady?.({torch:!!capabilities.torch,zoom:zoom?{min:zoom.min,max:zoom.max,step:zoom.step||.1,value:track?.getSettings?.().zoom??zoom.min}:null});
   const loop=async()=>{
    if(stopped)return;
    try{
     let code='';
     if(video.readyState>=2&&video.videoWidth&&video.videoHeight){
      if(detector){try{const results=await detector.detect(video);code=results.find(r=>r.rawValue?.trim())?.rawValue||'';}catch{detector=undefined;}}
      if(stopped)return;
      // Native detection is fast. Periodic software passes also handle formats
      // missing from native support and labels the native reader cannot decode.
      if(!code&&decoder&&(!detector||attempt%3===0))code=decoder.decodeFrame(video,Math.floor(attempt/(detector?3:1)));
      attempt++;
     }
     if(stopped)return;
     if(code?.trim()){
      stop();
      try{Promise.resolve((dependencies.beep??scanBeep)()).catch(()=>{});}catch{/* Sound never blocks stock lookup. */}
      onCode(code.trim());return;
     }
     if(!detector&&!decoder)throw loaded.error||Error('Decoder unavailable. Retry the camera.');
     timer=schedule(loop,100);
    }catch(error){const notify=!stopped;stop();if(notify)onError(cameraError(error));}
   };
   void loop();
  }catch(error){const notify=!stopped;stop();if(notify)onError(cameraError(error));}
 })();
 return {stop,ready,setControl};
}
