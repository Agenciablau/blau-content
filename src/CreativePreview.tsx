import {useState} from 'react';
import {ExternalLink,ChevronLeft,ChevronRight} from 'lucide-react';
import {drivePreviewUrl} from './drive-preview';
import {materialLinks} from '../shared/material-links';
export default function CreativePreview({url,title,format}:{url:string;title:string;format:string}){
 const links=materialLinks(url),carousel=format==='Carrusel';
 const [position,setPosition]=useState(0);
 const index=Math.min(position,Math.max(0,links.length-1));
 const current=links[carousel?index:0]??'',preview=drivePreviewUrl(current);
 return <section className="creative-preview" aria-label="Material creativo">
  <div className="creative-preview-heading"><h2>{carousel?'Imágenes del carrusel':'Material creativo'}</h2>{current&&<a className="text-btn" href={current} target="_blank" rel="noopener noreferrer">{preview?'Abrir en Drive':'Abrir material'}<ExternalLink size={15}/></a>}</div>
  {carousel&&<div className="carousel-navigation"><button type="button" className="icon-btn" aria-label="Imagen anterior" disabled={index===0} onClick={()=>setPosition(index-1)}><ChevronLeft size={20}/></button><span aria-live="polite">Imagen {index+1} de {links.length}</span><button type="button" className="icon-btn" aria-label="Imagen siguiente" disabled={index===links.length-1} onClick={()=>setPosition(index+1)}><ChevronRight size={20}/></button></div>}
  {preview?<><iframe key={preview} className={'creative-frame '+(['Historia','Reel'].includes(format)?'portrait':'')} src={preview} title={`${carousel?'Imagen '+(index+1)+' de '+links.length:'Material creativo'} de ${title}`} allow="fullscreen" allowFullScreen referrerPolicy="no-referrer"/><p className="creative-preview-note">¿No se muestra? Abre el archivo en Drive y comprueba que tienes acceso con tu cuenta de Google.</p></>:<p className="creative-preview-note">Para ver una imagen o un vídeo aquí, utiliza el enlace del archivo de Drive. Las carpetas y otros enlaces se abren en una nueva pestaña.</p>}
  {carousel&&links.length>1&&<div className="carousel-image-picker" aria-label="Elegir imagen del carrusel">{links.map((_,i)=><button type="button" className={i===index?'active':''} key={i} aria-label={`Ver imagen ${i+1}`} aria-pressed={i===index} onClick={()=>setPosition(i)}>{i+1}</button>)}</div>}
 </section>;
}
