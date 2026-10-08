import test from 'node:test';
import assert from 'node:assert/strict';
import {phoneScannerURL,stockMatches} from '../src/stockScan.mjs';
import {createRequire} from 'node:module';
import QRCode from 'qrcode';
const require=createRequire(import.meta.url);
const JsBarcode=require('jsbarcode');
const {BrowserMultiFormatReader}=require('@zxing/browser');
const {RGBLuminanceSource,HybridBinarizer,BinaryBitmap}=require('@zxing/library');
const data={inventory:[{id:'phone',model:'iPhone 15',barcode_value:'AS-15',stock_code:'AS-STOCK',imei_1:'111111111111111',imei_2:'222222222222222',serial_number:'SERIAL'}],accessories:[{id:'cable',name:'USB cable',sku:'CAB-1',quantity:100},{id:'cover',name:'Cover',sku:'CAB-10',quantity:1}]};
test('Camera codes match complete identifiers without confusing similar accessory SKUs',()=>{
 for(const code of ['AS-15','as-stock','111111111111111','222222222222222','SERIAL'])assert.deepEqual(stockMatches(data,code,true).phones.map(p=>p.id),['phone']);
 assert.deepEqual(stockMatches(data,'  cab-1  ',true).accessories.map(a=>a.id),['cable']);
 assert.deepEqual(stockMatches(data,'CAB-',true),{phones:[],accessories:[]});
 assert.deepEqual(stockMatches(data,'12345',true),{phones:[],accessories:[]});
});
test('Manual stock search supports product names while accessory labels identify the SKU independently of quantity',()=>{
 assert.equal(stockMatches(data,'iphone').phones[0].id,'phone');assert.equal(stockMatches(data,'cable').accessories[0].id,'cable');assert.equal(stockMatches(data,'CAB-1').accessories.length,2);
 assert.equal(stockMatches({...data,accessories:[{...data.accessories[0],quantity:0}]},'CAB-1',true).accessories[0].id,'cable');
 assert.deepEqual(stockMatches(data,''),{phones:[],accessories:[]});
});
test('Phone scanner QR links point to the deployed app with a scan destination and no URL query tokens',()=>{
 assert.equal(phoneScannerURL('https://erp.example.com/?access_token=private#other'),'https://erp.example.com/#scan');
 assert.equal(phoneScannerURL('https://erp.example.com/store/'),'https://erp.example.com/store/#scan');
});
test('The actual camera decoder reads the Code128 and QR formats used by phone and accessory labels',()=>{
 const decode=(pixels,width,height)=>new BrowserMultiFormatReader().decodeBitmap(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels,width,height)))).getText();
 for(const code of ['111111111111111','CAB-1']){
  const encoded={};JsBarcode(encoded,code,{format:'CODE128'});
  const pattern=encoded.encodings.map(e=>e.data).join(''),width=pattern.length*3+60,height=100,pixels=new Uint8ClampedArray(width*height).fill(255);
  for(let x=0;x<pattern.length;x++)if(pattern[x]==='1')for(let dx=0;dx<3;dx++)for(let y=15;y<85;y++)pixels[y*width+30+x*3+dx]=0;
  assert.equal(decode(pixels,width,height),code);
  const qr=QRCode.create(code).modules,side=(qr.size+8)*6,image=new Uint8ClampedArray(side*side).fill(255);
  for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.data[y*qr.size+x])for(let dy=0;dy<6;dy++)for(let dx=0;dx<6;dx++)image[((y+4)*6+dy)*side+(x+4)*6+dx]=0;
  assert.equal(decode(image,side,side),code);
 }
});
