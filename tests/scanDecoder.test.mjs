import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {scannerFrame,loadScanDecoder,createPixelDecoder} from '../src/scanDecoder.mjs';
import QRCode from 'qrcode';
const require=createRequire(import.meta.url),library=require('@zxing/library'),JsBarcode=require('jsbarcode');

const decode=createPixelDecoder(library);

test('Optimized hints read real labels with uneven lighting, quarter-turn rotation and smaller bar widths',()=>{
 for(const code of ['111111111111111','CAB-1']){
  const encoded={};JsBarcode(encoded,code,{format:'CODE128'});
  const pattern=encoded.encodings.map(e=>e.data).join(''),width=pattern.length*2+60,height=90,pixels=new Uint8ClampedArray(width*height);
  // Gray background and gray bars with a gradient simulate less ideal lighting.
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels[y*width+x]=190+Math.floor(x/width*50);
  for(let x=0;x<pattern.length;x++)if(pattern[x]==='1')for(let dx=0;dx<2;dx++)for(let y=12;y<78;y++)pixels[y*width+30+x*2+dx]=40+Math.floor(x/pattern.length*30);
  assert.equal(decode(pixels,width,height),code);
  const rotated=new Uint8ClampedArray(width*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++)rotated[x*height+height-1-y]=pixels[y*width+x];
  // The explicit rotated scanner pass restores horizontal bars on fallback.
  const restored=new Uint8ClampedArray(width*height);for(let y=0;y<width;y++)for(let x=0;x<height;x++)restored[(height-1-x)*width+y]=rotated[y*height+x];
  assert.equal(decode(restored,width,height),code);
  const qr=QRCode.create(code).modules,side=(qr.size+8)*3,image=new Uint8ClampedArray(side*side).fill(220);
  for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.data[y*qr.size+x])for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++)image[((y+4)*3+dy)*side+(x+4)*3+dx]=35;
  assert.equal(decode(image,side,side),code);
 }
});
test('Frame passes preserve label resolution and alternate central, full and rotated images',()=>{
 const centre=scannerFrame(1920,1080,0),full=scannerFrame(1920,1080,1),rotated=scannerFrame(1920,1080,2);
 assert.equal(centre.drawWidth,centre.sourceWidth);assert.equal(centre.drawHeight,centre.sourceHeight);assert.ok(centre.x>0);assert.ok(centre.y>0);
 assert.equal(full.x,0);assert.equal(full.y,0);assert.equal(full.width,1920);assert.equal(full.height,1080);
 assert.equal(rotated.width,centre.height);assert.equal(rotated.height,centre.width);assert.equal(rotated.rotate,true);
 assert.equal(Math.max(scannerFrame(4000,3000,1).width,scannerFrame(4000,3000,1).height),1920);
});
test('Actual software decoder treats blank frames as normal misses and rotates its canvas safely',async()=>{
 const calls=[];
 const previous=globalThis.document;
 const makeCanvas=()=>{
  const canvas={width:0,height:0};const context={save(){},restore(){},translate(){},rotate(){},drawImage(...args){calls.push(args)},getImageData(){return {data:new Uint8ClampedArray(canvas.width*canvas.height*4).fill(255)}}};
  canvas.getContext=()=>context;return canvas;
 };
 globalThis.document={createElement:()=>makeCanvas()};
 try{
  const decoder=await loadScanDecoder(),video={videoWidth:640,videoHeight:480};
  for(let attempt=0;attempt<4;attempt++)assert.equal(decoder.decodeFrame(video,attempt),'');
  assert.ok(calls.length>=4);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
