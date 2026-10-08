import test from 'node:test';
import assert from 'node:assert/strict';
import {createScanFeedback} from '../src/scanFeedback.mjs';

test('Scan audio unlocks before decoding, reuses its context and makes a short beep',async()=>{
 let contexts=0,resumes=0,tones=0,started,ended;
 class Audio{
  constructor(){contexts++;this.state='suspended';this.currentTime=10;this.destination={}}
  async resume(){resumes++;this.state='running'}
  createOscillator(){tones++;return {frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(value){started=value},stop(value){ended=value}}}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}}}
 }
 const feedback=createScanFeedback({AudioContext:Audio});assert.equal(await feedback.prepare(),true);assert.equal(tones,0);assert.equal(await feedback.beep(),true);assert.equal(await feedback.beep(),true);assert.equal(contexts,1);assert.equal(resumes,1);assert.equal(tones,2);assert.equal(started,10);assert.equal(ended,10.14);
});
test('Missing audio or blocked sound fails safely without blocking scan processing',async()=>{
 assert.equal(await createScanFeedback({}).beep(),false);
 class Blocked{constructor(){this.state='suspended'}async resume(){throw Error('Denied')}}
 const feedback=createScanFeedback({webkitAudioContext:Blocked});assert.equal(await feedback.prepare(),false);assert.equal(await feedback.beep(),false);
});
