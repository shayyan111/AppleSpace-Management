export function canMessage(contact:Record<string,any>):boolean;
export function campaignMatches(contact:Record<string,any>,audience:string,search:string,now?:number):boolean;
export function campaignMessage(draft:string,custom:string,contact:Record<string,any>):string;
export function campaignRecipients(contacts:Record<string,any>[],selected:Set<string>):Record<string,any>[];
