export const labelFormats={
 '2x1':{width:50.8,height:25.4,name:'2 × 1 inch (50.8 × 25.4 mm)'},
} as const;
export type LabelSize=keyof typeof labelFormats;
export const defaultLabelSize:LabelSize='2x1';

export function labelCSS(size:LabelSize=defaultLabelSize){
 const format=labelFormats[size];if(!format)throw Error('Choose a supported label size.');
 const {width,height}=format;
 return `@page{size:${width}mm ${height}mm;margin:0}
 html,body{margin:0!important;padding:0!important;width:${width}mm!important;height:${height}mm!important;background:#fff!important;overflow:hidden!important}
 body{font-family:Arial,Helvetica,sans-serif;color:#000}
 .stock-label{box-sizing:border-box;width:${width}mm!important;height:${height}mm!important;margin:0!important;padding:1.1mm 1.5mm 1mm;display:grid;grid-template-rows:auto auto auto auto auto 1fr auto;row-gap:.25mm;overflow:hidden;background:#fff;break-after:page;page-break-after:always}
 .stock-label:last-child{break-after:auto;page-break-after:auto}
 .label-brand{font-size:6.3pt;font-weight:800;line-height:1;text-align:left;white-space:nowrap}
 .label-model{font-size:8.2pt;font-weight:800;line-height:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .label-storage,.label-pta,.label-health{font-size:6.4pt;font-weight:700;line-height:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .label-barcode-stage{min-height:0;width:100%;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
 .label-barcode{width:100%;display:flex;align-items:flex-end;justify-content:center}
 .label-barcode svg{display:block;width:47.8mm;height:9.6mm;max-width:47.8mm;overflow:visible}
 .label-value{font-size:6pt;font-weight:800;line-height:1;text-align:center;white-space:nowrap;overflow:hidden}
 @media print{html,body,.stock-label{margin:0!important;width:${width}mm!important;height:${height}mm!important}html,body{padding:0!important;overflow:hidden!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 `;
}
