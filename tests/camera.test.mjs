import test from 'node:test';
import assert from 'node:assert/strict';
import {startCamera} from '../src/camera.mjs';

test('Closing scanner while permission is pending stops a late camera stream',async()=>{
  let resolve, stopped=0, loaded=0;
  const permission=new Promise(r=>{resolve=r});
  const scanner=startCamera({},()=>assert.fail('No callback after close'),()=>assert.fail('No error after close'),{
    mediaDevices:{getUserMedia:()=>permission},loadDecoder:async()=>{loaded++}
  });
  scanner.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});await scanner.ready;
  assert.equal(stopped,1);assert.equal(loaded,0);
});
test('A decode is delivered once and releases camera tracks',async()=>{
  let callback, stopped=0;const codes=[];
  const scanner=startCamera({},code=>codes.push(code),()=>assert.fail('Unexpected error'),{
    mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})},
    loadDecoder:async()=>({decodeFromStream:async(_stream,_video,cb)=>{callback=cb;return {stop(){}}}})
  });
  await scanner.ready;callback({getText:()=> 'AS-123'});callback({getText:()=> 'AS-123'});
  assert.deepEqual(codes,['AS-123']);assert.equal(stopped,1);
});
test('Decoder failure releases an opened stream and reports an error',async()=>{
  let stopped=0;const errors=[];
  const scanner=startCamera({},()=>assert.fail('No barcode'),e=>errors.push(e),{
    mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})},
    loadDecoder:async()=>{throw Error('Decoder unavailable')}
  });await scanner.ready;assert.equal(stopped,1);assert.deepEqual(errors,['Decoder unavailable']);
});
