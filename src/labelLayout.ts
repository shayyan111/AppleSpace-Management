export const labelFormats={
 '2x1':{width:50.8,height:25.4,name:'2 × 1 inch (50.8 × 25.4 mm)'},
} as const;
export type LabelSize=keyof typeof labelFormats;
export const defaultLabelSize:LabelSize='2x1';

export function labelCSS(size:LabelSize=defaultLabelSize){
 const format=labelFormats[size];if(!format)throw Error('Choose a supported label size.');
 const {width,height}=format;
 return `@page{size:${width}mm ${height}mm;margin:0}
 html,body{
  margin:0!important;
  padding:0!important;
  width:${width}mm!important;
  height:${height}mm!important;
  background:#fff!important;
  overflow:hidden!important;
 }
 body{font-family:Arial,sans-serif;color:#000}
 .stock-label{
  box-sizing:border-box;
  width:${width}mm;
  height:${height}mm;
  margin:0;
  padding:1.2mm 1.5mm;
  display:grid;
  grid-template-rows:auto auto 1fr auto;
  row-gap:.45mm;
  overflow:hidden;
  background:#fff;
  break-after:page;
  page-break-after:always;
 }
 .stock-label:last-child{break-after:auto;page-break-after:auto}
 .label-model{
  font-size:8pt;
  font-weight:800;
  line-height:1;
  text-align:center;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
 }
 .label-meta{
  font-size:6.4pt;
  font-weight:700;
  line-height:1;
  text-align:center;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
 }
 .label-barcode-stage{
  min-height:0;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
 }
 .label-barcode{
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
 }
 .label-barcode svg{
  display:block;
  width:auto;
  max-width:100%;
  height:12mm;
 }
 .label-value{
  font-size:6.2pt;
  font-weight:800;
  line-height:1;
  text-align:center;
  letter-spacing:.08mm;
  white-space:nowrap;
 }
 @media print{
  html,body{
   margin:0!important;
   padding:0!important;
   width:${width}mm!important;
   height:${height}mm!important;
   overflow:hidden!important;
   -webkit-print-color-adjust:exact;
   print-color-adjust:exact;
  }
  .stock-label{
   margin:0!important;
   width:${width}mm!important;
   height:${height}mm!important;
  }
 }`;
}
