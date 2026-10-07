export const ledgerCategories:Record<string,string>;
export const ownerPages:string[];
export function ledgerRows(data:Record<string,any>,kind:string):Record<string,any>[];
export function ledgerImpact(data:Record<string,any>,period?:(date:string)=>boolean):{income:number;expenses:number};
export function pageAllowed(page:string,role:string):boolean;
