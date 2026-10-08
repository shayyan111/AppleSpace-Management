export const labelFormats={
 '40x25':{width:40,height:25,name:'40 × 25 mm — Compact'},
 '50x30':{width:50,height:30,name:'50 × 30 mm — Larger'},
} as const;
export type LabelSize=keyof typeof labelFormats;
export const defaultLabelSize:LabelSize='40x25';
export function labelCSS(size:LabelSize=defaultLabelSize){
 const format=labelFormats[size];if(!format)throw Error('Choose a supported label size.');
 const {width,height}=format;
 return `@page{size:${width}mm ${height}mm;margin:0}
 body{margin:0!important;width:${width}mm!important;font:6pt Arial;color:#000;background:#fff!important}
 .stock-label{box-sizing:border-box;width:${width}mm;height:${height}mm;padding:1mm;break-after:page;break-inside:avoid;overflow:hidden;background:#fff}
 .stock-label:last-child{break-after:auto}
 .label-top{display:grid;grid-template-columns:minmax(0,1fr) 12mm;gap:1mm;height:${height-10}mm}
 .label-details{min-width:0;line-height:1.2}
 .label-details b{font-size:6.5pt}
 .label-model{font-size:6pt;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .label-status{font-size:5.5pt;white-space:nowrap}
 .label-code{font-size:5.5pt;white-space:nowrap}
 .label-qr{text-align:center;line-height:1}
 .label-qr img{display:block;width:12mm;height:12mm;image-rendering:pixelated}
 .label-qr span,.label-barcode span{display:block;font-size:4.5pt;line-height:1}
 .label-barcode{text-align:center}
 .label-barcode svg{display:block;width:${width-2}mm;height:6mm}
 @media print{html,body{padding:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
}
