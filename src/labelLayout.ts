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
 body{font-family:Arial,Helvetica,sans-serif;color:#000}
 .stock-label{
  box-sizing:border-box;
  width:${width}mm!important;
  height:${height}mm!important;
  margin:0!important;
  padding:1.1mm 1.5mm;
  display:grid;
  grid-template-rows:auto auto 1fr auto;
  row-gap:.35mm;
  overflow:hidden;
  background:#fff;
  break-after:page;
  page-break-after:always;
 }
 .stock-label:last-child{break-after:auto;page-break-after:auto}
 .label-model{
  font-size:8.4pt;
  font-weight:800;
  line-height:1;
  text-align:center;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
 }
 .label-meta{
  font-size:6.2pt;
  font-weight:700;
  line-height:1;
  text-align:center;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
 }
 .label-barcode-stage{
  min-height:0;
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
 }
 .label-barcode{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
 }
 .label-barcode svg{
  display:block;
  width:46mm;
  height:11.5mm;
  max-width:46mm;
  overflow:visible;
 }
 .label-value{
  font-size:6pt;
  font-weight:800;
  line-height:1;
  text-align:center;
  white-space:nowrap;
  overflow:hidden;
 }
 @media print{
  html,body,.stock-label{
   margin:0!important;
   width:${width}mm!important;
   height:${height}mm!important;
  }
  html,body{
   padding:0!important;
   overflow:hidden!important;
   -webkit-print-color-adjust:exact;
   print-color-adjust:exact;
  }
 }`;
}
