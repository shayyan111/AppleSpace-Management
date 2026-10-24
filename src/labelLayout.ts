export const labelFormats={
 '2x1':{width:25.4,height:50.8,name:'2 × 1 inch portrait (25.4 × 50.8 mm)'},
} as const;
export type LabelSize=keyof typeof labelFormats;
export const defaultLabelSize:LabelSize='2x1';

export function labelCSS(size:LabelSize=defaultLabelSize){
 const format=labelFormats[size];if(!format)throw Error('Choose a supported label size.');
 const {width,height}=format;
 return `@page{size:${width}mm ${height}mm;margin:0}
 html,body{margin:0!important;padding:0!important;width:${width}mm!important;min-height:${height}mm!important;background:#fff!important}
 body{font-family:Arial,sans-serif;color:#000}
 .stock-label{
  box-sizing:border-box;
  width:${width}mm;
  height:${height}mm;
  padding:1.2mm 1mm;
  display:grid;
  grid-template-rows:auto auto 1fr auto;
  row-gap:.8mm;
  overflow:hidden;
  background:#fff;
  break-after:page;
  page-break-after:always;
 }
 .stock-label:last-child{break-after:auto;page-break-after:auto}
 .label-model{
  font-size:8.5pt;
  font-weight:800;
  line-height:1.05;
  text-align:center;
  white-space:normal;
 }
 .label-meta{
  font-size:6.4pt;
  font-weight:700;
  line-height:1.12;
  text-align:center;
  white-space:normal;
 }
 .label-barcode-stage{
  position:relative;
  min-height:0;
  overflow:hidden;
 }
 .label-barcode{
  position:absolute;
  left:50%;
  top:50%;
  width:34mm;
  height:20mm;
  display:flex;
  align-items:center;
  justify-content:center;
  transform:translate(-50%,-50%) rotate(90deg);
  transform-origin:center center;
 }
 .label-barcode svg{
  display:block;
  width:32mm;
  height:17mm;
 }
 .label-value{
  font-size:6.3pt;
  font-weight:800;
  line-height:1.05;
  text-align:center;
  letter-spacing:.05mm;
  white-space:nowrap;
 }
 @media print{
  html,body{
   margin:0!important;
   padding:0!important;
   width:${width}mm!important;
   min-height:${height}mm!important;
   -webkit-print-color-adjust:exact;
   print-color-adjust:exact;
  }
 }`;
}
