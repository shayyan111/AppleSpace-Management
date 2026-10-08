export const nativeFormats=['code_128','qr_code','ean_13','ean_8','upc_a','upc_e','code_39'];
export function scannerHints({DecodeHintType,BarcodeFormat},tryHarder=true){
 const hints=new Map([[DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.CODE_128,BarcodeFormat.QR_CODE,BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E,BarcodeFormat.CODE_39]]]);
 if(tryHarder)hints.set(DecodeHintType.TRY_HARDER,true);
 return hints;
}
export function createPixelDecoder(library){
 const fast=scannerHints(library,false),deep=scannerHints(library);
 const other=scannerHints(library,false);
 other.set(library.DecodeHintType.POSSIBLE_FORMATS,other.get(library.DecodeHintType.POSSIBLE_FORMATS).filter(f=>![library.BarcodeFormat.CODE_128,library.BarcodeFormat.QR_CODE].includes(f)));
 const readers=[new library.Code128Reader(),new library.QRCodeReader(),new library.MultiFormatOneDReader(other)];
 return (pixels,width,height,tryHarder=false)=>{
  const bitmap=new library.BinaryBitmap(new library.HybridBinarizer(new library.RGBLuminanceSource(pixels,width,height)));
  for(let i=0;i<readers.length;i++){
   try{return readers[i].decode(bitmap,i===2?other:tryHarder?deep:fast).getText();}catch(error){
    if(!(error instanceof library.NotFoundException||error instanceof library.ChecksumException||error instanceof library.FormatException))throw error;
   }finally{readers[i].reset();}
  }
  return '';
 };
}
export async function loadScanDecoder(){
 const library=await import('@zxing/library'),decode=createPixelDecoder(library);
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context)throw Error('Camera decoding is unavailable. Try another browser.');
 return {decodeFrame(video,attempt){
  const frame=scannerFrame(video.videoWidth,video.videoHeight,attempt);
  canvas.width=frame.width;canvas.height=frame.height;
  context.save();
  if(frame.rotate){context.translate(canvas.width,0);context.rotate(Math.PI/2);}
  context.drawImage(video,frame.x,frame.y,frame.sourceWidth,frame.sourceHeight,0,0,frame.drawWidth,frame.drawHeight);
  context.restore();
  const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
  const pixels=new Uint8ClampedArray(canvas.width*canvas.height);
  for(let i=0,j=0;i<rgba.length;i+=4,j++)pixels[j]=rgba[i+3]===0?255:(rgba[i]+2*rgba[i+1]+rgba[i+2])>>2;
  // Most frames use a cheap pass. A periodic deeper full-image pass searches
  // more rows without slowing every frame or flooding the console on misses.
  return decode(pixels,canvas.width,canvas.height,attempt%4===3);
 }};
}
// Alternate full image, full-resolution centre and rotated centre. One image
// per pass keeps controls responsive on older phones.
export function scannerFrame(width,height,attempt){
 const crop=attempt%4!==1&&attempt%4!==3,rotate=attempt%4===2;
 const sourceWidth=Math.max(1,Math.round(width*(crop ? .85 : 1))),sourceHeight=Math.max(1,Math.round(height*(crop ? .7 : 1)));
 const scale=Math.min(1,1920/Math.max(sourceWidth,sourceHeight));
 const drawWidth=Math.max(1,Math.round(sourceWidth*scale)),drawHeight=Math.max(1,Math.round(sourceHeight*scale));
 return {x:Math.round((width-sourceWidth)/2),y:Math.round((height-sourceHeight)/2),sourceWidth,sourceHeight,drawWidth,drawHeight,width:rotate?drawHeight:drawWidth,height:rotate?drawWidth:drawHeight,rotate};
}
