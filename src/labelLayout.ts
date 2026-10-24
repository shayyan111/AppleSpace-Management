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
 .stock-label{box-sizing:border-box;width:${width}mm!important;height:${height}mm!important;margin:0!important;padding:1.35mm 3mm 1.3mm;display:flex;flex-direction:column;overflow:hidden;background:#fff;break-after:page;page-break-after:always}
 .stock-label:last-child{break-after:auto;page-break-after:auto}
 .label-brand{font-size:7.2pt;font-weight:800;line-height:1.05;text-align:center;white-space:nowrap;margin-bottom:.65mm}
 .label-model-line{font-size:8pt;font-weight:800;line-height:1.1;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.75mm}
 .label-meta{padding-left:1mm;font-size:6.5pt;font-weight:700;line-height:1.1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.65mm}
 .label-imei{padding-left:1mm;font-size:6.2pt;font-weight:700;line-height:1.1;text-align:left;white-space:nowrap;overflow:hidden;margin-bottom:.55mm}
 .label-barcode-stage{margin-top:auto;width:100%;min-width:0;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
 .label-barcode{width:100%;display:flex;align-items:flex-end;justify-content:center}
 .label-barcode svg{display:block;width:96%;max-width:96%;height:8mm;overflow:hidden}
 @media print{html,body,.stock-label{margin:0!important;width:${width}mm!important;height:${height}mm!important}html,body{padding:0!important;overflow:hidden!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 `;
}
