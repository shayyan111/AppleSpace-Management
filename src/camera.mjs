import {availableCameras,cameraError,videoConstraints} from './photoCamera.mjs';
export function startCamera(video, onCode, onError, dependencies = {}) {
  let stopped = false;
  let stream;
  let controls;
  const stop = () => {
    stopped = true;
    controls?.stop();
    controls = undefined;
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
    video.srcObject = null;
  };
  const ready = (async () => {
    try {
      const media = dependencies.mediaDevices ?? globalThis.navigator?.mediaDevices;
      if (!media?.getUserMedia) throw Error('Open the app through HTTPS or localhost and allow camera access.');
      stream = await media.getUserMedia(videoConstraints(dependencies.deviceId, 'environment'));
      if (stopped) { stop(); return; }
      if(dependencies.onCameras){
        let cameras=[];try{cameras=await availableCameras(media);}catch{/* Default camera can still scan. */}
        if(stopped){stop();return;}
        dependencies.onCameras(cameras);
      }
      const load = dependencies.loadDecoder ?? (async () => {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        return new BrowserMultiFormatReader();
      });
      const decoder = await load();
      if (stopped) { stop(); return; }
      controls = await decoder.decodeFromStream(stream, video, (result, _error, scanControls) => {
        if (!result || stopped) return;
        const code = result.getText();
        scanControls?.stop();
        stop();
        onCode(code);
      });
      if (stopped) stop();
    } catch (error) {
      const notify = !stopped;
      stop();
      if (notify) onError(cameraError(error));
    }
  })();
  return { stop, ready };
}
