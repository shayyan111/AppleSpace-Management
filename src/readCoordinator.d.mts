export function createReadCoordinator<T>(fetchSnapshot:(signal:AbortSignal)=>Promise<T>):{read:(key:string,options?:{force?:boolean})=>Promise<T>;cancel:()=>void};
