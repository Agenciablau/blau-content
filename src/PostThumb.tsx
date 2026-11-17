import {useState} from 'react';
import {Layers,Play} from 'lucide-react';
import {driveThumbnailUrl} from './ReviewThumb';
import {materialLinks} from '../shared/material-links';
// Cuadrado con la imagen de la publicación para las tarjetas del calendario de escritorio.
export default function PostThumb({post}:{post:any}){
 const links=materialLinks(post.asset??''),src=links.map(driveThumbnailUrl).find(Boolean),[failed,setFailed]=useState(false),video=['Reel','Vídeo'].includes(post.format);
 return <span className={'post-thumb'+(src&&!failed?' has-image':'')}>{src&&!failed?<><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>{video&&<i><Play size={11}/></i>}{post.format==='Carrusel'&&links.length>1&&<i><Layers size={11}/>{links.length}</i>}</>:<em>{links.length?'Sin vista previa':'Sin material'}</em>}</span>;
}
