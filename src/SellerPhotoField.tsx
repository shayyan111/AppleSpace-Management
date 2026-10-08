import {useEffect,useRef,useState} from 'react';
import {Camera,Trash2} from 'lucide-react';
import PhotoCapture from './PhotoCapture';
import {attachSellerPhoto} from './photoCamera.mjs';
export default function SellerPhotoField({required=false}:{required?:boolean}){
 const input=useRef<HTMLInputElement>(null);
 const [camera,setCamera]=useState(false),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 function select(file:File|null){if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)){if(input.current)input.current.value='';setFile(null);setError('Choose a JPEG, PNG or WebP photo smaller than 5 MB.');return;}setError('');setFile(file);setCamera(false);}
 function capture(file:File){if(!input.current)return;attachSellerPhoto(input.current,file);select(file);setCamera(false);}
 return <div className="seller-photo-field"><label className="field"><span>{required?'Seller photo *':'Seller photo (optional)'}</span><input ref={input} name="photo" type="file" accept="image/jpeg,image/png,image/webp" required={required} onChange={e=>select(e.target.files?.[0]||null)}/></label><div className="scanner-buttons"><button type="button" onClick={()=>setCamera(true)}><Camera size={16}/>{file?'Retake seller photo':'Take seller photo'}</button>{file&&<button type="button" onClick={()=>{if(input.current)input.current.value='';select(null);setCamera(false);}}><Trash2 size={16}/>Remove photo</button>}</div><p className="form-hint">Use your computer / laptop camera, a connected USB camera, or choose a saved photo. The photo is saved with the purchase.</p>{error&&<div className="error" role="alert">{error}</div>}{preview&&<img className="seller-photo-preview" src={preview} alt="Selected seller photo"/>}{camera&&<PhotoCapture onCapture={capture} onClose={()=>setCamera(false)}/>}</div>;
}
