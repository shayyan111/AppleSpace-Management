import test from 'node:test';
import assert from 'node:assert/strict';
import {availableCameras,attachSellerPhoto,captureSellerPhoto,startPhotoCamera,videoConstraints} from '../src/photoCamera.mjs';

test('Computer photo capture selects a connected camera without requesting microphone access',async()=>{
 let constraints,stops=0;const video={srcObject:null,play:async()=>{}};const ready=[];
 const camera=startPhotoCamera(video,list=>ready.push(list),()=>assert.fail('No camera error'),{deviceId:'usb'}, {mediaDevices:{getUserMedia:async request=>{constraints=request;return {getTracks:()=>[{stop:()=>stops++}]};},enumerateDevices:async()=>[{kind:'videoinput',deviceId:'usb',label:'USB camera'},{kind:'audioinput',deviceId:'mic',label:'Microphone'}]}});
 await camera.ready;assert.equal(constraints.audio,false);assert.deepEqual(constraints.video.deviceId,{exact:'usb'});assert.equal(constraints.video.facingMode,undefined);assert.deepEqual(ready,[[{id:'usb',label:'USB camera'}]]);assert.ok(video.srcObject);
 camera.stop();camera.stop();assert.equal(stops,1);assert.equal(video.srcObject,null);
 assert.deepEqual(videoConstraints().video.facingMode,{ideal:'user'});
});
test('Closing seller camera during permission or playback never leaves a camera running',async()=>{
 let grant,stops=0;const video={srcObject:null,play:async()=>{}};
 const camera=startPhotoCamera(video,()=>assert.fail('No preview after cancel'),()=>assert.fail('No late error'),{}, {mediaDevices:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}});
 camera.stop();grant({getTracks:()=>[{stop:()=>stops++}]});await camera.ready;assert.equal(stops,1);assert.equal(video.srcObject,null);
 let played;
 const second=startPhotoCamera({srcObject:null,play:()=>new Promise(resolve=>{played=resolve;})},()=>assert.fail('No preview after cancel'),()=>assert.fail('No late error'),{}, {mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stops++}]})}});
 await Promise.resolve();second.stop();played();await second.ready;assert.equal(stops,2);
});
test('Camera denial is actionable and a playback failure releases tracks',async()=>{
 const errors=[];const denied=Object.assign(new Error('denied'),{name:'NotAllowedError'});
 await startPhotoCamera({},()=>assert.fail('No preview'),e=>errors.push(e),{}, {mediaDevices:{getUserMedia:async()=>{throw denied;}}}).ready;
 assert.match(errors[0],/Allow camera access/);
 let stopped=0;await startPhotoCamera({play:async()=>{throw Error('Playback failed');}},()=>assert.fail('No preview'),e=>errors.push(e),{}, {mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})}}).ready;
 assert.equal(stopped,1);assert.equal(errors[1],'Playback failed');
});
test('A captured JPEG preserves frame proportions and attaches as the purchase photo file',async()=>{
 const drawing=[];let encoded;
 const canvas={getContext:()=>({drawImage:(...args)=>drawing.push(args)}),toBlob:(done,type,quality)=>{encoded=[type,quality];done(new Blob(['photo'],{type}));}};
 const video={videoWidth:1920,videoHeight:1080};
 const file=await captureSellerPhoto(video,{createCanvas:()=>canvas});
 assert.equal(canvas.width,1280);assert.equal(canvas.height,720);assert.deepEqual(drawing[0],[video,0,0,1280,720]);assert.deepEqual(encoded,['image/jpeg',0.9]);assert.equal(file.type,'image/jpeg');assert.match(file.name,/^seller-photo-\d+\.jpg$/);assert.equal(await file.text(),'photo');
 class Transfer{files=[];items={add:file=>this.files.push(file)};}
 const input={};attachSellerPhoto(input,file,{DataTransfer:Transfer});assert.equal(input.files[0],file);
 const form=new FormData();form.set('photo',input.files[0]);assert.equal(form.get('photo').name,file.name);assert.equal(form.get('photo').type,'image/jpeg');
});
test('Taking a picture before a frame or after an encoding failure rejects capture',async()=>{
 await assert.rejects(captureSellerPhoto({videoWidth:0,videoHeight:0}),/Wait for the camera preview/);
 await assert.rejects(captureSellerPhoto({videoWidth:100,videoHeight:100},{createCanvas:()=>({getContext:()=>({drawImage(){}}),toBlob:done=>done(null)})}),/Could not create the photo/);
 assert.deepEqual(await availableCameras({enumerateDevices:async()=>[{kind:'videoinput',deviceId:'',label:''},{kind:'videoinput',deviceId:'rear',label:''}]}),[{id:'rear',label:'Camera 1'}]);
});
