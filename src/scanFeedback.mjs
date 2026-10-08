// Unlock on the button/key gesture, before asynchronous camera permission/decoding.
export function createScanFeedback(environment=globalThis){
 let context;
 const prepare=async()=>{
  try{
   const Audio=environment.AudioContext||environment.webkitAudioContext;
   if(!Audio)return false;
   if(!context||context.state==='closed')context=new Audio();
   if(context.state!=='running')await context.resume();
   return context.state==='running';
  }catch{return false;}
 };
 const beep=async()=>{
  if(!await prepare())return false;
  try{
   const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
   oscillator.type='sine';oscillator.frequency.setValueAtTime(1400,now);
   gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.18,now+.008);gain.gain.linearRampToValueAtTime(0,now+.13);
   oscillator.connect(gain);gain.connect(context.destination);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   oscillator.start(now);oscillator.stop(now+.14);return true;
  }catch{return false;}
 };
 return {prepare,beep};
}
const feedback=createScanFeedback();
export const prepareScanFeedback=feedback.prepare;
export const scanBeep=feedback.beep;
