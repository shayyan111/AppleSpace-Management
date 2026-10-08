export function cameraError(error:unknown):string;
export function videoConstraints(deviceId?:string,facingMode?:string):MediaStreamConstraints;
export function availableCameras(media?:MediaDevices):Promise<Array<{id:string;label:string}>>;
export function startPhotoCamera(video:HTMLVideoElement,onReady:(cameras:Array<{id:string;label:string}>)=>void,onError:(message:string)=>void,options?:{deviceId?:string;facingMode?:string}):{stop:()=>void;ready:Promise<void>};
export function captureSellerPhoto(video:HTMLVideoElement):Promise<File>;
export function attachSellerPhoto(input:HTMLInputElement,file:File):void;
