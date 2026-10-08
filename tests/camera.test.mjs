import test from 'node:test';
import assert from 'node:assert/strict';
import {startCamera} from '../src/camera.mjs';

function fixture(options={}){
 const queue=[],codes=[],errors=[],requests=[];let stopped=0,beeps=0;
 const video={readyState:2,videoWidth:1920,videoHeight:1080,play:async()=>{}};
 const track={stop(){stopped++},getCapabilities:()=>({}),...options.track};
 const dependencies={mediaDevices:{getUserMedia:async request=>{requests.push(request);return {getTracks:()=>[track],getVideoTracks:()=>[track]};}},loadDecoder:async()=>({decodeFrame:()=>''}),beep:()=>{beeps++},schedule:(fn,delay)=>{queue.push({fn,delay});return queue.length;},cancel:()=>{},...options.dependencies};
 const scanner=startCamera(video,code=>codes.push(code),error=>errors.push(error),dependencies);
 return {scanner,queue,codes,errors,requests,video,get stopped(){return stopped},get beeps(){return beeps}};
}

test('Closing scanner while permission is pending stops a late camera stream',async()=>{
 let resolve,stopped=0;
 const permission=new Promise(r=>{resolve=r});
 const scanner=startCamera({},()=>assert.fail('No callback after close'),()=>assert.fail('No error after close'),{
  mediaDevices:{getUserMedia:()=>permission},loadDecoder:async()=>({decodeFrame:()=>''})
 });
 scanner.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});await scanner.ready;assert.equal(stopped,1);
});
test('A software decode beeps and delivers only once, releasing camera tracks',async()=>{
 const f=fixture({dependencies:{loadDecoder:async()=>({decodeFrame:()=> '  AS-123 '})}});
 await f.scanner.ready;assert.deepEqual(f.codes,['AS-123']);assert.equal(f.stopped,1);assert.equal(f.beeps,1);assert.equal(f.video.srcObject,null);f.scanner.stop();assert.equal(f.stopped,1);
});
test('Empty frames retry at 100ms, and a queued scan cannot fire after close',async()=>{
 const f=fixture();await f.scanner.ready;assert.equal(f.queue[0].delay,100);assert.equal(f.beeps,0);
 f.scanner.stop();await f.queue[0].fn();assert.equal(f.queue.length,1);assert.deepEqual(f.codes,[]);assert.equal(f.stopped,1);
});
test('Decoder failure releases an opened stream and reports an error',async()=>{
 const f=fixture({dependencies:{loadDecoder:async()=>{throw Error('Decoder unavailable')}}});
 await f.scanner.ready;assert.equal(f.stopped,1);assert.deepEqual(f.errors,['Decoder unavailable']);
});
test('Scanner requests sharper rear-camera video and can select a specific camera',async()=>{
 const devices=[],requests=[];
 const dependencies={mediaDevices:{getUserMedia:async request=>{requests.push(request);return {getTracks:()=>[{stop(){}}]};},enumerateDevices:async()=>[{kind:'videoinput',deviceId:'rear',label:'Rear camera'}]},loadDecoder:async()=>({decodeFrame:()=>''}),schedule:()=>0,cancel:()=>{}};
 for(const deviceId of ['', 'rear']){
  const scanner=startCamera({play:async()=>{}},()=>{},()=>assert.fail('No camera error'),{...dependencies,deviceId,onCameras:list=>devices.push(list)});await scanner.ready;scanner.stop();
 }
 assert.deepEqual(requests[0].video.facingMode,{ideal:'environment'});assert.equal(requests[0].video.width.ideal,1920);assert.equal(requests[0].video.height.ideal,1080);assert.equal(requests[0].audio,false);assert.deepEqual(requests[1].video.deviceId,{exact:'rear'});assert.deepEqual(devices[0],[{id:'rear',label:'Rear camera'}]);
});
test('Native detection takes priority and never delivers again after pending detection is cancelled',async()=>{
 let resolve,software=0;const detection=new Promise(r=>{resolve=r});
 class Detector{static async getSupportedFormats(){return ['code_128','qr_code']}detect(){return detection}}
 const f=fixture({dependencies:{BarcodeDetector:Detector,loadDecoder:async()=>({decodeFrame:()=>{software++;return 'AS-OLD'}})}});
 await f.scanner.ready;f.scanner.stop();resolve([{rawValue:'AS-123'}]);await Promise.resolve();await Promise.resolve();assert.deepEqual(f.codes,[]);assert.equal(f.beeps,0);assert.equal(software,0);
});
test('Native detector success is audible, with software fallback when native detection fails',async()=>{
 let software=0;
 class Detector{static async getSupportedFormats(){return ['code_128','qr_code']}async detect(){return [{rawValue:'CAB-1'}]}}
 const f=fixture({dependencies:{BarcodeDetector:Detector,loadDecoder:async()=>({decodeFrame:()=>{software++;return 'WRONG'}})}});
 await f.scanner.ready;await Promise.resolve();assert.deepEqual(f.codes,['CAB-1']);assert.equal(f.beeps,1);assert.equal(software,0);
 class Broken extends Detector{async detect(){throw Error('Native unsupported on this camera')}}
 const fallback=fixture({dependencies:{BarcodeDetector:Broken,loadDecoder:async()=>({decodeFrame:()=> 'CAB-2'})}});
 await fallback.scanner.ready;await Promise.resolve();assert.deepEqual(fallback.codes,['CAB-2']);assert.equal(fallback.beeps,1);assert.deepEqual(fallback.errors,[]);
});
test('Continuous focus and supported torch/zoom controls are applied without requiring unsupported features',async()=>{
 const changes=[],features=[];
 const f=fixture({track:{getCapabilities:()=>({focusMode:['continuous'],torch:true,zoom:{min:1,max:4,step:.5}}),getSettings:()=>({zoom:1.5}),applyConstraints:async c=>{changes.push(c)}},dependencies:{onReady:c=>features.push(c)}});
 await f.scanner.ready;await f.scanner.setControl('torch',true);await f.scanner.setControl('zoom',2);
 assert.deepEqual(changes,[{advanced:[{focusMode:'continuous'}]},{advanced:[{torch:true}]},{advanced:[{zoom:2}]}]);assert.equal(features[0].zoom.value,1.5);
 await assert.rejects(f.scanner.setControl('zoom',10),/unavailable/);f.scanner.stop();await assert.rejects(f.scanner.setControl('torch',false),/not ready/);
 const defaultCamera=fixture();await defaultCamera.scanner.ready;defaultCamera.scanner.stop();assert.deepEqual(defaultCamera.errors,[]);
});
test('Native scanning periodically falls back without overlapping detection requests',async()=>{
 let native=0,software=0;
 class Detector{static async getSupportedFormats(){return ['qr_code']}async detect(){native++;return []}}
 const f=fixture({dependencies:{BarcodeDetector:Detector,loadDecoder:async()=>({decodeFrame:()=>{software++;return software===2?'AS-123':''}})}});
 await f.scanner.ready;await Promise.resolve();
 for(let i=0;i<3;i++)await f.queue[i].fn();
 assert.equal(native,4);assert.equal(software,2);assert.deepEqual(f.codes,['AS-123']);assert.equal(f.beeps,1);
});
test('Missing video frames do not invoke decoders or give false scan sounds',async()=>{
 let decoded=0;const f=fixture({dependencies:{loadDecoder:async()=>({decodeFrame:()=>{decoded++;return 'AS-123'}})}});f.video.readyState=0;
 await f.scanner.ready;assert.equal(decoded,0);assert.equal(f.beeps,0);assert.equal(f.queue.length,1);f.scanner.stop();
});
