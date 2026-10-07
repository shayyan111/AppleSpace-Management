import {localDay} from './math.mjs';
export function cleanupLimit(now=new Date()){return `${Number(localDay(now).slice(0,4))-1}-12-31`;}
export function cleanupRangeError(from,to,maximum=cleanupLimit()){
 const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 if(!valid(from)||!valid(to))return 'Choose a valid start and end date.';
 if(from>to)return 'The start date must be on or before the end date.';
 if(to>maximum)return 'Records from the current year or future years cannot be deleted.';
 return '';
}
export const cleanupLabels={sales:'Invoices',payments:'Customer payments',sale_items:'Invoice items',sale_item_costs:'Cost snapshots',purchases:'Purchases',supplier_payments:'Supplier payments',sold_phones:'Sold-phone archive',inventory_items:'Old sold inventory',expenses:'Expenses',daily_sessions:'Closed daily sessions',stock_movements:'Sold-stock movements',product_images:'Sold-phone image records'};
