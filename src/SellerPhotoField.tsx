import {useEffect,useRef,useState} from 'react';
import {Camera,Trash2} from 'lucide-react';
import PhotoCapture from './PhotoCapture';
import {attachSellerPhoto,compressSellerPhoto} from './photoCamera.mjs';
export default function SellerPhotoField({required=false}:{required?:boolean}){
 const input=useRef<HTMLInputElement>(null);
 const [camera,setCamera]=useState(false),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[originalSize,setOriginalSize]=useState(0);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 async function select(next:File|null){
  if(!next){setFile(null);setOriginalSize(0);setError('');setCamera(false);return;}
  if(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>12*1024*1024){
   if(input.current)input.current.value='';
   setFile(null);setError('Choose a JPEG, PNG or WebP photo smaller than 12 MB.');return;
  }
  setBusy(true);setError('');setOriginalSize(next.size);
  try{
   const compressed=await compressSellerPhoto(next);
   if(input.current)attachSellerPhoto(input.current,compressed);
   setFile(compressed);setCamera(false);
  }catch(e:any){
   if(input.current)input.current.value='';
   setFile(null);setError(e.message||'Could not compress this photo.');
  }finally{setBusy(false);}
 }
 function capture(file:File){void select(file);}
 return <div className="seller-photo-field"><label className="field"><span>{required?'Seller photo *':'Seller photo (optional)'}</span><input ref={input} name="photo" type="file" accept="image/jpeg,image/png,image/webp" required={required} onChange={e=>void select(e.target.files?.[0]||null)}/></label><div className="scanner-buttons"><button type="button" disabled={busy} onClick={()=>setCamera(true)}><Camera size={16}/>{busy?'Compressing…':file?'Retake seller photo':'Take seller photo'}</button>{file&&<button type="button" onClick={()=>{if(input.current)input.current.value='';select(null);setCamera(false);}}><Trash2 size={16}/>Remove photo</button>}</div><p className="form-hint">Photos are automatically resized and compressed before upload to save storage and data. Target size is roughly 100–250 KB while staying clear for seller identification.</p>{file&&<p className="form-hint">Compressed photo: {(file.size/1024).toFixed(0)} KB{originalSize?` · original ${(originalSize/1024).toFixed(0)} KB`:''}</p>}{error&&<div className="error" role="alert">{error}</div>}{preview&&<img className="seller-photo-preview compact" src={preview} alt="Selected seller photo"/>}{camera&&<PhotoCapture onCapture={capture} onClose={()=>setCamera(false)}/>}</div>;
}
