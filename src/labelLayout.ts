export const labelFormats={
 '2x1':{width:50.8,height:25.4,feedWidth:25.4,feedHeight:50.8,name:'2 × 1 inch (50.8 × 25.4 mm)'},
} as const;
export type LabelSize=keyof typeof labelFormats;
export const defaultLabelSize:LabelSize='2x1';

export function labelCSS(size:LabelSize=defaultLabelSize){
 const format=labelFormats[size];if(!format)throw Error('Choose a supported label size.');
 const {width,height,feedWidth,feedHeight}=format;
 return `@page{size:${feedWidth}mm ${feedHeight}mm;margin:0}
 html,body{margin:0!important;padding:0!important;width:${feedWidth}mm!important;min-height:${feedHeight}mm!important;background:#fff!important;overflow:hidden}
 body{font-family:Arial,sans-serif;color:#000}
 .stock-label{box-sizing:border-box;width:${width}mm;height:${height}mm;padding:1mm 1.4mm;display:grid;grid-template-rows:auto auto 1fr;row-gap:.55mm;overflow:hidden;background:#fff;transform:translateY(${width}mm) rotate(-90deg);transform-origin:top left;break-after:page;page-break-after:always}
 .stock-label:last-child{break-after:auto;page-break-after:auto}
 .label-model{font-size:8pt;font-weight:800;line-height:1.05;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .label-meta{font-size:6.7pt;font-weight:700;line-height:1.05;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .label-barcode{min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:.35mm;overflow:hidden}
 .label-barcode svg{display:block;max-width:100%;width:auto;height:12.4mm}
 .label-value{font-size:6.5pt;font-weight:800;line-height:1;text-align:center;letter-spacing:.12mm;white-space:nowrap}
 @media print{
  html,body{margin:0!important;padding:0!important;width:${feedWidth}mm!important;min-height:${feedHeight}mm!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .stock-label{page-break-after:always}
  .stock-label:last-child{page-break-after:auto}
 }`;
}
